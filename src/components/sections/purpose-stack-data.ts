// src/components/sections/purpose-stack-data.ts
import type { Project } from '@/types';
import type { Devotion } from '@/data/devotions';
import { categoryLabel } from '@/data/projects';

export interface PillData {
  label: string;
  title: string;
  category: string;
  scripture: string;
  leftImage: string;
  rightImage: string;
  pillColor: string;
}

const CATEGORY_PREFIX = /^(The )?(Restoration of |Serenity of )/;

export function computePillData(
  project: Project,
  devotion: Devotion | undefined
): PillData {
  if (devotion) {
    return {
      label: 'Devotion',
      title: devotion.title,
      category: devotion.label.replace(CATEGORY_PREFIX, ''),
      scripture: devotion.scriptureRef,
      leftImage: project.thumbnail,
      rightImage: devotion.firstMoodboardImage,
      pillColor: project.overlayColor,
    };
  }

  return {
    label: 'Devotion',
    title: project.name,
    category: categoryLabel[project.category],
    scripture: '',
    leftImage: project.thumbnail,
    rightImage: project.images[1] ?? project.thumbnail,
    pillColor: project.overlayColor,
  };
}
