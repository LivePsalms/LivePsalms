export interface ScrollToPurposeGridDeps {
  findElementById: (id: string) => HTMLElement | null;
}

export const PURPOSE_GRID_ID = 'projects';

export function scrollToPurposeGrid(deps: ScrollToPurposeGridDeps): void {
  const target = deps.findElementById(PURPOSE_GRID_ID);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
