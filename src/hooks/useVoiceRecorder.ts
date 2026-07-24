import { useCallback, useRef, useState } from 'react';

const DEFAULT_MAX_MS = 120_000;

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
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
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return 'unsupported';
    }

    const mimeType = getSupportedMimeType();
    if (!mimeType) return 'unsupported';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType });
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
        const mimeType = recorder.mimeType || 'audio/webm';
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

  return { isRecording, durationMs, start, stop, cancel, isSupported: !!getSupportedMimeType() };
}
