import { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getChatAttachmentUrl, type ChatMessage } from '@/hooks/useChatMessages';

interface ChatVoicePlayerProps {
  message: ChatMessage;
  isOwn: boolean;
}

export function ChatVoicePlayer({ message, isOwn }: ChatVoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!message.attachment_path) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getChatAttachmentUrl(message.attachment_path, message.attachment_name ?? 'voice.webm').then((signed) => {
      if (!cancelled) {
        setUrl(signed);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [message.attachment_path, message.attachment_name]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;

    const onTimeUpdate = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [url]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (playing) {
      audio.pause();
    } else {
      try {
        await audio.play();
      } catch {
        /* autoplay blocked */
      }
    }
  };

  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 min-w-[200px] max-w-[240px] rounded-xl px-3 py-2',
        isOwn ? 'bg-vayase-night/10' : 'bg-secondary/80'
      )}
    >
      {url && <audio ref={audioRef} src={url} preload="metadata" className="hidden" />}

      <button
        type="button"
        onClick={togglePlay}
        disabled={loading || !url}
        className={cn(
          'shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors',
          isOwn
            ? 'bg-vayase-night text-white hover:bg-vayase-night/90'
            : 'bg-vayase-accent text-vayase-night hover:bg-vayase-accent/90',
          (loading || !url) && 'opacity-50 pointer-events-none'
        )}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
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
          {playing ? formatTime(audioRef.current?.currentTime ?? 0) : formatTime(duration)}
        </p>
      </div>
    </div>
  );
}
