import { useAuthSession } from '@/auth/context/useAuthSession';
import type { LamplightAdapter } from '../../storage/lamplight-adapter';
import type { Note } from '../../types';
import { useLamplightSettings } from '../../hooks/useLamplightSettings';
import { useLamplightEntitlement } from '../../hooks/useLamplightEntitlement';
import { useConnectionCards } from '../../hooks/useConnectionCards';
import { SignInGate } from './SignInGate';
import { ConsentCard } from './ConsentCard';
import { OptedOutCard } from './OptedOutCard';
import { TodaysLampCard } from './TodaysLampCard';
import { PaywallCard } from './PaywallCard';
import { ConnectionCardsLoading } from './ConnectionCardsLoading';
import { ConnectionCardsSection } from './ConnectionCardsSection';

export interface LamplightTabPanelProps {
  lamplightAdapter: LamplightAdapter;
  activeNote?: Note | null;
  totalNoteCount?: number;
  loadNeighborNotes?: (ids: string[]) => Promise<Note[]>;
  onOpenNote?: (noteId: string) => void;
}

export function LamplightTabPanel({
  lamplightAdapter,
  activeNote = null,
  totalNoteCount = 0,
  loadNeighborNotes,
  onOpenNote,
}: LamplightTabPanelProps) {
  const { user } = useAuthSession();
  const userId = user?.id ?? null;

  const settingsState = useLamplightSettings({ adapter: lamplightAdapter, userId });
  const entitlementState = useLamplightEntitlement({ adapter: lamplightAdapter, userId });
  const connections = useConnectionCards({
    adapter: lamplightAdapter,
    userId: userId ?? '',
    activeNote,
    totalNoteCount,
    loadNeighborNotes: loadNeighborNotes ?? (async () => []),
  });

  if (!user) return <SignInGate />;

  if (settingsState.isLoading || entitlementState.isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-[420px]"
        style={{ background: 'var(--alabaster)' }}
      >
        <p
          className="text-xs"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Loading…
        </p>
      </div>
    );
  }

  if (settingsState.settings === null) {
    return (
      <ConsentCard
        onTurnOn={({ voicePreference, traditionHint }) =>
          settingsState.upsert({
            enabled: true,
            voicePreference,
            traditionHint,
            consentDecidedAt: new Date().toISOString(),
          })
        }
        onMaybeLater={() =>
          settingsState.upsert({
            enabled: false,
            consentDecidedAt: new Date().toISOString(),
          })
        }
      />
    );
  }

  if (!settingsState.settings.enabled) {
    return <OptedOutCard onChangeMind={() => settingsState.deleteAll()} />;
  }

  if (!entitlementState.hasAccess('today')) {
    return <PaywallCard />;
  }

  // Connection Cards branch (sub-project 5): when a qualifying note is open
  // and embeddings + neighbors exist, swap TodaysLampCard for Connections.
  // Stable not-qualifying states (`inactive`, `no_connections`, `error`) fall
  // back to TodaysLampCard; the transient `waiting_for_embedding` state
  // shows a small placeholder.
  if (connections.state.phase === 'waiting_for_embedding') {
    return <ConnectionCardsLoading />;
  }
  if (connections.state.phase === 'ready') {
    return (
      <ConnectionCardsSection
        cards={connections.state.cards}
        onExpand={connections.expandCard}
        onRetry={connections.retryWhy}
        onOpenNote={onOpenNote ?? (() => {})}
      />
    );
  }

  const localDate = new Date().toLocaleDateString('en-CA');
  return (
    <TodaysLampCard
      adapter={lamplightAdapter}
      userId={user.id}
      localDate={localDate}
      voicePreference={settingsState.settings.voicePreference}
      traditionHint={settingsState.settings.traditionHint}
    />
  );
}
