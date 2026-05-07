export interface UserProfile {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  avatarUrl: string | null;
  noteCount: number;
  highestNoteCount: number;
  createdAt: string;
  updatedAt: string;
}

export type ProfileStatus = 'loading' | 'loaded' | 'missing' | 'error';
