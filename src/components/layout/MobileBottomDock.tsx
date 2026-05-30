import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { navItems, NAV_TRIGGER_LABELS } from '@/data/projects';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScrollDirection } from '@/hooks/use-scroll-direction';

interface MobileBottomDockProps {
  onNavTrigger?: () => void;
}

/**
 * Floating bottom dock for the mobile viewport (< 768px). Replaces the old
 * top `HeaderMobile`. Always visible at the top of the page; hides on
 * scroll-down; reveals on scroll-up. Logo links to "/", MENU pill opens the
 * same right-side Sheet drawer the old Header used. The pill background is
 * permanently `--deep-umber` and the logo is permanently inverted to white
 * — unlike the old transparent Header, the opaque pill doesn't need
 * nav-theme color reactivity.
 */
export function MobileBottomDock({ onNavTrigger }: MobileBottomDockProps) {
  const isMobile = useIsMobile();
  const dir = useScrollDirection();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!isMobile) return null;

  const visible = dir !== 'down';

  return (
    <aside
      data-testid="mobile-bottom-dock"
      data-visible={visible ? 'true' : 'false'}
      aria-label="Quick navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-300 motion-reduce:transition-none"
      style={{ transform: visible ? 'translateY(0)' : 'translateY(calc(100% + 1rem))' }}
    >
      <div className="pointer-events-auto flex items-center gap-2">
        <Link
          to="/"
          aria-label="Home"
          className="h-11 w-11 rounded-xl bg-[color:var(--deep-umber)] inline-flex items-center justify-center"
        >
          <img
            src="/logo-icon.png"
            alt=""
            className="h-6 w-6 object-contain"
            style={{ filter: 'invert(1)' }}
          />
        </Link>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open menu"
              className="h-11 px-6 rounded-full bg-[color:var(--deep-umber)] text-white text-xs font-semibold tracking-[0.14em]"
            >
              MENU
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-3/4 sm:w-1/2 bg-[color:var(--deep-umber)] text-white"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <nav className="mt-12 flex flex-col gap-6 text-lg" aria-label="Mobile primary">
              {navItems.map((item) => (
                <SheetClose asChild key={item.label}>
                  <Link
                    to={item.href}
                    className="block py-3 min-h-[44px]"
                    onClick={() => {
                      if (NAV_TRIGGER_LABELS.has(item.label)) onNavTrigger?.();
                    }}
                  >
                    {item.label}
                  </Link>
                </SheetClose>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </aside>
  );
}
