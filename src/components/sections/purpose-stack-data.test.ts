// src/components/sections/purpose-stack-data.test.ts
import { describe, it, expect } from 'vitest';
import { computePillData } from './purpose-stack-data';
import type { Project } from '@/types';
import type { Devotion } from '@/data/devotions';

const baseProject: Project = {
  id: 'strength',
  name: 'Restoration 03',
  category: 'residential',
  thumbnail: '/mid_section/restoration5.webp',
  images: ['/mid_section/restoration5.webp'],
  overlayColor: '#A09688',
};

const baseDevotion: Devotion = {
  id: 'strength',
  label: 'The Restoration of Strength',
  title: 'Wings Like Eagles',
  scriptureRef: 'Isaiah 40:31',
  monogram: 'ST',
  firstMoodboardImage: '/restoration5/img1.png',
};

describe('computePillData — with devotion attached', () => {
  it('uses devotion title, derives short category from label, includes scripture ref', () => {
    const data = computePillData(baseProject, baseDevotion);
    expect(data.label).toBe('Devotion');
    expect(data.title).toBe('Wings Like Eagles');
    expect(data.category).toBe('Strength');
    expect(data.scripture).toBe('Isaiah 40:31');
  });

  it('uses project.thumbnail as left image, devotion.firstMoodboardImage as right image', () => {
    const data = computePillData(baseProject, baseDevotion);
    expect(data.leftImage).toBe('/mid_section/restoration5.webp');
    expect(data.rightImage).toBe('/restoration5/img1.png');
  });

  it('uses project.overlayColor as synchronous fallback pill color', () => {
    const data = computePillData(baseProject, baseDevotion);
    expect(data.pillColor).toBe('#A09688');
  });

  it('strips "The Restoration of" and "Serenity of" prefixes from category label', () => {
    expect(computePillData(baseProject, { ...baseDevotion, label: 'The Restoration of Strength' }).category).toBe('Strength');
    expect(computePillData(baseProject, { ...baseDevotion, label: 'Restoration of Hope' }).category).toBe('Hope');
    expect(computePillData(baseProject, { ...baseDevotion, label: 'The Serenity of Trust' }).category).toBe('Trust');
    expect(computePillData(baseProject, { ...baseDevotion, label: 'Serenity of Forgiveness' }).category).toBe('Forgiveness');
  });
});

describe('computePillData — without devotion (fallback)', () => {
  it('uses project.name as title, categoryLabel as category, empty scripture', () => {
    const data = computePillData(baseProject, undefined);
    expect(data.title).toBe('Restoration 03');
    expect(data.category).toBe('Restoration'); // residential → "Restoration"
    expect(data.scripture).toBe('');
  });

  it('uses project.images[1] as right image when available, else project.thumbnail', () => {
    const withSecond: Project = { ...baseProject, images: ['/a.png', '/b.png'] };
    expect(computePillData(withSecond, undefined).rightImage).toBe('/b.png');

    const withOnlyOne: Project = { ...baseProject, images: ['/a.png'] };
    expect(computePillData(withOnlyOne, undefined).rightImage).toBe('/mid_section/restoration5.webp'); // thumbnail
  });
});
