import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import {
  Loader2, Send, Paperclip, Check, CheckCheck,
  ChevronLeft, MoreVertical, Trash2, Shield, Download, Mic, X, Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useChatMessages, ChatMessage, downloadMessageAttachment, isFileMessage, isVoiceMessage, getFileDisplayName } from '@/hooks/useChatMessages';
import { ChatAttachment } from '@/components/chat/ChatAttachment';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useVoiceRecorder, formatVoiceDuration } from '@/hooks/useVoiceRecorder';

interface ChatThreadProps {
  clientId: string;
  clientAuthUserId?: string | null;
  clientName?: string;
  emptyTitle?: string;
  showSenderLabels?: boolean;
  allowDelete?: boolean;
  onIncomingMessage?: (message: ChatMessage) => void;
  clientMode?: boolean;
  adminMode?: boolean;
}

function formatMessageTime(date: Date, locale: typeof fr) {
  return format(date, 'HH:mm', { locale });
}

function formatDateSeparator(date: Date, locale: typeof fr) {
  if (isToday(date)) return "Aujourd'hui";
  if (isYesterday(date)) return 'Hier';
  return format(date, 'EEEE d MMMM', { locale });
}

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function MessageMenu({ onDelete, label }: { onDelete: () => void; label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="shrink-0 p-1 rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-secondary transition-opacity"
          aria-label={label}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuItem
          className="text-destructive focus:text-destructive gap-2 cursor-pointer"
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4" />
          {label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ChatThread({
  clientId,
  clientAuthUserId,
  clientName,
  emptyTitle,
  showSenderLabels = false,
  allowDelete = false,
  onIncomingMessage,
  clientMode = false,
  adminMode = false,
}: ChatThreadProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const locale = i18n.language === 'fr' ? fr : enUS;
  const { messages, loading, sending, sendMessage, sendFile, sendVoice, deleteMessage } = useChatMessages(
    clientId,
    clientAuthUserId,
    onIncomingMessage
  );
  const [text, setText] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isRecording, durationMs, start: startRecording, stop: stopRecording, cancel: cancelRecording } = useVoiceRecorder();

  const headerTitle = clientMode ? t('chat.advisor') : clientName;
  const headerSubtitle = clientMode ? t('chat.clientSubtitle') : t('chat.liveChat');
  const showHeader = clientMode || (!!(clientName || clientMode) && !(adminMode && isMobile));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    const content = text;
    setText('');
    const ok = await sendMessage(content);
    if (!ok) setText(content);
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ok = await sendFile(file, text.trim() || undefined);
    if (ok) setText('');
  };

  const handleStartVoice = async () => {
    if (sending || isRecording) return;
    const result = await startRecording();
    if (result === 'permission') toast.error(t('chat.voicePermissionDenied'));
    if (result === 'unsupported') toast.error(t('chat.voiceUnsupported'));
  };

  const handleCancelVoice = () => {
    cancelRecording();
  };

  const handleSendVoice = async () => {
    if (!isRecording || sending) return;
    const recorded = await stopRecording();
    if (!recorded) {
      toast.error(t('chat.voiceTooShort'));
      return;
    }
    const ok = await sendVoice(recorded.blob, recorded.mimeType);
    if (!ok) toast.error(t('chat.voiceSendFailed'));
  };

  const handleDelete = async (msgId: string) => {
    const ok = await deleteMessage(msgId);
    if (ok) toast.success(t('chat.messageDeleted'));
  };

  const handleDownloadFile = async (msg: ChatMessage) => {
    setDownloadingId(msg.id);
    const ok = await downloadMessageAttachment(msg, clientId);
    setDownloadingId(null);
    if (!ok) toast.error(t('chat.downloadFailed'));
  };

  const hasCaption = (msg: ChatMessage) =>
    isFileMessage(msg) && msg.body && !msg.body.startsWith('📎') && !msg.body.startsWith('🎤');

  return (
    <div className="flex flex-col h-full min-h-0 bg-secondary/40">
      {(showHeader) && (
        <div className="px-3 py-3 bg-vayase-night text-white flex items-center gap-2 shrink-0 shadow-md safe-top">
          {clientMode && (
            <button
              type="button"
              onClick={() => navigate('/client/dashboard')}
              className="p-2 -ml-1 rounded-full hover:bg-white/10 text-white"
              aria-label={t('common.back')}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <Avatar className="h-10 w-10 shrink-0 ring-2 ring-vayase-accent/40">
            <AvatarFallback className="bg-vayase-accent/20 text-vayase-accent font-semibold text-sm">
              {clientMode ? <Shield className="w-5 h-5" /> : getInitials(clientName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[15px] truncate leading-tight">{headerTitle}</h3>
            <p className="text-xs text-white/60 truncate">{headerSubtitle}</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-vayase-accent animate-pulse shrink-0" title="En ligne" />
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 sm:px-3 py-3 scroll-smooth min-h-0 vayase-chat-bg">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-vayase-accent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="bg-card border border-vayase-accent/20 rounded-2xl px-6 py-4 shadow-sm max-w-[280px] text-center">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {emptyTitle || t('chat.noMessages')}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-2">{t('chat.startConversation')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5 max-w-2xl mx-auto pb-2">
            {messages.map((msg, index) => {
              const isOwn = msg.sender_id === user?.id;
              const msgDate = new Date(msg.created_at);
              const showDate =
                index === 0 || !isSameDay(msgDate, new Date(messages[index - 1].created_at));
              const isFromClient = !!clientAuthUserId && msg.sender_id === clientAuthUserId;
              const isRead = !!msg.read_at;
              const isFile = isFileMessage(msg);
              const isVoice = isVoiceMessage(msg);

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <span className="text-[11px] font-medium text-muted-foreground bg-card/90 px-3 py-1 rounded-full shadow-sm border border-border/50">
                        {formatDateSeparator(msgDate, locale)}
                      </span>
                    </div>
                  )}
                  <div className={cn('flex mb-1 group', isOwn ? 'justify-end pl-8' : 'justify-start pr-8')}>
                    <div className={cn('flex flex-col max-w-full', isOwn ? 'items-end' : 'items-start')}>
                      {showSenderLabels && !isOwn && (
                        <span className="text-[10px] text-muted-foreground mb-0.5 px-2">
                          {isFromClient ? clientName : t('chat.advisor')}
                        </span>
                      )}
                      <div className={cn('flex items-end gap-1.5', isOwn ? 'flex-row-reverse' : 'flex-row')}>
                        <div
                          className={cn(
                            'relative rounded-2xl px-3 pt-2 pb-1 shadow-sm',
                            isOwn
                              ? 'bg-vayase-accent text-vayase-night rounded-br-sm'
                              : 'bg-card text-foreground border border-border/60 rounded-bl-sm'
                          )}
                        >
                          {isFile && (
                            <div className="mb-1">
                              <ChatAttachment message={msg} isOwn={isOwn} />
                            </div>
                          )}
                          {(!isFile || hasCaption(msg)) && (
                            <p className={cn(
                              'text-[14px] leading-relaxed whitespace-pre-wrap break-words',
                              isOwn ? 'text-vayase-night' : 'text-foreground'
                            )}>
                              {hasCaption(msg) ? msg.body : isFile ? null : msg.body}
                            </p>
                          )}
                          <div className={cn(
                            'flex items-center justify-end gap-1 mt-0.5',
                            isOwn ? 'text-vayase-night/60' : 'text-muted-foreground'
                          )}>
                            <span className="text-[10px] leading-none">
                              {formatMessageTime(msgDate, locale)}
                            </span>
                            {isOwn && (
                              isRead
                                ? <CheckCheck className="w-3.5 h-3.5 text-vayase-night/80" />
                                : <Check className="w-3.5 h-3.5 text-vayase-night/50" />
                            )}
                          </div>
                        </div>

                        {isFile && !isVoice && (
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(msg)}
                            disabled={downloadingId === msg.id}
                            title={t('chat.download')}
                            aria-label={t('chat.download')}
                            className={cn(
                              'shrink-0 flex items-center justify-center',
                              'h-10 w-10 rounded-full shadow-md border transition-all active:scale-95',
                              'bg-vayase-night text-white border-vayase-night/20 hover:bg-vayase-night/90',
                              downloadingId === msg.id && 'opacity-70 pointer-events-none'
                            )}
                          >
                            {downloadingId === msg.id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Download className="w-5 h-5" />
                            )}
                          </button>
                        )}

                        {allowDelete && (
                          <MessageMenu
                            label={t('chat.deleteMessage')}
                            onDelete={() => handleDelete(msg.id)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={cn(
        'shrink-0 px-3 py-3 bg-card border-t border-border',
        clientMode && 'pb-[calc(0.75rem+env(safe-area-inset-bottom))]'
      )}>
        {isRecording ? (
          <div className="flex items-center gap-2 max-w-2xl mx-auto">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleCancelVoice}
              className="shrink-0 h-10 w-10 rounded-full text-destructive hover:bg-destructive/10"
              title={t('common.cancel')}
            >
              <X className="w-5 h-5" />
            </Button>
            <div className="flex-1 flex items-center gap-3 bg-destructive/10 border border-destructive/20 rounded-full px-4 py-2.5 min-h-[44px]">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse shrink-0" />
              <span className="text-sm font-medium text-destructive tabular-nums">
                {formatVoiceDuration(durationMs)}
              </span>
              <span className="text-xs text-muted-foreground truncate">{t('chat.recordingVoice')}</span>
            </div>
            <Button
              type="button"
              size="icon"
              onClick={handleSendVoice}
              disabled={sending}
              className="shrink-0 h-11 w-11 rounded-full bg-vayase-accent hover:bg-vayase-accent/90 text-vayase-night"
              title={t('chat.sendVoice')}
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-4 h-4 fill-current" />}
            </Button>
          </div>
        ) : (
        <div className="flex items-end gap-1.5 sm:gap-2 max-w-2xl mx-auto">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,audio/*"
            onChange={handleFilePick}
            disabled={sending}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={sending}
            onClick={handleStartVoice}
            className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:text-vayase-accent hover:bg-vayase-accent/10 touch-manipulation"
            title={t('chat.recordVoice')}
          >
            <Mic className="w-5 h-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={sending}
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:text-vayase-accent hover:bg-vayase-accent/10 touch-manipulation"
            title={t('chat.attachFile')}
          >
            <Paperclip className="w-5 h-5" />
          </Button>

          <div className="flex-1 flex items-center bg-secondary/50 border border-border/60 rounded-full px-3 sm:px-4 py-2.5 min-h-[44px] min-w-0 focus-within:ring-2 focus-within:ring-vayase-accent/30 focus-within:border-vayase-accent/40 transition-all">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder={t('chat.typeMessage')}
              disabled={sending}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={(!text.trim() && !sending) || sending}
            size="icon"
            className="shrink-0 h-11 w-11 rounded-full bg-vayase-accent hover:bg-vayase-accent/90 text-vayase-night shadow-sm disabled:opacity-40 touch-manipulation"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
        )}
      </div>
    </div>
  );
}
