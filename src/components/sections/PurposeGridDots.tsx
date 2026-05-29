import { cn } from '@/lib/utils';

interface PurposeGridDotsProps {
  projects: Array<{ id: string; name?: string }>;
  activeId: string | null;
}

export function PurposeGridDots({ projects, activeId }: PurposeGridDotsProps) {
  return (
    <div
      data-testid="purpose-grid-dots"
      className="md:hidden flex justify-center gap-1.5 mt-4"
      aria-hidden="true"
    >
      {projects.map((p) => {
        const active = p.id === activeId;
        return (
          <span
            key={p.id}
            role="presentation"
            data-active={active ? 'true' : 'false'}
            className={cn(
              'h-1.5 w-1.5 rounded-full bg-current transition-opacity duration-200',
              active ? 'opacity-100' : 'opacity-30',
            )}
          />
        );
      })}
    </div>
  );
}
