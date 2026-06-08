// src/notepad/components/lamplight/chat/LamplightChat.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { useChatThread, type ChatThreadMessage } from '@/notepad/bible/useChatThread';
import { sendChatMessage, requestOpeningInsight, type InvokeFn } from '@/notepad/bible/lamplight-chat-client';
import { useNoteCollection } from '@/notepad/context/useNoteCollection';
import { ChatMessage } from './ChatMessage';

export interface LamplightChatProps {
  book: string;
  chapter: number;
  userId: string;
  invoke: InvokeFn;
}

let localIdSeq = 0;
const localId = () => `local-${++localIdSeq}`;

export function LamplightChat({ book, chapter, userId, invoke }: LamplightChatProps) {
  const thread = useChatThread(book, chapter, userId);
  const { notes } = useNoteCollection();
  // Resolve note citations to their titles (chips show names, never raw note ids).
  const resolveNoteTitle = useMemo(() => {
    const titleById = new Map(notes.map((n) => [n.id, n.title]));
    return (id: string) => titleById.get(id);
  }, [notes]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passageKey = `${book}.${chapter}`;
  const [insighting, setInsighting] = useState(false);
  const insightInFlight = useRef(false);
  const livePassageKey = useRef(passageKey);
  livePassageKey.current = passageKey;
  const mounted = useRef(true);

  // Track real unmount so an in-flight reflection isn't applied after teardown.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Clear any stale "reflecting…" indicator / error when the passage changes, and
  // release the in-flight guard so the new passage can request its own reflection.
  useEffect(() => {
    setInsighting(false);
    setError(null);
    insightInFlight.current = false;
  }, [passageKey]);

  // User-triggered reflection (replaces the old auto-fire on an empty thread).
  const requestReflection = async () => {
    if (insightInFlight.current) return;
    insightInFlight.current = true;
    setError(null);
    setInsighting(true);
    const res = await requestOpeningInsight(invoke, { book, chapter });
    // Apply only if still mounted and still viewing the passage we requested for.
    // On a passage change the effect above resets the flight guard for the new
    // passage, so this early return must NOT touch it (the new request owns it).
    if (!mounted.current || livePassageKey.current !== passageKey) return;
    insightInFlight.current = false;
    if (res.ok) {
      thread.append([{ id: localId(), role: 'assistant', content: res.reply, citations: res.citations }]);
    } else {
      setError(res.reason);
    }
    setInsighting(false);
  };

  const send = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setDraft('');
    setError(null);
    setSending(true);
    const userMsg: ChatThreadMessage = { id: localId(), role: 'user', content: message, citations: [] };
    thread.append([userMsg]);
    try {
      const res = await sendChatMessage(invoke, { book, chapter, message });
      if (res.ok) {
        thread.append([{ id: localId(), role: 'assistant', content: res.reply, citations: res.citations }]);
      } else {
        setError(res.reason);
      }
    } finally {
      setSending(false);
    }
  };

  const startNewReflection = async () => {
    await thread.archiveAndReset(); // clears to an empty thread; the Reflect button reappears
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'rgba(255,255,255,0.45)', fontFamily: 'Outfit, sans-serif' }}>
      <div className="flex justify-end px-3 pt-2 shrink-0">
        <button
          onClick={() => void startNewReflection()}
          className="text-[10px] tracking-wider px-2 py-1 rounded-full"
          style={{ color: 'var(--silica)', border: '1px solid var(--pale-stone)', fontFamily: 'Outfit, sans-serif' }}
        >
          + New reflection
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {thread.loading && <p className="text-[11px]" style={{ color: 'var(--silica)' }}>Loading conversation…</p>}
        {!thread.loading && thread.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <button
              onClick={() => void requestReflection()}
              disabled={insighting}
              className="text-[12px] tracking-wider px-4 py-2 rounded-full disabled:opacity-40"
              style={{ background: '#C49A78', color: '#fff', fontFamily: 'Outfit, sans-serif' }}
            >
              Reflect on this passage
            </button>
            <p className="text-[10px]" style={{ color: 'var(--silica)' }}>
              Lamplight draws on your own notes.
            </p>
          </div>
        )}
        {thread.messages.map((m) => (
          <ChatMessage key={m.id} role={m.role} content={m.content} citations={m.citations} resolveNoteTitle={resolveNoteTitle} />
        ))}
        {(sending || insighting) && <p className="text-[11px] italic" style={{ color: 'var(--silica)' }}>Lamplight is reflecting…</p>}
        {error && (
          <p className="text-[11px]" style={{ color: '#b45454' }}>
            Couldn't reach Lamplight ({error}). Try again.
          </p>
        )}
      </div>
      <div className="p-2.5 flex gap-2 items-center" style={{ borderTop: '1px solid var(--pale-stone)' }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder="Ask about this passage…"
          className="flex-1 text-[12px] px-3 py-1.5 rounded-full"
          style={{ background: '#fff', border: '1px solid var(--pale-stone)', color: 'var(--deep-umber)' }}
        />
        <button
          aria-label="Send"
          onClick={() => void send()}
          disabled={sending || !draft.trim()}
          className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-40"
          style={{ background: '#C49A78', color: '#fff' }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
