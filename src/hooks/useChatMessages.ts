import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { notify } from '@/lib/notifications';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  client_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
}

const CHAT_BUCKET = 'chat-attachments';
const PRIMARY_BUCKET = 'client-documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const VOICE_MESSAGE_BODY = '🎤 Message vocal';

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function buildStoragePath(clientId: string, fileName: string) {
  return `${clientId}/chat/${Date.now()}_${fileName}`;
}

function parseStoredAttachment(stored: string): { bucket: string; path: string } {
  const sep = stored.indexOf('::');
  if (sep > 0) {
    return { bucket: stored.slice(0, sep), path: stored.slice(sep + 2) };
  }
  return { bucket: CHAT_BUCKET, path: stored };
}

function encodeStoredAttachment(bucket: string, path: string) {
  return `${bucket}::${path}`;
}

function buildAttachmentAttempts(storedPath: string): { bucket: string; path: string }[] {
  const { bucket, path } = parseStoredAttachment(storedPath);
  const attempts: { bucket: string; path: string }[] = [{ bucket, path }];

  const altBucket = bucket === PRIMARY_BUCKET ? CHAT_BUCKET : PRIMARY_BUCKET;
  attempts.push({ bucket: altBucket, path });

  if (path.includes('/chat/')) {
    const flat = path.replace('/chat/', '/');
    attempts.push({ bucket: CHAT_BUCKET, path: flat });
    attempts.push({ bucket: PRIMARY_BUCKET, path: flat });
  } else {
    const chatPath = path.replace(/^([^/]+)\//, '$1/chat/');
    if (chatPath !== path) {
      attempts.push({ bucket: CHAT_BUCKET, path: chatPath });
      attempts.push({ bucket: PRIMARY_BUCKET, path: chatPath });
    }
  }

  const seen = new Set<string>();
  return attempts.filter(({ bucket: b, path: p }) => {
    const key = `${b}:${p}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function storageErrorMessage(error: { message?: string; statusCode?: string | number }) {
  const msg = error.message?.toLowerCase() ?? '';
  if (msg.includes('bucket not found') || msg.includes('not found')) {
    return 'Stockage chat non configuré — exécutez supabase/chat_storage_fix.sql dans Supabase.';
  }
  if (msg.includes('row-level security') || msg.includes('policy')) {
    return 'Accès refusé au stockage. Vérifiez que le compte client est bien lié.';
  }
  if (msg.includes('payload too large') || msg.includes('entity too large')) {
    return 'Fichier trop volumineux (max 10 Mo).';
  }
  if (msg.includes('mime') || msg.includes('content type')) {
    return 'Type de fichier non autorisé.';
  }
  return error.message || 'Erreur de téléversement';
}

function chatErrorMessage(error: { code?: string; message?: string; details?: string }) {
  if (error.code === '42P01') {
    return 'Chat non configuré. Exécutez la migration SQL dans Supabase.';
  }
  if (error.code === '42501' || error.message?.includes('row-level security')) {
    return 'Accès refusé. Vérifiez que le compte client est bien lié.';
  }
  if (error.code === 'PGRST204') {
    return 'Base de données à mettre à jour (migration chat manquante).';
  }
  if (error.message?.includes('does not exist')) {
    return 'Table chat_messages absente — lancez la migration Supabase.';
  }
  return error.message || 'Erreur inconnue';
}

export function useChatMessages(
  clientId: string | undefined,
  clientAuthUserId?: string | null,
  onIncomingMessage?: (message: ChatMessage) => void
) {
  const { user, hasRole } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const onIncomingRef = useRef(onIncomingMessage);
  onIncomingRef.current = onIncomingMessage;

  const notifyRecipient = useCallback(
    (preview: string) => {
      if (clientAuthUserId && user && user.id !== clientAuthUserId && !hasRole('client')) {
        notify(
          clientAuthUserId,
          'Message de votre conseiller',
          preview.slice(0, 120),
          'client',
          '/client/messages'
        ).catch(() => {});
      }
    },
    [clientAuthUserId, user, hasRole]
  );

  const load = useCallback(async (silent = false) => {
    if (!clientId) return;
    if (!silent) setInitialLoading(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Chat load error:', error.code, error.message);
      if (!silent) {
        if (error.code === '42P01') {
          toast.error('Chat non configuré — exécutez la migration SQL Supabase');
        } else {
          toast.error('Impossible de charger les messages');
        }
      }
    } else {
      setMessages((data || []) as ChatMessage[]);
    }
    if (!silent) setInitialLoading(false);
  }, [clientId]);

  const markAsRead = useCallback(async () => {
    if (!clientId || !user) return;
    const now = new Date().toISOString();
    setMessages((prev) =>
      prev.map((m) =>
        m.sender_id !== user.id && !m.read_at ? { ...m, read_at: now } : m
      )
    );
    await supabase
      .from('chat_messages')
      .update({ read_at: now })
      .eq('client_id', clientId)
      .neq('sender_id', user.id)
      .is('read_at', null);
  }, [clientId, user]);

  useEffect(() => {
    if (!clientId) {
      setMessages([]);
      return;
    }

    load();
    markAsRead();

    const channel = supabase
      .channel(`chat-${clientId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (msg.sender_id !== user?.id) {
            markAsRead();
            onIncomingRef.current?.(msg);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
        }
      )
      .subscribe();

    const pollFallback = setInterval(() => load(true), 8000);

    return () => {
      clearInterval(pollFallback);
      supabase.removeChannel(channel);
    };
  }, [clientId, load, markAsRead, user?.id]);

  const insertMessage = async (payload: {
    body: string;
    attachment_path?: string | null;
    attachment_name?: string | null;
    attachment_mime?: string | null;
    attachment_size?: number | null;
  }) => {
    if (!clientId || !user) return null;

    const baseRow = {
      client_id: clientId,
      sender_id: user.id,
      body: payload.body.trim() || '📎 Fichier',
    };

    const fullRow = payload.attachment_path
      ? {
          ...baseRow,
          attachment_path: payload.attachment_path,
          attachment_name: payload.attachment_name ?? null,
          attachment_mime: payload.attachment_mime ?? null,
          attachment_size: payload.attachment_size ?? null,
        }
      : baseRow;

    let { data, error } = await supabase
      .from('chat_messages')
      .insert(fullRow)
      .select()
      .single();

    if (error?.code === 'PGRST204' && payload.attachment_path) {
      console.error('Chat attachment columns missing:', error.message);
      toast.error('Migration pièces jointes requise — exécutez chat_storage_fix.sql');
      return null;
    }

    if (error) {
      console.error('Chat send error:', error.code, error.message, error.details);
      toast.error(`Message non envoyé — ${chatErrorMessage(error)}`);
      return null;
    }

    const msg = data as ChatMessage;
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    return msg;
  };

  const patchMessageAttachments = async (
    messageId: string,
    fields: {
      attachment_path: string;
      attachment_name: string;
      attachment_mime?: string | null;
      attachment_size?: number | null;
    }
  ) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .update(fields)
      .eq('id', messageId)
      .select()
      .single();

    if (error || !data) return null;

    const patched = data as ChatMessage;
    setMessages((prev) => prev.map((m) => (m.id === messageId ? patched : m)));
    return patched;
  };

  const sendMessage = async (body: string) => {
    if (!body.trim()) return false;
    setSending(true);
    const msg = await insertMessage({ body: body.trim() });
    setSending(false);
    if (msg) notifyRecipient(msg.body);
    return !!msg;
  };

  const sendFile = async (file: File, caption?: string) => {
    if (!clientId || !user) return false;
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Fichier trop volumineux (max 10 Mo)');
      return false;
    }

    setSending(true);
    const safeName = sanitizeFileName(file.name);
    const storagePath = buildStoragePath(clientId, safeName);
    const uploadOptions = {
      upsert: false,
      ...(file.type ? { contentType: file.type } : {}),
    };

    let bucket = PRIMARY_BUCKET;
    let uploadedPath = storagePath;

    for (const candidate of [PRIMARY_BUCKET, CHAT_BUCKET]) {
      const { error: uploadError } = await supabase.storage
        .from(candidate)
        .upload(storagePath, file, uploadOptions);

      if (!uploadError) {
        bucket = candidate;
        uploadedPath = storagePath;
        break;
      }

      const isLast = candidate === CHAT_BUCKET;
      const missing =
        uploadError.message?.toLowerCase().includes('bucket not found') ||
        uploadError.message?.toLowerCase().includes('not found');

      if (isLast) {
        setSending(false);
        console.error('Chat upload error:', uploadError.message);
        toast.error(storageErrorMessage(uploadError));
        return false;
      }

      if (!missing) {
        setSending(false);
        console.error('Chat upload error:', uploadError.message);
        toast.error(storageErrorMessage(uploadError));
        return false;
      }
    }

    const storedPath = encodeStoredAttachment(bucket, uploadedPath);
    const body = caption?.trim() || `📎 ${file.name}`;
    const msg = await insertMessage({
      body,
      attachment_path: storedPath,
      attachment_name: file.name,
      attachment_mime: file.type || 'application/octet-stream',
      attachment_size: file.size,
    });

    if (msg && !msg.attachment_path) {
      await patchMessageAttachments(msg.id, {
        attachment_path: storedPath,
        attachment_name: file.name,
        attachment_mime: file.type || 'application/octet-stream',
        attachment_size: file.size,
      });
    }

    if (!msg) {
      await supabase.storage.from(bucket).remove([uploadedPath]);
    }

    setSending(false);
    if (msg) notifyRecipient(body.startsWith('🎤') ? VOICE_MESSAGE_BODY : `📎 ${file.name}`);
    return !!msg;
  };

  const sendVoice = async (blob: Blob, mimeType: string) => {
    const normalized = normalizeVoiceMime(mimeType);
    const ext = voiceFileExtension(normalized);
    const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: normalized });
    return sendFile(file, VOICE_MESSAGE_BODY);
  };

  const deleteMessage = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));

    const { error } = await supabase.from('chat_messages').delete().eq('id', messageId);

    if (error) {
      toast.error('Impossible de supprimer le message');
      load(true);
      return false;
    }

    if (msg?.attachment_path) {
      const { bucket, path } = parseStoredAttachment(msg.attachment_path);
      await supabase.storage.from(bucket).remove([path]);
    }
    return true;
  };

  const unreadCount = messages.filter(
    (m) => m.sender_id !== user?.id && !m.read_at
  ).length;

  return {
    messages,
    loading: initialLoading,
    sending,
    sendMessage,
    sendFile,
    sendVoice,
    deleteMessage,
    unreadCount,
    reload: load,
  };
}

