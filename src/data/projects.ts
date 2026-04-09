import type { Project } from '@/types';

// Project entries for the editorial mosaic. Each image under
// public/mid_section is named by its category so it can be wired directly
// into the grid. IDs and display names are derived from the filename.
const restorationImages = [
  'restoration1.png',
  'restoration2.png',
  'restoration3.jpg',
  'restoration4.jpg',
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
  'renewal5.jpg',
  'renewal6.png',
  'renewal7.png',
  'renewal8.png',
  'renewal9.png',
];

const serenityImages = [
  'serenity2.jpg',
  'serenity3.png',
  'serenity5.png',
  'serenity6.png',
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

export const projects: Project[] = [
  ...restorationImages.map((file, i) =>
    toProject(file, 'residential', `Restoration ${String(i + 1).padStart(2, '0')}`, 'bg-stone-300/80')
  ),
  ...renewalImages.map((file, i) =>
    toProject(file, 'retail', `Renewal ${String(i + 1).padStart(2, '0')}`, 'bg-emerald-600/80')
  ),
  ...serenityImages.map((file, i) =>
    toProject(file, 'hospitality', `Serenity ${String(i + 1).padStart(2, '0')}`, 'bg-orange-500/80')
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
  { label: 'PROJETS', href: '#projects' },
  { label: 'AGENCE', href: '#agency' },
  { label: 'PROCESS', href: '#process' },
  { label: 'SHOP', href: '#shop' },
  { label: 'CONTACT', href: '#contact' },
];
