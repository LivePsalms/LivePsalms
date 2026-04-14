import { useState } from 'react';
import { categoryLabel } from '@/data/projects';
import type { FilterCategory, Project } from '@/types';

interface FilterTabsProps {
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
}

const filters: { label: string; value: FilterCategory }[] = (
  Object.entries(categoryLabel) as [Project['category'], string][]
).map(([value, label]) => ({ label, value }));

function WaterButton({ children, className, style, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const [isHovered, setIsHovered] = useState(false);
  const text = typeof children === 'string' ? children : '';

  return (
    <button
      className={className}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {text.split('').map((char, i) => (
        <span
          key={i}
          className="inline-block"
          style={{
            animation: isHovered ? `water-letter 2.4s ease-in-out ${Math.abs(i - (text.length - 1) / 2) * 100}ms infinite` : 'none',
            transition: 'transform 0.3s ease',
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </button>
  );
}

export function FilterTabs({ activeFilter, onFilterChange }: FilterTabsProps) {
  return (
    <div className="flex items-center justify-center gap-6 md:gap-10 pt-0 pb-3 md:pb-4 mb-4 md:mb-6">
      {filters.map((filter) => (
        <span key={filter.value} className="relative">
          <WaterButton
            onClick={() => onFilterChange(filter.value)}
            className="relative text-xs md:text-sm tracking-[0.15em] uppercase transition-all duration-300"
            style={{
              fontFamily: 'Outfit, sans-serif',
              color: activeFilter === filter.value ? 'var(--deep-umber)' : 'var(--warm-sand)',
            }}
          >
            {filter.label}
          </WaterButton>
          <span
            className="absolute -bottom-1 left-0 h-px transition-all duration-300"
            style={{
              background: 'var(--deep-umber)',
              width: activeFilter === filter.value ? '100%' : '0%',
            }}
          />
        </span>
      ))}
    </div>
  );
}
