import type { Project } from '@/types';

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
  'serenity2.jpg',
  'serenity3.png',
  'serenity5.png',
  'serenity7.png',
];

const toProject = (
  file: string,
  category: Project['category'],
  displayName: string,
  overlayColor: string
): Project => {
  const id = file.replace(/\.(png|jpg|jpeg|webp)$/i, '');
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
    toProject(file, 'residential', `Restoration ${String(i + 1).padStart(2, '0')}`, restorationOverlays[i] ?? '#8B8378')
  ),
  ...renewalImages.map((file, i) =>
    toProject(file, 'retail', `Renewal ${String(i + 1).padStart(2, '0')}`, renewalOverlays[i] ?? '#5A7A6A')
  ),
  ...serenityImages.map((file, i) =>
    toProject(file, 'hospitality', `Serenity ${String(i + 1).padStart(2, '0')}`, serenityOverlays[i] ?? '#B08A6A')
  ),
];

export const galleryImages = [
  '/mid_section/restoration1.jpg',
  '/mid_section/restoration2.jpg',
  '/mid_section/renewal1.png',
  '/mid_section/serenity2.jpg',
  '/mid_section/restoration3.jpg',
  '/mid_section/renewal3.png',
  '/mid_section/serenity3.jpg',
  '/mid_section/restoration5.png',
  '/mid_section/renewal4.png',
  '/mid_section/serenity6.png',
];

export const navItems = [
  { label: 'PURPOSE', href: '/purpose' },
  { label: 'DEVOTION', href: '#devotion' },
  { label: 'SHOP', href: '#shop' },
  { label: 'CONTACT', href: '#contact' },
];
