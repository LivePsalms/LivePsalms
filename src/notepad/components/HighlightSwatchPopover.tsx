// src/notepad/components/HighlightSwatchPopover.tsx
import { filterAssets, type StyleAsset } from '../styles/manifest';

interface Anchor { top: number; left: number; }

interface Props {
  assets: StyleAsset[];
  query: string;
  onQueryChange: (q: string) => void;
  onPick: (swatchId: string) => void;
  onRemove: () => void;
  anchor: Anchor;
}

export function HighlightSwatchPopover({
  assets, query, onQueryChange, onPick, onRemove, anchor,
}: Props) {
  const shown = filterAssets(assets, 'highlight', query);
  return (
    <div
      role="dialog"
      aria-label="Highlight swatches"
      style={{
        position: 'fixed',
        top: anchor.top,
        left: anchor.left,
        zIndex: 60,
        width: 200,
        background: '#fff',
        border: '1px solid var(--pale-stone)',
        borderRadius: 9,
        boxShadow: '0 8px 22px rgba(0,0,0,.16)',
        padding: 8,
      }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search…"
          aria-label="Search highlights"
          style={{ flex: 1, fontSize: 12, padding: '3px 6px', border: '1px solid var(--pale-stone)', borderRadius: 6 }}
        />
        <button aria-label="Remove highlight" onClick={onRemove}
          style={{ fontSize: 11, border: '1px solid var(--pale-stone)', borderRadius: 6, padding: '0 8px', cursor: 'pointer' }}>
          ✕
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
        {shown.map((a) => (
          <button
            key={a.id}
            aria-label={`Highlight ${a.id}`}
            onClick={() => onPick(a.id)}
            style={{ height: 26, border: '1px solid var(--pale-stone)', borderRadius: 5, overflow: 'hidden', background: '#fff', cursor: 'pointer', padding: 0 }}
          >
            <img src={a.thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </button>
        ))}
      </div>
    </div>
  );
}
