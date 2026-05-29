/**
 * GSAP duration scaling for mobile. Mobile timings = desktop × this value.
 * Source of truth for "snappier on mobile" per the mobile home page spec.
 */
export const MOBILE_TIME_SCALE = 0.7;

export function scaleForMobile(desktopDuration: number, isMobile: boolean): number {
  return isMobile ? desktopDuration * MOBILE_TIME_SCALE : desktopDuration;
}
