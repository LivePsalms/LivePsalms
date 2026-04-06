export interface Project {
  id: string;
  name: string;
  category: 'residential' | 'retail' | 'hospitality';
  location?: string;
  year?: string;
  description?: string;
  services?: Service[];
  area?: string;
  thumbnail: string;
  images: string[];
  overlayColor: string;
}

export interface Service {
  id: string;
  name: string;
  number: string;
}

export type FilterCategory = 'all' | 'residential' | 'retail' | 'hospitality';

export interface NavItem {
  label: string;
  href: string;
}
