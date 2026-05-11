import type { Project } from '@/types';

/** Warm taupe — used as the default overlay when no colour is available. */
export const FALLBACK_OVERLAY_COLOR = '#8B8378';
export const FALLBACK_RENEWAL_COLOR = '#5A7A6A';
export const FALLBACK_SERENITY_COLOR = '#B08A6A';

export const categoryLabel: Record<Project['category'], string> = {
  residential: 'Restoration',
  retail: 'Renewal',
  hospitality: 'Serenity',
};

// Project entries for the editorial mosaic. Each image under
// public/mid_section is named by its category so it can be wired directly
// into the grid. IDs and display names are derived from the filename.
const restorationImages = [
  'restoration1.png',
  'restoration3.jpg',
  'restoration5.png',
  'restoration6.png',
  'restoration7.png',
  'restoration8.png',
  'restoration9.png',
  'restoration10.png',
];

const renewalImages = [
  'renewal1.png',
  'renewal3.png',
  'renewal4.png',
  'renewal6.png',
  'renewal8.png',
  'renewal9.png',
];

const serenityImages = [
  'serenity2.png',
  'serenity3.png',
  'serenity5.png',
  'serenity7.png',
];

// Devotional slugs override the default filename-derived id for projects that
// have a written devotion attached. The URL becomes /purpose/<slug> instead of
// /purpose/<filename>.
const idOverrides: Record<string, string> = {
  restoration5: 'strength',
  restoration6: 'wholeness',
  restoration7: 'purpose',
  restoration8: 'connection',
  restoration9: 'identity',
  restoration10: 'joy',
  serenity2: 'forgiveness',
  serenity3: 'surrender',
  serenity5: 'trust',
};

const toProject = (
  file: string,
  category: Project['category'],
  displayName: string,
  overlayColor: string
): Project => {
  const baseId = file.replace(/\.(png|jpg|jpeg|webp)$/i, '');
  const id = idOverrides[baseId] ?? baseId;
  const src = `/mid_section/${file}`;
  return {
    id,
    name: displayName,
    category,
    thumbnail: src,
    images: [src],
    overlayColor,
  };
};

// Per-image solid overlay colours sampled to complement each photograph.
const restorationOverlays = [
  '#8B8378', // warm taupe
  '#7A7568', // grey-brown
  '#A09688', // sand
  '#6E6960', // dark stone
  '#9C9488', // pale clay
  '#8A8070', // muted umber
  '#7D756A', // driftwood
  '#938A7E', // putty
  '#B0A898', // linen
];
const renewalOverlays = [
  '#5A7A6A', // forest sage
  '#6B8B7A', // muted jade
  '#4E6E5E', // deep moss
  '#7A9A8A', // celadon
  '#5E7E6E', // olive sage
  '#6A8A7A', // fern
];
const serenityOverlays = [
  '#B08A6A', // warm ochre
  '#C49A78', // terracotta
  '#A8866A', // burnt sienna
  '#BFA080', // dusty coral
  '#C4A488', // sand gold
];

export const projects: Project[] = [
  ...restorationImages.map((file, i) =>
    toProject(file, 'residential', `Restoration ${String(i + 1).padStart(2, '0')}`, restorationOverlays[i] ?? FALLBACK_OVERLAY_COLOR)
  ),
  ...renewalImages.map((file, i) =>
    toProject(file, 'retail', `Renewal ${String(i + 1).padStart(2, '0')}`, renewalOverlays[i] ?? FALLBACK_RENEWAL_COLOR)
  ),
  ...serenityImages.map((file, i) =>
    toProject(file, 'hospitality', `Serenity ${String(i + 1).padStart(2, '0')}`, serenityOverlays[i] ?? FALLBACK_SERENITY_COLOR)
  ),
];

export const navItems = [
  { label: 'PURPOSE', href: '/purpose' },
  { label: 'NOTEPAD', href: '/notepad' },
  { label: 'DEVOTION', href: '#devotion' },
  { label: 'SHOP', href: '#shop' },
  { label: 'CONTACT', href: '#contact' },
];
