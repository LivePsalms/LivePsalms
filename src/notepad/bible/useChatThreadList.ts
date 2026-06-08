// src/notepad/bible/useChatThreadList.ts
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ChatThreadSummary {
  id: string;
  title: string;
  created_at: string;
  archived: boolean;
}

export interface UseChatThreadListResult {
  threads: ChatThreadSummary[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useChatThreadList(book: string, chapter: number, userId: string | null): UseChatThreadListResult {
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const passageRef = `${book}.${chapter}`;
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    // Reset to a loading state whenever the passage/user changes. Mirrors the
    // sibling useChatThread effect; the synchronous reset is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setThreads([]);

    if (!supabase || !userId) { setLoading(false); return; }

    (async () => {
      const { data, error: qErr } = await supabase
        .from('lamplight_chat_threads')
        .select('id, title, created_at, archived')
        .eq('user_id', userId)
        .eq('passage_ref', passageRef)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (qErr) { setError(qErr.message); setThreads([]); }
      else setThreads((data ?? []) as ChatThreadSummary[]);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [passageRef, userId, nonce]);

  return { threads, loading, error, reload };
}
