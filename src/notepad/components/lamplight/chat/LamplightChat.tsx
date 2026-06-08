// src/notepad/components/lamplight/chat/LamplightChat.tsx
import { useState, useEffect, useRef } from 'react';
import { useChatThread, type ChatThreadMessage } from '@/notepad/bible/useChatThread';
import { sendChatMessage, requestOpeningInsight, type InvokeFn } from '@/notepad/bible/lamplight-chat-client';
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
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passageKey = `${book}.${chapter}`;
  const [insighting, setInsighting] = useState(false);
  const insightAttempted = useRef<Set<string>>(new Set());
  const livePassageKey = useRef(passageKey);
  livePassageKey.current = passageKey;
  const mounted = useRef(true);

  // Track real unmount. StrictMode runs this setup again on remount, so `mounted`
  // is restored to true and an in-flight insight isn't falsely dropped in dev.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    // Clear any stale "reflecting…" indicator when the passage or thread state changes.
    setInsighting(false);
    if (thread.loading) return;
    if (thread.messages.length > 0) return;
    // Fire at most once per passage per session. Add synchronously BEFORE the request
    // so a StrictMode double-invoke (or rapid re-render) can't trigger a duplicate
    // server insight (which would persist two assistant messages on an empty thread).
    if (insightAttempted.current.has(passageKey)) return;
    insightAttempted.current.add(passageKey);

    setInsighting(true);
    (async () => {
      const res = await requestOpeningInsight(invoke, { book, chapter });
      // Apply only if still mounted and still viewing the passage we requested for.
      // This (not a cleanup cancel) is what makes the single in-flight request survive
      // StrictMode's setup→cleanup→setup, while a genuine passage change discards it.
      if (!mounted.current || livePassageKey.current !== passageKey) return;
      if (res.ok) {
        thread.append([{ id: localId(), role: 'assistant', content: res.reply, citations: res.citations }]);
      }
      setInsighting(false);
    })();
    // `invoke` is a stable client fn reference; omitting it avoids re-firing on every
    // render while passageKey/loading/length capture every real re-trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passageKey, thread.loading, thread.messages.length]);

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

  return (
    <div className="flex flex-col h-full" style={{ background: 'rgba(255,255,255,0.45)', fontFamily: 'Outfit, sans-serif' }}>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {thread.loading && <p className="text-[11px]" style={{ color: 'var(--silica)' }}>Loading conversation…</p>}
        {!thread.loading && thread.messages.length === 0 && (
          <p className="text-[11px]" style={{ color: 'var(--silica)' }}>
            Ask Lamplight about this passage — it draws on your own notes.
          </p>
        )}
        {thread.messages.map((m) => (
          <ChatMessage key={m.id} role={m.role} content={m.content} citations={m.citations} />
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
