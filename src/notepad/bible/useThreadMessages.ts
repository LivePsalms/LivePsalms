// src/notepad/bible/useThreadMessages.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ChatThreadMessage } from './useChatThread';

export interface UseThreadMessagesResult {
  messages: ChatThreadMessage[];
  loading: boolean;
  error: string | null;
}

/** Load one thread's messages (read-only history view). No-ops on a null id. */
export function useThreadMessages(threadId: string | null): UseThreadMessagesResult {
  const [messages, setMessages] = useState<ChatThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessages([]);

    if (!supabase || !threadId) { setLoading(false); return; }

    (async () => {
      const { data, error: qErr } = await supabase
        .from('lamplight_chat_messages')
        .select('id, role, content, citations')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (qErr) { setError(qErr.message); setMessages([]); }
      else setMessages((data ?? []) as ChatThreadMessage[]);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [threadId]);

  return { messages, loading, error };
}
