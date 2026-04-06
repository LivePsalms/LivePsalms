import type { Project } from '@/types';

export const projects: Project[] = [
  {
    id: 'naya',
    name: 'Naya',
    category: 'residential',
    thumbnail: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80',
    ],
    overlayColor: 'bg-orange-500/80',
  },
  {
    id: 'maurice-cafe-st-honore',
    name: 'Maurice Cafe St-Honoré',
    category: 'hospitality',
    thumbnail: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&q=80',
      'https://images.unsplash.com/photo-1600093463592-8e36ae95ef56?w=1200&q=80',
    ],
    overlayColor: 'bg-emerald-600/80',
  },
  {
    id: 'berri',
    name: 'Berri',
    category: 'residential',
    thumbnail: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
      'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=1200&q=80',
    ],
    overlayColor: 'bg-stone-300/80',
  },
  {
    id: 'maurice-cafe-victor-hugo',
    name: 'Maurice Cafe Victor Hugo',
    category: 'hospitality',
    thumbnail: 'https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=1200&q=80',
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80',
    ],
    overlayColor: 'bg-orange-500/80',
  },
  {
    id: 'cook',
    name: 'Cook',
    category: 'hospitality',
    thumbnail: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80',
      'https://images.unsplash.com/photo-1550966871-3ed3c47e2ce2?w=1200&q=80',
    ],
    overlayColor: 'bg-orange-500/80',
  },
  {
    id: 'segur',
    name: 'Segur',
    category: 'residential',
    thumbnail: 'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=1200&q=80',
      'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200&q=80',
    ],
    overlayColor: 'bg-emerald-600/80',
  },
  {
    id: 'tonnenami',
    name: 'Tonnenami',
    category: 'residential',
    location: 'Paris 6',
    year: '2024',
    description: 'Ancien atelier de sculpteur contemporain et intemporel à Saint-Germain-Des-Prés',
    services: [
      { id: '1', name: 'Conception architecturale', number: '01' },
      { id: '2', name: 'Maîtrise d\'œuvre', number: '02' },
      { id: '3', name: 'Menuiserie sur-mesure', number: '03' },
      { id: '4', name: 'Décoration intérieure', number: '04' },
      { id: '5', name: 'Architecture d\'intérieur', number: '05' },
    ],
    area: '110',
    thumbnail: 'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=1200&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80',
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=80',
    ],
    overlayColor: 'bg-stone-300/80',
  },
];

export const galleryImages = [
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=600&q=80',
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80',
  'https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=600&q=80',
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
  'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=600&q=80',
  'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=600&q=80',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=600&q=80',
  'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=600&q=80',
  'https://images.unsplash.com/photo-1600093463592-8e36ae95ef56?w=600&q=80',
];

export const navItems = [
  { label: 'PROJETS', href: '#projects' },
  { label: 'AGENCE', href: '#agency' },
  { label: 'PROCESS', href: '#process' },
  { label: 'SHOP', href: '#shop' },
  { label: 'CONTACT', href: '#contact' },
];
