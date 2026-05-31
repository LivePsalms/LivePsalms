import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { navItems, NAV_TRIGGER_LABELS } from '@/data/projects';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { useAdaptiveDockTheme } from '@/hooks/use-adaptive-dock-theme';

interface MobileBottomDockProps {
  onNavTrigger?: () => void;
}

/**
 * Floating bottom dock for the mobile viewport (< 768px). Replaces the old
 * top `HeaderMobile`. Always visible at the top of the page; hides on
 * scroll-down; reveals on scroll-up. Tapping MENU expands a bottom-up
 * disclosure panel above the dock row; tapping CLOSE MENU collapses it.
 * Panel uses the WAI-ARIA Disclosure pattern (not a Dialog) — no backdrop,
 * no focus trap, no body-scroll lock. While the panel is open, the
 * hide-on-scroll-down behavior is suspended so the panel never scrolls
 * out from under the user mid-interaction.
 */
export function MobileBottomDock({ onNavTrigger }: MobileBottomDockProps) {
  const isMobile = useIsMobile();
  const dir = useScrollDirection();
  const [panelOpen, setPanelOpenRaw] = useState(false);
  const [socialExpanded, setSocialExpanded] = useState(false);
  // Detects what's behind the dock so it can invert against dark sections.
  // Hook is unconditionally called (rules of hooks) but it bails out when
  // disabled, and we already return null for the desktop viewport below.
  const bgTheme = useAdaptiveDockTheme(isMobile);

  if (!isMobile) return null;

  const visible = panelOpen ? true : dir !== 'down';

  // Wrapper rather than useEffect([panelOpen]) so the social reset is
  // synchronous with the close, not deferred one render. A deferred reset
  // would briefly leave the Instagram sub-row visible while the panel is
  // already collapsing, producing a flash.
  const setPanelOpen = (next: boolean): void => {
    setPanelOpenRaw(next);
    if (!next) setSocialExpanded(false);
  };

  return (
    <aside
      data-testid="mobile-bottom-dock"
      data-visible={visible ? 'true' : 'false'}
      data-panel-state={panelOpen ? 'open' : 'closed'}
      data-bg={bgTheme}
      aria-label="Quick navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-300 motion-reduce:transition-none"
      style={{ transform: visible ? 'translateY(0)' : 'translateY(calc(100% + 1rem))' }}
    >
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        <div id="mobile-menu-panel" className="menu-panel" aria-hidden={!panelOpen}>
          <ul className="menu-links">
            {navItems.map((item, i) => (
              <li key={item.label} style={{ ['--i' as string]: i + 1 } as CSSProperties}>
                <Link
                  to={item.href}
                  onClick={() => {
                    if (NAV_TRIGGER_LABELS.has(item.label)) onNavTrigger?.();
                  }}
                >
                  {item.label.toUpperCase()}
                </Link>
              </li>
            ))}
            <li
              key="social"
              className="social-row"
              data-social-state={socialExpanded ? 'open' : 'closed'}
              style={{ ['--i' as string]: navItems.length + 1 } as CSSProperties}
            >
              <div className="social-sub" aria-hidden={!socialExpanded}>
                <a
                  id="mobile-social-instagram"
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  INSTAGRAM ↗
                </a>
              </div>
              <button
                type="button"
                className="social-toggle"
                aria-expanded={socialExpanded}
                aria-controls="mobile-social-instagram"
                onClick={() => setSocialExpanded((v) => !v)}
              >
                SOCIAL
              </button>
            </li>
          </ul>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            aria-label="Home"
            className="dock-home h-11 w-11 rounded-xl inline-flex items-center justify-center"
          >
            <img
              src="/logo-icon.png"
              alt=""
              className="h-6 w-6 object-contain"
            />
          </Link>
          <button
            type="button"
            className="menu-toggle h-11 px-6 rounded-full text-white text-xs font-semibold tracking-[0.14em]"
            aria-expanded={panelOpen}
            aria-controls="mobile-menu-panel"
            onClick={() => setPanelOpen(!panelOpen)}
          >
            {/* Both labels are always rendered; CSS display swap shows the
                active one. The mirrored aria-hidden props strip the
                inactive label from the accessible-name tree — required
                because JSDOM in tests doesn't honor display:none for
                accessible-name computation, and useful in real browsers
                for assistive tech that ignores display:none. */}
            <span className="text-menu" aria-hidden={panelOpen}>MENU</span>
            <span className="text-close" aria-hidden={!panelOpen}>CLOSE MENU</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
