// Shared model + helpers for data-driven devotion moodboards.
//
// Each devotion is ONE object with TWO art-directed arrangements that do not
// share section membership: `sections` (the horizontal desktop zones) and
// `mobile` (the vertical stack). Prose is shared through SectionText {full,
// mobile?} constants — desktop renders `full`, mobile renders `mobile ?? full`
// — which lets the same paragraph live in different sections per arrangement
// and be intentionally condensed on mobile (locked decision).
//
// Geometry is preserved verbatim AS DATA (exact Tailwind position fragments and
// inline styles) because the GSAP engine in MoodBoard.tsx sniffs exact class
// tokens (`text-xs`, `mb-text`, `w-[50vw]`, `data-speed`). The renderers
// (MoodBoardZones / MoodBoardStack) own the grammar: BlendRecipe expansion, the
// image-wrapper shape, PhotoDevelopImage construction, and full-vs-mobile text
// selection. The bar is zero visual change.
//
// Individual boards live in sibling files (peace.tsx, hope.tsx, …) and are
// assembled into `moodBoards` by the ../devotion-moodboards.tsx barrel.
import type { ReactNode, CSSProperties } from 'react';

/* ── Types ── */

export type SectionRole =
  | 'title'
  | 'opening'
  | 'scripture'
  | 'principle'
  | 'application'
  | 'prayer';

// Backgrounds are authored as a recipe against the devotion's overlay color,
// expanded by the renderer to a `color-mix(in srgb, …)` string.
export type BlendRecipe =
  | { mix: number; toward: 'app-bg' }
  | { mix: number; toward: 'black'; amount: number };

// Shared prose. Desktop uses `full`; mobile uses `mobile ?? full`.
export interface SectionText {
  full: ReactNode;
  mobile?: ReactNode;
}

// Desktop element: a positioned image wrapper or a positioned text node. The
// className/style are authored verbatim so the GSAP class-sniffing matches.
export type DesktopImage = {
  kind: 'image';
  src: string;
  alt: string;
  /** position fragment placed inside `mb-elem absolute … overflow-hidden` */
  pos: string;
  style?: CSSProperties;
  /** PhotoDevelopImage `className` (the wrapper). Default 'w-full h-full'. */
  imgWrapClassName?: string;
  imgClassName?: string;
  threshold?: number;
  revealed?: boolean;
};
export type DesktopText = {
  kind: 'text';
  tag: 'h2' | 'h3' | 'p' | 'div';
  /** full verbatim className, incl. mb-elem/mb-text/absolute/position/type */
  className: string;
  style?: CSSProperties;
  text: SectionText;
};
export type DesktopElement = DesktopImage | DesktopText;

export interface DesktopSection {
  role: SectionRole;
  /** flex-shrink-0 track width, e.g. '120vw' */
  width: string;
  /** undefined = inherit the section's overlay background */
  bg?: BlendRecipe;
  elements: DesktopElement[];
}

// Mobile element: image, text node, or hairline divider — all verbatim classes.
export type MobileImage = {
  kind: 'image';
  src: string;
  alt: string;
  className: string;
};
export type MobileText = {
  kind: 'text';
  tag: 'h2' | 'h3' | 'p' | 'div';
  className: string;
  style?: CSSProperties;
  text: SectionText;
};
export type MobileDivider = { kind: 'divider'; className: string };
export type MobileElement = MobileImage | MobileText | MobileDivider;

export interface MobileSection {
  role: SectionRole | 'gallery';
  className: string;
  /** undefined = inherit outer base; 'base' = the raw overlay color */
  bg?: BlendRecipe | 'base';
  elements: MobileElement[];
}

export interface DevotionMoodBoard {
  id: string;
  /**
   * The word the RestorationCTA continues ("…restoring your {purposeWord}").
   * It is authored per devotion, NOT derived from the label: the Serenity
   * devotions (forgiveness/surrender/trust) use "Serenity", not their last
   * label word. The renderer prefers this over the parent's derived fallback.
   */
  purposeWord?: string;
  /** overrides project.overlayColor when set; most devotions leave it undefined */
  overlayColor?: string;
  sections: DesktopSection[];
  mobile: MobileSection[];
}

export const CANONICAL_ROLE_ARC: SectionRole[] = [
  'title',
  'opening',
  'scripture',
  'principle',
  'application',
  'prayer',
];

/* ── Renderer-facing helpers ── */

export function blendRecipeToColor(recipe: BlendRecipe, overlay: string): string {
  return recipe.toward === 'app-bg'
    ? `color-mix(in srgb, ${overlay} ${recipe.mix}%, var(--app-bg))`
    : `color-mix(in srgb, ${overlay} ${recipe.mix}%, black ${recipe.amount}%)`;
}

/* ── Test-facing traversal + validation helpers ── */

export function collectImageSources(board: DevotionMoodBoard): string[] {
  const out: string[] = [];
  for (const s of board.sections) {
    for (const el of s.elements) if (el.kind === 'image') out.push(el.src);
  }
  for (const s of board.mobile) {
    for (const el of s.elements) if (el.kind === 'image') out.push(el.src);
  }
  return out;
}

export function collectSectionTexts(
  board: DevotionMoodBoard,
): { where: string; text: SectionText }[] {
  const out: { where: string; text: SectionText }[] = [];
  board.sections.forEach((s, si) =>
    s.elements.forEach((el, ei) => {
      if (el.kind === 'text') out.push({ where: `desktop[${si}:${s.role}][${ei}]`, text: el.text });
    }),
  );
  board.mobile.forEach((s, si) =>
    s.elements.forEach((el, ei) => {
      if (el.kind === 'text') out.push({ where: `mobile[${si}:${s.role}][${ei}]`, text: el.text });
    }),
  );
  return out;
}

export function collectBlendRecipes(
  board: DevotionMoodBoard,
): { where: string; recipe: BlendRecipe }[] {
  const out: { where: string; recipe: BlendRecipe }[] = [];
  board.sections.forEach((s, si) => {
    if (s.bg) out.push({ where: `desktop[${si}:${s.role}]`, recipe: s.bg });
  });
  board.mobile.forEach((s, si) => {
    if (s.bg && s.bg !== 'base') out.push({ where: `mobile[${si}:${s.role}]`, recipe: s.bg });
  });
  return out;
}

// Mobile images render with object-cover, so a slot whose aspect-* class is far
// from the image's native ratio crops a visible band. This surfaces each mobile
// image's src plus the `aspect-*` token from its className for the aspect guard.
export function collectMobileImageSlots(
  board: DevotionMoodBoard,
): { where: string; src: string; aspectClass: string | null }[] {
  const out: { where: string; src: string; aspectClass: string | null }[] = [];
  board.mobile.forEach((s, si) =>
    s.elements.forEach((el, ei) => {
      if (el.kind !== 'image') return;
      const m = el.className.match(/aspect-(?:\[[^\]]+\]|square|video)/);
      out.push({ where: `${board.id} mobile[${si}:${s.role}][${ei}]`, src: el.src, aspectClass: m ? m[0] : null });
    }),
  );
  return out;
}

export function isValidBlendRecipe(recipe: unknown): recipe is BlendRecipe {
  if (!recipe || typeof recipe !== 'object') return false;
  const r = recipe as Record<string, unknown>;
  if (typeof r.mix !== 'number' || r.mix <= 0 || r.mix > 100) return false;
  if (r.toward === 'app-bg') return true;
  if (r.toward === 'black') return typeof r.amount === 'number' && r.amount >= 0 && r.amount <= 100;
  return false;
}
