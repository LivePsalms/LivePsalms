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
          It's quietly taking in what you've written — connections will surface here in a moment.
        </p>
      </Frame>
    );
  }

  if (state.phase === 'no_connections') {
    return (
      <Frame>
        <Title>Nothing echoes yet</Title>
        <Body>
          This note stands on its own for now. As your vault grows, the lamp may find quiet
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

  // inactive — checklist
  const items = [
    { label: 'Write a note with some depth', done: state.meetsDepth },
    { label: 'Keep a few more notes in your vault', done: state.meetsVault },
  ];
  return (
    <Frame>
      <Title>No connections lit yet</Title>
      <Body>The lamp finds notes that quietly echo one another. A couple of things help it along:</Body>
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
    </Frame>
  );
}
