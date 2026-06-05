import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { ConnectionCardsState } from '../../hooks/useConnectionCards';

type EmptyState = Exclude<ConnectionCardsState, { phase: 'ready' }>;

export interface ConnectionCardsEmptyProps {
  state: EmptyState;
  onRetry: () => void;
}

const UI_FONT = 'Outfit, sans-serif';
const SERIF_FONT = 'Cormorant Garamond, serif';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center min-h-[260px] px-8 py-10"
      style={{ background: 'var(--alabaster)' }}
    >
      {children}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xl mb-2"
      style={{ color: 'var(--deep-umber)', fontFamily: SERIF_FONT }}
    >
      {children}
    </p>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-sm leading-relaxed max-w-[18rem]"
      style={{ color: 'var(--silica)', fontFamily: UI_FONT }}
    >
      {children}
    </p>
  );
}

// Plain-English requirements for a connection to surface. Kept qualitative on
// purpose — no hard numbers — so the copy stays gentle and doesn't drift from
// the (currently dev-loosened) word/vault/similarity thresholds in the hook.
const CONNECTION_CRITERIA = [
  'Your note has enough substance to draw on',
  "You've gathered a handful of notes in your vault",
  'The lamp has finished reading your note',
  'Another note echoes this one',
];

function ConnectionCriteriaDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="mt-5 text-xs underline cursor-pointer"
          style={{ color: 'var(--silica)', fontFamily: UI_FONT }}
        >
          View criteria
        </button>
      </DialogTrigger>
      <DialogContent className="border-0" style={{ background: 'var(--alabaster)' }}>
        <DialogHeader>
          <DialogTitle
            className="text-xl"
            style={{ color: 'var(--deep-umber)', fontFamily: SERIF_FONT, fontWeight: 400 }}
          >
            What lights a connection
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--silica)', fontFamily: UI_FONT }}>
            The lamp surfaces a connection when a few things line up:
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-3">
          {CONNECTION_CRITERIA.map((criterion) => (
            <li
              key={criterion}
              className="flex items-start gap-3 text-sm"
              style={{ color: 'var(--deep-umber)', fontFamily: UI_FONT }}
            >
              <span aria-hidden style={{ color: 'var(--silica)' }}>
                —
              </span>
              <span>{criterion}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function ConnectionCardsEmpty({ state, onRetry }: ConnectionCardsEmptyProps) {
  if (state.phase === 'waiting_for_embedding') {
    return (
      <Frame>
        <Title>The lamp is reading…</Title>
        <p
          role="status"
          aria-live="polite"
          className="text-sm leading-relaxed max-w-[18rem]"
          style={{ color: 'var(--silica)', fontFamily: UI_FONT }}
        >
          It's taking in what you've written — connections will surface here in a moment.
        </p>
      </Frame>
    );
  }

  if (state.phase === 'no_connections') {
    return (
      <Frame>
        <Title>Nothing echoes yet</Title>
        <Body>
          This note stands on its own for now. As your vault grows, the lamp may find
          threads between it and others.
        </Body>
      </Frame>
    );
  }

  if (state.phase === 'error') {
    return (
      <Frame>
        <Title>Couldn't reach the lamp</Title>
        <Body>A brief hiccup — your notes are safe.</Body>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 text-sm underline cursor-pointer"
          style={{ color: 'var(--deep-umber)', fontFamily: UI_FONT }}
        >
          Try again
        </button>
      </Frame>
    );
  }

  if (state.phase === 'inactive') {
    const items = [
      { label: 'Write more in-depth notes', done: state.meetsDepth },
      { label: 'Keep a few more notes in your vault', done: state.meetsVault },
    ];
    return (
      <Frame>
        <Title>No connections lit yet</Title>
        <Body>The lamp finds notes that echo one another. A couple of things help it along:</Body>
        <ul className="mt-5 flex flex-col gap-3 text-left w-full max-w-[18rem]">
          {items.map((item) => (
            <li
              key={item.label}
              data-done={item.done ? 'true' : 'false'}
              className="flex items-start gap-3 text-sm"
              style={{ color: 'var(--deep-umber)', fontFamily: UI_FONT }}
            >
              <span
                aria-hidden
                className="flex-none inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[11px]"
                style={{
                  background: item.done ? 'var(--deep-umber)' : 'var(--pale-stone)',
                  color: item.done ? 'var(--alabaster)' : 'var(--silica)',
                }}
              >
                {item.done ? '✓' : '·'}
              </span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
        <ConnectionCriteriaDialog />
      </Frame>
    );
  }

  // Exhaustiveness: every EmptyState phase is handled above.
  state satisfies never;
  return null;
}
