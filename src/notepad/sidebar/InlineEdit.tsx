import { useCallback, useEffect, useRef, useState } from 'react';

interface InlineEditProps {
  value: string;
  onSave: (next: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function InlineEdit({ value, onSave, className, style }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      inputRef.current?.select();
    }
  }, [editing, value]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  }, [draft, value, onSave]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          ...style,
          background: 'rgba(188, 179, 163, 0.15)',
          border: '1px solid var(--pale-stone)',
          borderRadius: 3,
          padding: '1px 4px',
          outline: 'none',
          width: '100%',
        }}
        className={className}
      />
    );
  }

  return (
    <span
      className={className}
      style={style}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
    >
      {value}
    </span>
  );
}
