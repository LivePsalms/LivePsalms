import { categoryLabel } from '@/data/projects';
import type { FilterCategory, Project } from '@/types';
import {
  TextStaggerHover,
  TextStaggerHoverActive,
  TextStaggerHoverHidden,
} from '@/components/ui/text-stagger-hover';

interface FilterTabsProps {
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
}

const filters: { label: string; value: FilterCategory }[] = (
  Object.entries(categoryLabel) as [Project['category'], string][]
).map(([value, label]) => ({ label, value }));

function WaterButton({
  children,
  className,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const text = typeof children === 'string' ? children : '';

  return (
    <TextStaggerHover
      as="button"
      className={className}
      style={style}
      {...props}
    >
      <TextStaggerHoverActive animation="blur">{text}</TextStaggerHoverActive>
      <TextStaggerHoverHidden animation="blur">{text}</TextStaggerHoverHidden>
    </TextStaggerHover>
  );
}

export function FilterTabs({ activeFilter, onFilterChange }: FilterTabsProps) {
  return (
    <div className="flex items-center justify-center gap-6 md:gap-10 pt-0 pb-3 md:pb-4 mb-4 md:mb-6">
      {filters.map((filter) => (
        <span key={filter.value} className="relative group">
          <WaterButton
            onClick={() => onFilterChange(filter.value)}
            className="relative text-xs md:text-sm tracking-[0.15em] uppercase transition-all duration-300 cursor-pointer"
            style={{
              fontFamily: 'Outfit, sans-serif',
              color: activeFilter === filter.value ? 'var(--deep-umber)' : 'var(--text-muted)',
            }}
          >
            {filter.label}
          </WaterButton>
          <span
            className={`absolute -bottom-1 left-0 h-px transition-all duration-300 ${
              activeFilter === filter.value ? 'w-full' : 'w-0 group-hover:w-full'
            }`}
            style={{
              background: activeFilter === filter.value ? 'var(--deep-umber)' : 'var(--text-muted)',
            }}
          />
        </span>
      ))}
    </div>
  );
}
