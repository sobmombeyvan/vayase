import { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getChatAttachmentUrl,
  resolveMessageAttachmentPath,
  normalizeVoiceMime,
  type ChatMessage,
} from '@/hooks/useChatMessages';

interface ChatVoicePlayerProps {
  message: ChatMessage;
  isOwn: boolean;
  clientId: string;
}

export function ChatVoicePlayer({ message, isOwn, clientId }: ChatVoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAudio() {
      setLoading(true);
      setError(false);
      setReady(false);

      let storedPath = message.attachment_path;
      if (!storedPath) {
        storedPath = await resolveMessageAttachmentPath(message, clientId);
      }

      if (!storedPath || cancelled) {
        setLoading(false);
        setError(true);
        return;
      }

      const fileName = message.attachment_name ?? 'voice.m4a';
      const signed = await getChatAttachmentUrl(storedPath, fileName);

      if (!signed || cancelled) {
        setLoading(false);
        setError(true);
        return;
      }

      try {
        const response = await fetch(signed);
        if (!response.ok) throw new Error('fetch failed');
        const rawBlob = await response.blob();
        const mime = normalizeVoiceMime(message.attachment_mime || rawBlob.type || 'audio/mp4');
        const blob = rawBlob.type === mime ? rawBlob : new Blob([rawBlob], { type: mime });
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;

        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        const audio = audioRef.current;
        if (audio) {
          audio.src = objectUrl;
          audio.load();
        }
        setReady(true);
        setLoading(false);
      } catch {
        if (cancelled) return;
        const audio = audioRef.current;
        if (audio) {
          audio.src = signed;
          audio.load();
        }
        setReady(true);
        setLoading(false);
      }
    }

    loadAudio();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [message.id, message.attachment_path, message.attachment_name, message.attachment_mime, clientId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !ready) return;

    const onTimeUpdate = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setProgress(audio.currentTime / audio.duration);
      }
    };
    const onLoaded = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => setError(true);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('durationchange', onLoaded);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('durationchange', onLoaded);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
    };
  }, [ready]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !ready || error) return;
    if (playing) {
      audio.pause();
    } else {
      try {
        await audio.play();
      } catch {
        setError(true);
      }
    }
  };

  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const timeLabel = error
    ? '—'
    : playing
      ? formatTime(audioRef.current?.currentTime ?? 0)
      : duration > 0
        ? formatTime(duration)
        : message.attachment_size
          ? `${Math.max(1, Math.round((message.attachment_size / 16000)))}s`
          : '0:00';

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 min-w-[200px] max-w-[240px] rounded-xl px-3 py-2',
        isOwn ? 'bg-vayase-night/10' : 'bg-secondary/80'
      )}
    >
      {/* iOS: avoid display:none on audio — prevents playback */}
      <audio
        ref={audioRef}
        playsInline
        preload="metadata"
        className="fixed left-0 top-0 w-px h-px opacity-0 pointer-events-none"
      />

      <button
        type="button"
        onClick={togglePlay}
        disabled={loading || !ready || error}
        className={cn(
          'shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors touch-manipulation',
          isOwn
            ? 'bg-vayase-night text-white hover:bg-vayase-night/90'
            : 'bg-vayase-accent text-vayase-night hover:bg-vayase-accent/90',
          (loading || !ready || error) && 'opacity-50 pointer-events-none'
        )}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : error ? (
          <AlertCircle className="w-4 h-4" />
        ) : playing ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', isOwn ? 'bg-vayase-night' : 'bg-vayase-accent')}
            style={{ width: `${Math.max(progress * 100, playing ? 4 : 0)}%` }}
          />
        </div>
        <p className={cn(
          'text-[10px] mt-1 tabular-nums',
          isOwn ? 'text-vayase-night/70' : 'text-muted-foreground'
        )}>
          {timeLabel}
        </p>
      </div>
    </div>
  );
}