export async function getChatAttachmentUrl(
  storedPath: string,
  downloadName?: string | null
): Promise<string | null> {
  const signOptions = downloadName ? { download: downloadName } : undefined;

  for (const { bucket, path } of buildAttachmentAttempts(storedPath)) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600, signOptions);

    if (!error && data?.signedUrl) return data.signedUrl;
    if (error) console.warn(`Chat attachment sign failed (${bucket}/${path}):`, error.message);
  }

  return null;
}

export async function downloadChatAttachment(
  storedPath: string,
  fileName?: string | null
): Promise<boolean> {
  const name = fileName || 'document';

  for (const { bucket, path } of buildAttachmentAttempts(storedPath)) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 120, { download: name });

    if (!error && data?.signedUrl) {
      window.location.assign(data.signedUrl);
      return true;
    }
    if (error) console.warn(`Chat download failed (${bucket}/${path}):`, error.message);
  }

  return false;
}

async function listStorageFolder(bucket: string, folder: string) {
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 200,
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) {
    console.warn(`Storage list failed (${bucket}/${folder}):`, error.message);
    return [];
  }
  return data ?? [];
}

function matchStorageFile(files: { name: string }[], fileName: string, createdAt?: string) {
  const safeName = sanitizeFileName(fileName);
  const matches = files.filter(
    (f) =>
      f.name === safeName ||
      f.name.endsWith(`_${safeName}`) ||
      f.name.includes(safeName)
  );
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  if (createdAt) {
    const msgTime = new Date(createdAt).getTime();
    let best = matches[0];
    let bestDiff = Infinity;
    for (const f of matches) {
      const ts = Number.parseInt(f.name.split('_')[0], 10);
      if (!Number.isNaN(ts)) {
        const diff = Math.abs(ts - msgTime);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = f;
        }
      }
    }
    return best;
  }

  return matches[0];
}

