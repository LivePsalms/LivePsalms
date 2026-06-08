// src/notepad/bible/BibleStudyPane.tsx
import { useCallback, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuthSession } from '@/auth/context/useAuthSession';
import { useLamplightSettings } from '@/notepad/hooks/useLamplightSettings';
import { useLamplightEntitlement } from '@/notepad/hooks/useLamplightEntitlement';
import type { LamplightAdapter } from '@/notepad/storage/lamplight-adapter';
import { SignInGate } from '@/notepad/components/lamplight/SignInGate';
import { PaywallCard } from '@/notepad/components/lamplight/PaywallCard';
import { LamplightChat } from '@/notepad/components/lamplight/chat/LamplightChat';
import type { InvokeFn } from './lamplight-chat-client';
import { BibleReader, type PassageRef } from './BibleReader';

export interface BibleStudyPaneProps {
  lamplightAdapter: LamplightAdapter | null;
  invoke: InvokeFn;
}

export function BibleStudyPane({ lamplightAdapter, invoke }: BibleStudyPaneProps) {
  const { user } = useAuthSession();
  const userId = user?.id ?? null;
  const [chatOpen, setChatOpen] = useState(false);
  const [passage, setPassage] = useState<PassageRef>({ book: 'jhn', chapter: 1 });

  // Dedupe so an unchanged book/chapter keeps the same state reference. The real
  // BibleReader only fires onPassageChange from a useEffect, but defensive callers
  // (and tests) may re-emit the same passage every render; returning the previous
  // object short-circuits a render loop.
  const handlePassageChange = useCallback((ref: PassageRef) => {
    setPassage((prev) => (prev.book === ref.book && prev.chapter === ref.chapter ? prev : ref));
  }, []);

  // Hooks are always called (Rules of Hooks); they no-op on a null adapter/user.
  const settings = useLamplightSettings({ adapter: lamplightAdapter as LamplightAdapter, userId: lamplightAdapter ? userId : null });
  const entitlement = useLamplightEntitlement({ adapter: lamplightAdapter as LamplightAdapter, userId: lamplightAdapter ? userId : null });

  const renderChatArea = () => {
    if (!user) return <SignInGate />;
    if (settings.isLoading || entitlement.isLoading) {
      return <div className="p-4 text-[11px]" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>Loading…</div>;
    }
    if (!entitlement.hasAccess('chat')) return <PaywallCard />;
    return <LamplightChat book={passage.book} chapter={passage.chapter} userId={user.id} invoke={invoke} />;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end px-3 py-2 shrink-0">
        <button
          onClick={() => setChatOpen((o) => !o)}
          className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider px-2.5 py-1 rounded-full"
          style={{
            fontFamily: 'Outfit, sans-serif',
            background: chatOpen ? '#C49A78' : '#fff',
            color: chatOpen ? '#fff' : '#8a6c50',
            border: '1px solid #e2d7c8',
          }}
        >
          <Sparkles className="w-3 h-3" /> Lamplight Chat {chatOpen ? '●' : '○'}
        </button>
      </div>

      <div className={chatOpen ? 'flex-1 min-h-0 flex flex-col' : 'flex-1 min-h-0'}>
        <div className={chatOpen ? 'flex-1 min-h-0 overflow-hidden' : 'h-full'}>
          <BibleReader onPassageChange={handlePassageChange} />
        </div>
        {chatOpen && (
          <div className="flex-1 min-h-0" style={{ borderTop: '1px solid var(--pale-stone)' }}>
            {renderChatArea()}
          </div>
        )}
      </div>
    </div>
  );
}
