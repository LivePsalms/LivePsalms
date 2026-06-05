import { useIsMobile } from '@/hooks/use-mobile';
import { HeroDesktop, type HeroProps } from './HeroDesktop';
import { HeroMobile } from './HeroMobile';

export type { HeroProps };

export function Hero(props: HeroProps) {
  const isMobile = useIsMobile();
  return isMobile ? <HeroMobile {...props} /> : <HeroDesktop {...props} />;
}