export async function resolveMessageAttachmentPath(
  msg: ChatMessage,
  clientId: string
): Promise<string | null> {
  if (msg.attachment_path) return msg.attachment_path;
  if (!isFileMessage(msg) && !isVoiceMessage(msg)) return null;

  const fileName = msg.attachment_name ? getFileDisplayName(msg) : null;
  const prefixes = [`${clientId}/chat`, clientId];

  for (const bucket of [PRIMARY_BUCKET, CHAT_BUCKET]) {
    for (const prefix of prefixes) {
      const files = await listStorageFolder(bucket, prefix);

      if (isVoiceMessage(msg)) {
        const voiceFiles = files.filter((f) => f.name.startsWith('voice_'));
        if (voiceFiles.length > 0) {
          const match = fileName && fileName !== 'Message vocal'
            ? matchStorageFile(voiceFiles, fileName, msg.created_at)
            : matchStorageFile(voiceFiles, voiceFiles[0].name, msg.created_at);
          if (match) {
            return encodeStoredAttachment(bucket, `${prefix}/${match.name}`);
          }
        }
      }

      if (fileName && fileName !== 'Message vocal') {
        const match = matchStorageFile(files, fileName, msg.created_at);
        if (match) {
          return encodeStoredAttachment(bucket, `${prefix}/${match.name}`);
        }
      }
    }
  }

  return null;
}

