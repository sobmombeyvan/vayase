import { useCallback, useRef, useState } from 'react';

const DEFAULT_MAX_MS = 120_000;

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** iOS Safari often reports no supported types but MediaRecorder still works */
export function isVoiceRecordingAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  if (typeof MediaRecorder === 'undefined') return false;
  return !!navigator.mediaDevices?.getUserMedia;
}

function createMediaRecorder(stream: MediaStream): MediaRecorder | null {
  const ios = isIosDevice();
  const candidates = ios
    ? ['audio/mp4', 'audio/aac', ...MIME_CANDIDATES]
    : MIME_CANDIDATES;

  for (const mimeType of candidates) {
    try {
      if (ios && (mimeType === 'audio/mp4' || mimeType === 'audio/aac')) {
        return new MediaRecorder(stream, { mimeType: 'audio/mp4' });
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) continue;
      return new MediaRecorder(stream, { mimeType });
    } catch {
      /* try next */
    }
  }

  try {
    return new MediaRecorder(stream);
  } catch {
    return null;
  }
}

export function formatVoiceDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function useVoiceRecorder(maxDurationMs = DEFAULT_MAX_MS) {
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef(0);

  const cleanupStream = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  const start = useCallback(async (): Promise<'ok' | 'unsupported' | 'permission'> => {
    if (!isVoiceRecordingAvailable()) return 'unsupported';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const recorder = createMediaRecorder(stream);
      if (!recorder) {
        stream.getTracks().forEach((track) => track.stop());
        return 'unsupported';
      }

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setDurationMs(0);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setDurationMs(elapsed);
        if (elapsed >= maxDurationMs && mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 200);

      return 'ok';
    } catch {
      cleanupStream();
      return 'permission';
    }
  }, [cleanupStream, maxDurationMs]);

  const stop = useCallback((): Promise<{ blob: Blob; mimeType: string; durationMs: number } | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      const elapsed = Date.now() - startTimeRef.current;

      if (!recorder || recorder.state === 'inactive') {
        cleanupStream();
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        let mimeType = recorder.mimeType || '';
        if (!mimeType || mimeType === 'video/mp4') mimeType = 'audio/mp4';
        if (!mimeType.startsWith('audio/')) {
          mimeType = isIosDevice() ? 'audio/mp4' : 'audio/webm';
        }
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanupStream();
        if (blob.size < 128 || elapsed < 500) {
          resolve(null);
          return;
        }
        resolve({ blob, mimeType, durationMs: elapsed });
      };

      recorder.stop();
    });
  }, [cleanupStream]);

  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => cleanupStream();
      recorder.stop();
    } else {
      cleanupStream();
    }
    chunksRef.current = [];
    setDurationMs(0);
  }, [cleanupStream]);

  return {
    isRecording,
    durationMs,
    start,
    stop,
    cancel,
    isSupported: isVoiceRecordingAvailable(),
  };
}
