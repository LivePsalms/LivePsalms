interface HeaderMobileProps {
  onNavTrigger?: () => void;
}

/**
 * No-op stub. The MobileBottomDock replaces the mobile header — see
 * `src/components/layout/MobileBottomDock.tsx`. This file is kept so the
 * `Header.tsx` dispatcher's mobile branch import doesn't have to change,
 * and so a future re-enable is a one-line revert.
 */
export function HeaderMobile(_props: HeaderMobileProps) {
  return null;
}
