import { useEffect, useState } from 'react';
import { FileText, ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getChatAttachmentUrl,
  formatFileSize,
  isImageMime,
  isVoiceMessage,
  getFileDisplayName,
  type ChatMessage,
} from '@/hooks/useChatMessages';
import { ChatVoicePlayer } from '@/components/chat/ChatVoicePlayer';

interface ChatAttachmentProps {
  message: ChatMessage;
  isOwn: boolean;
}

export function ChatAttachment({ message, isOwn }: ChatAttachmentProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fileName = getFileDisplayName(message);
  const isVoice = isVoiceMessage(message);
  const isImage = isImageMime(message.attachment_mime);
  const hasPath = !!message.attachment_path;

  useEffect(() => {
    if (!isImage || !hasPath || isVoice) return;
    let cancelled = false;
    setPreviewLoading(true);
    getChatAttachmentUrl(message.attachment_path!, fileName).then((signed) => {
      if (!cancelled) {
        setPreviewUrl(signed);
        setPreviewLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [message.attachment_path, fileName, isImage, hasPath, isVoice]);

  if (isVoice) {
    return <ChatVoicePlayer message={message} isOwn={isOwn} />;
  }

  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden min-w-[180px] max-w-[260px]',
        isOwn ? 'bg-vayase-night/10' : 'bg-secondary/80'
      )}
    >
      {isImage && hasPath && (
        <div className="relative bg-black/5 aspect-[4/3] max-h-[160px] flex items-center justify-center">
          {previewLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={fileName}
              className="w-full h-full object-cover max-h-[160px]"
            />
          ) : (
            <ImageIcon className="w-10 h-10 text-muted-foreground/50" />
          )}
        </div>
      )}

      <div className="flex items-center gap-2.5 px-2.5 py-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-vayase-accent/20">
          {isImage ? (
            <ImageIcon className="w-4 h-4 text-vayase-accent" />
          ) : (
            <FileText className="w-4 h-4 text-vayase-accent" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-xs font-semibold truncate leading-tight',
            isOwn ? 'text-vayase-night' : 'text-foreground'
          )}>
            {fileName}
          </p>
          {message.attachment_size != null && (
            <p className={cn(
              'text-[10px] mt-0.5',
              isOwn ? 'text-vayase-night/60' : 'text-muted-foreground'
            )}>
              {formatFileSize(message.attachment_size)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
