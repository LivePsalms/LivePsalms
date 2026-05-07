import { PenLine, Mic, Sparkles, type LucideIcon } from 'lucide-react';
import type { NoteType } from './types';

export interface NoteTypeConfig {
  icon: LucideIcon;
  color: string;
  label: string;
}

export const NOTE_TYPE_CONFIG: Record<NoteType, NoteTypeConfig> = {
  devotion: { icon: PenLine, color: '#6B8B7A', label: 'Devotion' },
  sermon: { icon: Mic, color: '#7A9BAE', label: 'Sermon' },
  theme: { icon: Sparkles, color: '#D4A0A0', label: 'Theme' },
};