export async function downloadMessageAttachment(
  msg: ChatMessage,
  clientId: string
): Promise<boolean> {
  let storedPath = msg.attachment_path;

  if (!storedPath) {
    storedPath = await resolveMessageAttachmentPath(msg, clientId);
    if (!storedPath) return false;

    await supabase
      .from('chat_messages')
      .update({
        attachment_path: storedPath,
        attachment_name: getFileDisplayName(msg),
      })
      .eq('id', msg.id);
  }

  return downloadChatAttachment(storedPath, getFileDisplayName(msg));
}

export function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function normalizeVoiceMime(mimeType: string): string {
  const m = (mimeType || '').toLowerCase();
  if (!m || m === 'video/mp4' || m === 'video/quicktime') return 'audio/mp4';
  if (m.startsWith('audio/')) return mimeType;
  return 'audio/webm';
}

export function voiceFileExtension(mimeType: string): string {
  const normalized = normalizeVoiceMime(mimeType);
  if (normalized.includes('mp4') || normalized.includes('aac')) return 'm4a';
  if (normalized.includes('ogg')) return 'ogg';
  return 'webm';
}

export function isImageMime(mime: string | null | undefined) {
  return !!mime?.startsWith('image/');
}

export function isAudioMime(mime: string | null | undefined) {
  return !!mime?.startsWith('audio/');
}

export function isVoiceMessage(msg: ChatMessage) {
  if (msg.body?.startsWith('🎤')) return true;
  if (isAudioMime(msg.attachment_mime)) return true;
  const name = msg.attachment_name?.toLowerCase() ?? '';
  return name.startsWith('voice_') && /\.(m4a|webm|ogg|mp4|aac)$/.test(name);
}

export function isFileMessage(msg: ChatMessage) {
  return !!(
    msg.attachment_path ||
    msg.attachment_name ||
    (msg.body && msg.body.startsWith('📎')) ||
    isVoiceMessage(msg)
  );
}

export function getFileDisplayName(msg: ChatMessage) {
  if (msg.attachment_name) return msg.attachment_name;
  if (msg.body?.startsWith('🎤')) return 'Message vocal';
  if (msg.body?.startsWith('📎')) return msg.body.replace(/^📎\s*/, '').trim() || 'document';
  return 'document';
}
