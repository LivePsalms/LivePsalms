import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { navItems, NAV_TRIGGER_LABELS } from '@/data/projects';
import { subscribeNavTheme, getNavTheme } from '@/lib/nav-theme';

interface HeaderMobileProps {
  onNavTrigger?: () => void;
}

/**
 * Compact top bar for the mobile viewport (< 768px). 'A' logomark left,
 * hamburger right. Hamburger opens a right-side Sheet drawer with the same
 * nav items as desktop. No scroll-collapse choreography — the static bar
 * replaces it.
 *
 * Bar background matches HeroMobile's `--app-bg` taupe so the chrome
 * visually merges with the page. The 'A' logomark inverts when the active
 * page section publishes `nav-theme = 'dark'` (see `@/lib/nav-theme`).
 *
 * The drawer (`SheetContent`) keeps the dark deep-umber background — that's
 * a separate surface intentionally contrasted from the page.
 */
export function HeaderMobile({ onNavTrigger }: HeaderMobileProps) {
  const [open, setOpen] = useState(false);
  const [isDarkBg, setIsDarkBg] = useState<boolean>(() => getNavTheme() === 'dark');

  useEffect(() => {
    return subscribeNavTheme((theme) => setIsDarkBg(theme === 'dark'));
  }, []);

  return (
    <header
      data-testid="header-mobile"
      className="fixed top-0 left-0 right-0 z-40 h-14 px-4 flex items-center justify-between bg-[color:var(--app-bg)]/90 backdrop-blur-sm text-[color:var(--deep-umber)]"
      role="banner"
    >
      <Link to="/" className="block">
        <img
          src="/logo-icon.png"
          alt="LivePsalms"
          className="h-8 w-auto object-contain"
          style={{
            filter: isDarkBg ? 'invert(1)' : 'invert(0)',
            transition: 'filter 300ms ease',
          }}
        />
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open menu"
            className="h-11 w-11 inline-flex items-center justify-center"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
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
    </header>
  );
}
