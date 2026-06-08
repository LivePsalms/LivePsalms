// src/notepad/components/lamplight/chat/ChatMessage.tsx
import { bookByAbbrev } from '@/notepad/bible/bible-books';
import type { ChatCitation } from '@/notepad/bible/lamplight-chat-client';

export interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  citations: ChatCitation[];
}

/** "jhn 10:11" → "John 10:11"; notes pass through as-is (label resolved by caller upstream if needed). */
function humanizeRef(c: ChatCitation): string {
  if (c.type === 'verse') {
    const m = c.ref.match(/^([0-9a-z]{3})\s+(.+)$/i);
    if (m) return `${bookByAbbrev(m[1].toLowerCase())?.name ?? m[1]} ${m[2]}`;
  }
  return c.ref;
}

export function ChatMessage({ role, content, citations }: ChatMessageProps) {
  const isUser = role === 'user';
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className="max-w-[85%] text-[12px] leading-[1.55] p-2.5"
        style={{
          fontFamily: 'Outfit, sans-serif',
          borderRadius: isUser ? '11px 11px 3px 11px' : '11px 11px 11px 3px',
          background: isUser ? '#C49A78' : '#fff',
          color: isUser ? '#fff' : '#4a4136',
          border: isUser ? 'none' : '1px solid #ece2d4',
        }}
      >
        <span>{content}</span>
        {!isUser && citations.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {citations.map((c, i) => (
              <span
                key={`${c.type}-${c.ref}-${i}`}
                className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(122,155,174,0.14)', color: '#5d7c8b', border: '1px solid rgba(122,155,174,0.3)' }}
              >
                <span aria-hidden="true">↳ </span>
                {humanizeRef(c)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
