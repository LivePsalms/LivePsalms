import { useIsMobile } from '@/hooks/use-mobile';
import { HeaderDesktop, type HeaderProps } from './HeaderDesktop';
import { HeaderMobile } from './HeaderMobile';

export type { HeaderProps };

export function Header(props: HeaderProps) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <HeaderMobile onNavTrigger={props.onNavTrigger} />;
  }
  return <HeaderDesktop {...props} />;
}
