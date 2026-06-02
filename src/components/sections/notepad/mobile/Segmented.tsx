export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <div
      role="group"
      className="flex gap-1 p-1 rounded-full"
      style={{ background: 'var(--pale-stone)', fontFamily: 'Outfit, sans-serif' }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className="flex-1 text-[12px] font-medium rounded-full transition-colors"
            style={{
              padding: '7px 0',
              background: selected ? 'var(--deep-umber)' : 'transparent',
              color: selected ? 'var(--plaster)' : 'var(--silica)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
