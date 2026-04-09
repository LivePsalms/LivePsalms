import type { FilterCategory } from '@/types';

interface FilterTabsProps {
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
}

const filters: { label: string; value: FilterCategory }[] = [
  { label: 'Restoration', value: 'residential' },
  { label: 'Renewal', value: 'retail' },
  { label: 'Serenity', value: 'hospitality' },
];

export function FilterTabs({ activeFilter, onFilterChange }: FilterTabsProps) {
  return (
    <div className="flex items-center justify-center gap-6 md:gap-10 pt-0 pb-3 md:pb-4 mb-4 md:mb-6">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onFilterChange(filter.value)}
          className="relative text-xs md:text-sm tracking-[0.15em] uppercase transition-all duration-300"
          style={{
            fontFamily: 'Outfit, sans-serif',
            color: activeFilter === filter.value ? 'var(--deep-umber)' : 'var(--warm-sand)',
          }}
        >
          {filter.label}
          <span
            className="absolute -bottom-1 left-0 h-px transition-all duration-300"
            style={{
              background: 'var(--deep-umber)',
              width: activeFilter === filter.value ? '100%' : '0%',
            }}
          />
        </button>
      ))}
    </div>
  );
}
