# User Accounts, Profiles & Gamification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase-backed user accounts, cloud note storage, user profiles, and a "Covenant Fire" gamification tier system to the Psalms notepad app.

**Architecture:** Extend the existing `StorageAdapter` pattern with a `SupabaseStorageAdapter`. Add an `AuthProvider` context that determines which adapter to use (Supabase when logged in, localStorage when anonymous). Gamification is a frontend-only tier computation based on `highest_note_count` stored in the `profiles` table.

**Tech Stack:** React 19, TypeScript, Vite, Supabase (PostgreSQL + Auth + Storage), TipTap, Tailwind CSS, Radix UI, Zod

---

### Task 1: Install Supabase and Create Client

**Files:**
- Modify: `package.json`
- Create: `src/lib/supabase.ts`
- Create: `src/auth/types.ts`

- [ ] **Step 1: Install Supabase SDK**

Run:
```bash
npm install @supabase/supabase-js
```

Expected: `@supabase/supabase-js` added to `package.json` dependencies

- [ ] **Step 2: Create Supabase client**

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables missing. Auth features will be disabled.'
  );
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
```

- [ ] **Step 3: Create auth types**

Create `src/auth/types.ts`:

```typescript
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
```

- [ ] **Step 4: Create `.env.local` template**

Create `.env.local.example`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 5: Add `.env.local` to `.gitignore`**

Append to `.gitignore`:

```
.env.local
```

- [ ] **Step 6: Verify the build still passes**

Run:
```bash
npm run build
```

Expected: Build completes with no errors (supabase client will be `null` without env vars)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/supabase.ts src/auth/types.ts .env.local.example .gitignore
git commit -m "feat: install supabase SDK and create client + auth types"
```

---

### Task 2: Supabase Database Schema (SQL Migrations)

**Files:**
- Create: `supabase/migrations/001_profiles.sql`
- Create: `supabase/migrations/002_notes_folders.sql`
- Create: `supabase/migrations/003_triggers.sql`
- Create: `supabase/migrations/004_storage.sql`

- [ ] **Step 1: Create profiles table migration**

Create `supabase/migrations/001_profiles.sql`:

```sql
-- Profiles table: extends auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  avatar_url text,
  note_count integer not null default 0,
  highest_note_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
```

- [ ] **Step 2: Create notes and folders table migration**

Create `supabase/migrations/002_notes_folders.sql`:

```sql
-- Folders table
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  parent_id uuid references public.folders(id) on delete set null,
  "order" integer not null default 0,
  icon text,
  color text,
  created_at timestamptz not null default now()
);

alter table public.folders enable row level security;

create policy "Users can view own folders"
  on public.folders for select using (auth.uid() = user_id);
create policy "Users can insert own folders"
  on public.folders for insert with check (auth.uid() = user_id);
create policy "Users can update own folders"
  on public.folders for update using (auth.uid() = user_id);
create policy "Users can delete own folders"
  on public.folders for delete using (auth.uid() = user_id);

-- Notes table
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled',
  content text not null default '',
  folder_id uuid references public.folders(id) on delete set null,
  type text not null default 'devotion' check (type in ('devotion', 'sermon', 'theme')),
  tags text[] not null default '{}',
  word_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

create policy "Users can view own notes"
  on public.notes for select using (auth.uid() = user_id);
create policy "Users can insert own notes"
  on public.notes for insert with check (auth.uid() = user_id);
create policy "Users can update own notes"
  on public.notes for update using (auth.uid() = user_id);
create policy "Users can delete own notes"
  on public.notes for delete using (auth.uid() = user_id);
```

- [ ] **Step 3: Create triggers migration**

Create `supabase/migrations/003_triggers.sql`:

```sql
-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update note_count and highest_note_count when notes change
create or replace function public.update_note_count()
returns trigger as $$
declare
  target_user_id uuid;
  new_count integer;
begin
  -- Determine which user to update
  if tg_op = 'DELETE' then
    target_user_id := old.user_id;
  else
    target_user_id := new.user_id;
  end if;

  -- Count qualifying notes (20+ words)
  select count(*) into new_count
  from public.notes
  where user_id = target_user_id and word_count >= 20;

  -- Update profile
  update public.profiles
  set
    note_count = new_count,
    highest_note_count = greatest(highest_note_count, new_count),
    updated_at = now()
  where id = target_user_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_note_change
  after insert or update or delete on public.notes
  for each row execute function public.update_note_count();

-- Auto-update updated_at on notes
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger notes_updated_at
  before update on public.notes
  for each row execute function public.update_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();
```

- [ ] **Step 4: Create storage bucket migration**

Create `supabase/migrations/004_storage.sql`:

```sql
-- Create avatars bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

-- Policy: users can upload their own avatar
create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: users can update their own avatar
create policy "Users can update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: users can delete their own avatar
create policy "Users can delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: avatars are publicly readable (for displaying in UI)
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');
```

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase SQL migrations for profiles, notes, folders, triggers, storage"
```

---

### Task 3: Add `wordCount` to Note Type and Word Count Utility

**Files:**
- Modify: `src/notepad/types.ts`
- Create: `src/notepad/utils/word-count.ts`
- Modify: `src/notepad/storage/local-storage.ts`

- [ ] **Step 1: Add `wordCount` to the Note interface**

In `src/notepad/types.ts`, add `wordCount` to the `Note` interface:

```typescript
export interface Note {
  id: string;
  title: string;
  content: string; // TipTap JSON stringified
  folderId: string;
  type: NoteType;
  tags: string[];
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Create word count utility**

Create `src/notepad/utils/word-count.ts`:

```typescript
/**
 * Extract plain text from a TipTap JSON string and count words.
 * Returns 0 for empty or invalid content.
 */
export function countWordsFromTipTapJSON(jsonString: string): number {
  if (!jsonString) return 0;

  try {
    const doc = JSON.parse(jsonString);
    const text = extractText(doc);
    return countWords(text);
  } catch {
    // If content is plain text (not JSON), count directly
    return countWords(jsonString);
  }
}

function extractText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Record<string, unknown>;

  if (n.type === 'text' && typeof n.text === 'string') {
    return n.text;
  }

  if (Array.isArray(n.content)) {
    return n.content.map(extractText).join(' ');
  }

  return '';
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
```

- [ ] **Step 3: Update LocalStorageAdapter to include wordCount**

In `src/notepad/storage/local-storage.ts`, update `createNote` to set `wordCount`:

Add import at the top:
```typescript
import { countWordsFromTipTapJSON } from '../utils/word-count';
```

Update the `createNote` method:
```typescript
async createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
  const now = new Date().toISOString();
  const newNote: Note = {
    ...note,
    id: uuidv4(),
    wordCount: countWordsFromTipTapJSON(note.content),
    createdAt: now,
    updatedAt: now,
  };
  const notes = this.readNotes();
  notes.push(newNote);
  this.writeNotes(notes);
  return newNote;
}
```

Update the `updateNote` method to recalculate wordCount when content changes:
```typescript
async updateNote(id: string, updates: Partial<Note>): Promise<Note> {
  const notes = this.readNotes();
  const index = notes.findIndex((n) => n.id === id);
  if (index === -1) throw new Error(`Note ${id} not found`);
  const wordCount = updates.content !== undefined
    ? countWordsFromTipTapJSON(updates.content)
    : notes[index].wordCount;
  notes[index] = {
    ...notes[index],
    ...updates,
    wordCount,
    updatedAt: new Date().toISOString(),
  };
  this.writeNotes(notes);
  return notes[index];
}
```

Update `duplicateNote` to carry wordCount:
```typescript
async duplicateNote(id: string): Promise<Note> {
  const note = this.readNotes().find((n) => n.id === id);
  if (!note) throw new Error(`Note ${id} not found`);
  const now = new Date().toISOString();
  const dup: Note = {
    ...note,
    id: uuidv4(),
    title: `${note.title} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  const notes = this.readNotes();
  notes.push(dup);
  this.writeNotes(notes);
  return dup;
}
```

- [ ] **Step 4: Verify the build passes**

Run:
```bash
npm run build
```

Expected: Build completes. Existing notes without `wordCount` will default to `undefined` which is fine — the field is computed on save.

- [ ] **Step 5: Commit**

```bash
git add src/notepad/types.ts src/notepad/utils/word-count.ts src/notepad/storage/local-storage.ts
git commit -m "feat: add wordCount to Note type and compute on save"
```

---

### Task 4: Gamification Tier Definitions and Hook

**Files:**
- Create: `src/notepad/gamification/tiers.ts`
- Create: `src/notepad/hooks/useUserTier.ts`

- [ ] **Step 1: Create tier definitions**

Create `src/notepad/gamification/tiers.ts`:

```typescript
export interface Tier {
  name: string;
  threshold: number;
  scripture: string;
  reference: string;
}

export const TIERS: Tier[] = [
  {
    name: 'Spark',
    threshold: 10,
    scripture: 'The Lord is my light and my salvation',
    reference: 'Psalm 27:1',
  },
  {
    name: 'Ember',
    threshold: 50,
    scripture: 'Fan into flame the gift of God',
    reference: '2 Timothy 1:6',
  },
  {
    name: 'Flame',
    threshold: 150,
    scripture: 'He makes His ministers a flame of fire',
    reference: 'Hebrews 1:7',
  },
  {
    name: 'Lamp',
    threshold: 300,
    scripture: 'Your word is a lamp to my feet',
    reference: 'Psalm 119:105',
  },
  {
    name: 'Pillar of Fire',
    threshold: 500,
    scripture: 'A pillar of fire by night to give them light',
    reference: 'Exodus 13:21',
  },
  {
    name: 'Refiner',
    threshold: 1000,
    scripture: 'He will sit as a refiner and purifier',
    reference: 'Malachi 3:3',
  },
  {
    name: 'Glory',
    threshold: 5000,
    scripture: 'The glory of the Lord shone around them',
    reference: 'Luke 2:9',
  },
];

/**
 * Get the current tier for a given highest note count.
 * Returns null if below the first threshold (< 10).
 */
export function getTierForCount(highestNoteCount: number): Tier | null {
  let current: Tier | null = null;
  for (const tier of TIERS) {
    if (highestNoteCount >= tier.threshold) {
      current = tier;
    } else {
      break;
    }
  }
  return current;
}

/**
 * Get the next tier after the current one, or null if at max.
 */
export function getNextTier(highestNoteCount: number): Tier | null {
  for (const tier of TIERS) {
    if (highestNoteCount < tier.threshold) {
      return tier;
    }
  }
  return null;
}
```

- [ ] **Step 2: Create useUserTier hook**

Create `src/notepad/hooks/useUserTier.ts`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { getTierForCount, getNextTier } from '../gamification/tiers';
import type { Tier } from '../gamification/tiers';

interface UseUserTierResult {
  currentTier: Tier | null;
  nextTier: Tier | null;
  showLevelUp: boolean;
  levelUpTier: Tier | null;
  dismissLevelUp: () => void;
}

export function useUserTier(highestNoteCount: number): UseUserTierResult {
  const prevTierRef = useRef<Tier | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpTier, setLevelUpTier] = useState<Tier | null>(null);
  const initializedRef = useRef(false);

  const currentTier = getTierForCount(highestNoteCount);
  const nextTier = getNextTier(highestNoteCount);

  useEffect(() => {
    // Don't trigger level-up on initial load
    if (!initializedRef.current) {
      prevTierRef.current = currentTier;
      initializedRef.current = true;
      return;
    }

    // Check if tier changed upward
    const prevThreshold = prevTierRef.current?.threshold ?? 0;
    const currentThreshold = currentTier?.threshold ?? 0;

    if (currentThreshold > prevThreshold && currentTier) {
      setLevelUpTier(currentTier);
      setShowLevelUp(true);
    }

    prevTierRef.current = currentTier;
  }, [currentTier]);

  const dismissLevelUp = () => {
    setShowLevelUp(false);
    setLevelUpTier(null);
  };

  return { currentTier, nextTier, showLevelUp, levelUpTier, dismissLevelUp };
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
npm run build
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/notepad/gamification/tiers.ts src/notepad/hooks/useUserTier.ts
git commit -m "feat: add Covenant Fire tier definitions and useUserTier hook"
```

---

### Task 5: SupabaseStorageAdapter

**Files:**
- Create: `src/notepad/storage/supabase-adapter.ts`

- [ ] **Step 1: Create the Supabase storage adapter**

Create `src/notepad/storage/supabase-adapter.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Note, Folder } from '../types';
import type { StorageAdapter } from './adapter';
import { countWordsFromTipTapJSON } from '../utils/word-count';

/**
 * StorageAdapter backed by Supabase PostgreSQL.
 * All queries are automatically scoped to the authenticated user via RLS.
 */
export class SupabaseStorageAdapter implements StorageAdapter {
  constructor(private client: SupabaseClient, private userId: string) {}

  // ── Notes ──────────────────────────────────────────────────────────

  async getNotes(): Promise<Note[]> {
    const { data, error } = await this.client
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(this.mapNote);
  }

  async getNote(id: string): Promise<Note | null> {
    const { data, error } = await this.client
      .from('notes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? this.mapNote(data) : null;
  }

  async createNote(
    note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Note> {
    const { data, error } = await this.client
      .from('notes')
      .insert({
        user_id: this.userId,
        title: note.title,
        content: note.content,
        folder_id: note.folderId === 'root' ? null : note.folderId,
        type: note.type,
        tags: note.tags,
        word_count: countWordsFromTipTapJSON(note.content),
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapNote(data);
  }

  async updateNote(id: string, updates: Partial<Note>): Promise<Note> {
    const mapped: Record<string, unknown> = {};
    if (updates.title !== undefined) mapped.title = updates.title;
    if (updates.content !== undefined) {
      mapped.content = updates.content;
      mapped.word_count = countWordsFromTipTapJSON(updates.content);
    }
    if (updates.folderId !== undefined) {
      mapped.folder_id = updates.folderId === 'root' ? null : updates.folderId;
    }
    if (updates.type !== undefined) mapped.type = updates.type;
    if (updates.tags !== undefined) mapped.tags = updates.tags;

    const { data, error } = await this.client
      .from('notes')
      .update(mapped)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapNote(data);
  }

  async deleteNote(id: string): Promise<void> {
    const { error } = await this.client.from('notes').delete().eq('id', id);
    if (error) throw error;
  }

  async duplicateNote(id: string): Promise<Note> {
    const original = await this.getNote(id);
    if (!original) throw new Error(`Note ${id} not found`);
    return this.createNote({
      title: `${original.title} (copy)`,
      content: original.content,
      folderId: original.folderId,
      type: original.type,
      tags: original.tags,
      wordCount: original.wordCount,
    });
  }

  // ── Folders ────────────────────────────────────────────────────────

  async getFolders(): Promise<Folder[]> {
    const { data, error } = await this.client
      .from('folders')
      .select('*')
      .order('order', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(this.mapFolder);
  }

  async createFolder(folder: Omit<Folder, 'id'>): Promise<Folder> {
    const { data, error } = await this.client
      .from('folders')
      .insert({
        user_id: this.userId,
        name: folder.name,
        parent_id: folder.parentId,
        order: folder.order,
        icon: folder.icon ?? null,
        color: folder.color ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapFolder(data);
  }

  async updateFolder(id: string, updates: Partial<Folder>): Promise<Folder> {
    const mapped: Record<string, unknown> = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.parentId !== undefined) mapped.parent_id = updates.parentId;
    if (updates.order !== undefined) mapped.order = updates.order;
    if (updates.icon !== undefined) mapped.icon = updates.icon;
    if (updates.color !== undefined) mapped.color = updates.color;

    const { data, error } = await this.client
      .from('folders')
      .update(mapped)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapFolder(data);
  }

  async deleteFolder(id: string): Promise<void> {
    // Move notes in this folder to root (null folder_id)
    await this.client
      .from('notes')
      .update({ folder_id: null })
      .eq('folder_id', id);

    const { error } = await this.client.from('folders').delete().eq('id', id);
    if (error) throw error;
  }

  // ── Mappers (snake_case DB → camelCase app) ────────────────────────

  private mapNote = (row: Record<string, unknown>): Note => ({
    id: row.id as string,
    title: row.title as string,
    content: row.content as string,
    folderId: (row.folder_id as string) ?? 'root',
    type: row.type as Note['type'],
    tags: (row.tags as string[]) ?? [],
    wordCount: (row.word_count as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  });

  private mapFolder = (row: Record<string, unknown>): Folder => ({
    id: row.id as string,
    name: row.name as string,
    parentId: (row.parent_id as string) ?? null,
    order: row.order as number,
    icon: row.icon as Folder['icon'],
    color: row.color as string | undefined,
  });
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
npm run build
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/notepad/storage/supabase-adapter.ts
git commit -m "feat: add SupabaseStorageAdapter implementing StorageAdapter interface"
```

---

### Task 6: AuthProvider Context

**Files:**
- Create: `src/auth/AuthProvider.tsx`
- Create: `src/auth/useAuth.ts`

- [ ] **Step 1: Create the AuthProvider**

Create `src/auth/AuthProvider.tsx`:

```typescript
import { createContext, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from './types';
import type { StorageAdapter } from '@/notepad/storage/adapter';
import { LocalStorageAdapter } from '@/notepad/storage/local-storage';
import { SupabaseStorageAdapter } from '@/notepad/storage/supabase-adapter';

export interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isOnline: boolean;
  adapter: StorageAdapter;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<UserProfile, 'fullName' | 'dateOfBirth' | 'avatarUrl'>>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
  deleteAccount: () => Promise<void>;
  exportData: () => Promise<{ notes: unknown[]; folders: unknown[] }>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const localAdapter = new LocalStorageAdapter();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [adapter, setAdapter] = useState<StorageAdapter>(localAdapter);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch profile from Supabase
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return {
      id: data.id,
      fullName: data.full_name,
      dateOfBirth: data.date_of_birth,
      avatarUrl: data.avatar_url,
      noteCount: data.note_count,
      highestNoteCount: data.highest_note_count,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setAdapter(new SupabaseStorageAdapter(supabase, s.user.id));
        fetchProfile(s.user.id).then((p) => {
          setProfile(p);
          setLoading(false);
        });
      } else {
        setAdapter(localAdapter);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          setAdapter(new SupabaseStorageAdapter(supabase, s.user.id));
          const p = await fetchProfile(s.user.id);
          setProfile(p);
        } else {
          setAdapter(localAdapter);
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAdapter(localAdapter);
  }, []);

  const updateProfile = useCallback(async (
    updates: Partial<Pick<UserProfile, 'fullName' | 'dateOfBirth' | 'avatarUrl'>>
  ) => {
    if (!supabase || !user) throw new Error('Not authenticated');
    const mapped: Record<string, unknown> = {};
    if (updates.fullName !== undefined) mapped.full_name = updates.fullName;
    if (updates.dateOfBirth !== undefined) mapped.date_of_birth = updates.dateOfBirth;
    if (updates.avatarUrl !== undefined) mapped.avatar_url = updates.avatarUrl;

    const { error } = await supabase
      .from('profiles')
      .update(mapped)
      .eq('id', user.id);
    if (error) throw error;

    const refreshed = await fetchProfile(user.id);
    setProfile(refreshed);
  }, [user, fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    setProfile(p);
  }, [user, fetchProfile]);

  const uploadAvatar = useCallback(async (file: File): Promise<string> => {
    if (!supabase || !user) throw new Error('Not authenticated');
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = data.publicUrl;

    await updateProfile({ avatarUrl: url });
    return url;
  }, [user, updateProfile]);

  const deleteAccount = useCallback(async () => {
    if (!supabase || !user) throw new Error('Not authenticated');
    // Delete avatar from storage
    if (profile?.avatarUrl) {
      const path = `${user.id}/`;
      await supabase.storage.from('avatars').remove([path]);
    }
    // Notes and folders cascade-delete via FK on profiles
    // Delete profile (cascade deletes notes/folders)
    await supabase.from('profiles').delete().eq('id', user.id);
    // Sign out
    await supabase.auth.signOut();
    setAdapter(localAdapter);
  }, [user, profile]);

  const exportData = useCallback(async () => {
    const notes = await adapter.getNotes();
    const folders = await adapter.getFolders();
    return { notes, folders };
  }, [adapter]);

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    isOnline,
    adapter,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    refreshProfile,
    uploadAvatar,
    deleteAccount,
    exportData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 2: Create useAuth hook**

Create `src/auth/useAuth.ts`:

```typescript
import { useContext } from 'react';
import { AuthContext } from './AuthProvider';
import type { AuthContextValue } from './AuthProvider';

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
npm run build
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/auth/AuthProvider.tsx src/auth/useAuth.ts
git commit -m "feat: add AuthProvider with Supabase auth, adapter switching, profile management"
```

---

### Task 7: Wire AuthProvider into App and NotepadProvider

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/sections/Notepad.tsx`
- Modify: `src/notepad/context/NotepadProvider.tsx`

- [ ] **Step 1: Update NotepadProvider to use adapter prop reactively**

In `src/notepad/context/NotepadProvider.tsx`, update the `adapterRef` logic so when the `adapter` prop changes (e.g. user logs in), the provider switches adapters and re-fetches data.

Replace the current `adapterRef` and `refresh` logic:

```typescript
export function NotepadProvider({ children, adapter: adapterProp }: NotepadProviderProps) {
  const adapterRef = useRef<StorageAdapter>(adapterProp ?? new LocalStorageAdapter());

  // Update adapter ref when prop changes (e.g., user logs in/out)
  useEffect(() => {
    if (adapterProp) {
      adapterRef.current = adapterProp;
      refresh();
    }
  }, [adapterProp]);
```

Note: `refresh` is already defined via `useCallback` below this line — the dependency will resolve. Add `refresh` to the deps but wrap in a ref to avoid infinite loop:

Actually, simpler approach — just update the ref and trigger a state-based re-fetch:

```typescript
export function NotepadProvider({ children, adapter: adapterProp }: NotepadProviderProps) {
  const [adapterVersion, setAdapterVersion] = useState(0);
  const adapterRef = useRef<StorageAdapter>(adapterProp ?? new LocalStorageAdapter());

  // Update adapter when prop changes (user logs in/out)
  useEffect(() => {
    if (adapterProp && adapterProp !== adapterRef.current) {
      adapterRef.current = adapterProp;
      setAdapterVersion((v) => v + 1);
    }
  }, [adapterProp]);
```

Then update the initial fetch `useEffect` to re-run on adapter changes:

```typescript
  useEffect(() => {
    refresh();
  }, [refresh, adapterVersion]);
```

- [ ] **Step 2: Update Notepad component to pass adapter from AuthProvider**

In `src/components/sections/Notepad.tsx`, import `useAuth` and pass the adapter:

Add import:
```typescript
import { useAuth } from '@/auth/useAuth';
```

Update the `NotepadWorkspace` component to get the adapter:
```typescript
function NotepadWorkspace() {
  // ... existing state ...
```

This component is already wrapped in `NotepadProvider`. Move the provider wrapping to use the adapter. Update the `Notepad` export:

```typescript
export function Notepad() {
  const { adapter } = useAuth();
  return (
    <NotepadProvider adapter={adapter}>
      <NotepadWorkspace />
    </NotepadProvider>
  );
}
```

- [ ] **Step 3: Wrap App with AuthProvider**

In `src/App.tsx`, wrap the entire app with `AuthProvider`:

Add import:
```typescript
import { AuthProvider } from '@/auth/AuthProvider';
```

Wrap the return in `App`:
```typescript
return (
  <AuthProvider>
    <>
      <div className="relative min-h-screen" ...>
        {/* existing content */}
      </div>
      {/* ... */}
    </>
  </AuthProvider>
);
```

- [ ] **Step 4: Verify build**

Run:
```bash
npm run build
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/sections/Notepad.tsx src/notepad/context/NotepadProvider.tsx
git commit -m "feat: wire AuthProvider into App, pass adapter to NotepadProvider"
```

---

### Task 8: Login/Signup Page

**Files:**
- Create: `src/auth/LoginPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create LoginPage component**

Create `src/auth/LoginPage.tsx`:

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

type Mode = 'login' | 'signup';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle, user } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Redirect if already logged in
  if (user) {
    navigate('/notepad');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!fullName.trim()) {
          setError('Full name is required');
          setLoading(false);
          return;
        }
        await signUp(email, password, fullName);
        setSuccess('Check your email to verify your account.');
      } else {
        await signIn(email, password);
        navigate('/notepad');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--plaster)' }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-8"
        style={{
          background: 'var(--alabaster)',
          border: '1px solid var(--pale-stone)',
          boxShadow: '0 4px 24px rgba(58, 52, 38, 0.08)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo-icon.png"
            alt="LivePsalms"
            className="h-10 w-auto mb-3"
          />
          <h1
            className="text-lg font-medium"
            style={{
              color: 'var(--deep-umber)',
              fontFamily: 'Cormorant Garamond, serif',
            }}
          >
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h1>
        </div>

        {/* Google sign-in */}
        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg mb-4 hover:bg-black/5 transition-colors"
          style={{
            border: '1px solid var(--pale-stone)',
            fontFamily: 'Outfit, sans-serif',
            fontSize: 13,
            color: 'var(--deep-umber)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px" style={{ background: 'var(--pale-stone)' }} />
          <span
            className="text-[10px] tracking-widest"
            style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
          >
            OR
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--pale-stone)' }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{
                border: '1px solid var(--pale-stone)',
                background: 'var(--plaster)',
                fontFamily: 'Outfit, sans-serif',
                color: 'var(--deep-umber)',
              }}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{
              border: '1px solid var(--pale-stone)',
              background: 'var(--plaster)',
              fontFamily: 'Outfit, sans-serif',
              color: 'var(--deep-umber)',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{
              border: '1px solid var(--pale-stone)',
              background: 'var(--plaster)',
              fontFamily: 'Outfit, sans-serif',
              color: 'var(--deep-umber)',
            }}
          />

          {error && (
            <p className="text-xs" style={{ color: '#c0392b', fontFamily: 'Outfit, sans-serif' }}>
              {error}
            </p>
          )}
          {success && (
            <p className="text-xs" style={{ color: '#27ae60', fontFamily: 'Outfit, sans-serif' }}>
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity"
            style={{
              background: 'var(--deep-umber)',
              color: 'var(--plaster)',
              fontFamily: 'Outfit, sans-serif',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign In'
                : 'Create Account'}
          </button>
        </form>

        {/* Toggle mode */}
        <p
          className="text-center text-xs mt-5"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
              setSuccess(null);
            }}
            className="underline hover:opacity-70 transition-opacity"
            style={{ color: 'var(--deep-umber)' }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add login route to App.tsx**

In `src/App.tsx`, add import and route:

Add import:
```typescript
import { LoginPage } from '@/auth/LoginPage';
```

Add route inside `<Routes>` after the notepad route:
```typescript
<Route path="/login" element={<LoginPage />} />
```

- [ ] **Step 3: Verify build**

Run:
```bash
npm run build
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/auth/LoginPage.tsx src/App.tsx
git commit -m "feat: add Login/Signup page with email + Google auth"
```

---

### Task 9: Profile Page

**Files:**
- Create: `src/auth/ProfilePage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create ProfilePage component**

Create `src/auth/ProfilePage.tsx`:

```typescript
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, LogOut, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { getTierForCount } from '@/notepad/gamification/tiers';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function ProfilePage() {
  const navigate = useNavigate();
  const {
    user,
    profile,
    loading,
    updateProfile,
    uploadAvatar,
    signOut,
    deleteAccount,
    exportData,
  } = useAuth();

  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth ?? '');
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not authenticated
  if (!loading && !user) {
    navigate('/login');
    return null;
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--plaster)' }}
      >
        <p style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>Loading...</p>
      </div>
    );
  }

  const currentTier = getTierForCount(profile?.highestNoteCount ?? 0);
  const totalNotes = profile?.noteCount ?? 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        fullName,
        dateOfBirth: dateOfBirth || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      await uploadAvatar(file);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleExport = async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `psalms-notes-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async () => {
    await deleteAccount();
    navigate('/');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const sectionStyle = {
    background: 'var(--alabaster)',
    border: '1px solid var(--pale-stone)',
    borderRadius: 12,
    padding: '24px',
  };

  const labelStyle = {
    fontSize: 10,
    fontWeight: 500 as const,
    letterSpacing: '0.15em',
    color: 'var(--silica)',
    fontFamily: 'Outfit, sans-serif',
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  };

  const inputStyle = {
    border: '1px solid var(--pale-stone)',
    background: 'var(--plaster)',
    fontFamily: 'Outfit, sans-serif',
    color: 'var(--deep-umber)',
    fontSize: 13,
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--plaster)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 border-b"
        style={{ borderColor: 'var(--pale-stone)' }}
      >
        <button
          onClick={() => navigate('/notepad')}
          className="flex items-center justify-center w-8 h-8 rounded hover:bg-black/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" style={{ color: 'var(--deep-umber)' }} />
        </button>
        <h1
          className="text-base font-medium"
          style={{
            color: 'var(--deep-umber)',
            fontFamily: 'Cormorant Garamond, serif',
          }}
        >
          Profile
        </h1>
      </div>

      <div className="max-w-lg mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Avatar + Name Header */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <div
              className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center cursor-pointer"
              onClick={handleAvatarClick}
              style={{
                background: 'var(--warm-sand)',
                border: '2px solid var(--pale-stone)',
              }}
            >
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span
                  className="text-2xl font-medium"
                  style={{
                    color: 'var(--plaster)',
                    fontFamily: 'Cormorant Garamond, serif',
                  }}
                >
                  {(profile?.fullName?.[0] ?? '?').toUpperCase()}
                </span>
              )}
              {avatarUploading && (
                <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center">
                  <span className="text-white text-xs" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    ...
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleAvatarClick}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                background: 'var(--deep-umber)',
                border: '2px solid var(--plaster)',
              }}
            >
              <Camera className="w-3 h-3" style={{ color: 'var(--plaster)' }} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <div>
            <p
              className="text-lg font-medium"
              style={{
                color: 'var(--deep-umber)',
                fontFamily: 'Cormorant Garamond, serif',
              }}
            >
              {profile?.fullName}
            </p>
            <p className="text-xs" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
              {user?.email}
            </p>
          </div>
        </div>

        {/* Tier Display */}
        {currentTier && (
          <div style={sectionStyle}>
            <p style={labelStyle}>SPIRITUAL RANK</p>
            <p
              className="text-xl font-medium mb-1"
              style={{
                color: 'var(--deep-umber)',
                fontFamily: 'Cormorant Garamond, serif',
              }}
            >
              {currentTier.name}
            </p>
            <p
              className="text-xs italic mb-3"
              style={{
                color: 'var(--silica)',
                fontFamily: 'Cormorant Garamond, serif',
              }}
            >
              "{currentTier.scripture}" — {currentTier.reference}
            </p>
            <p className="text-xs" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
              {totalNotes} {totalNotes === 1 ? 'note' : 'notes'} written
            </p>
          </div>
        )}

        {/* Edit Profile */}
        <div style={sectionStyle}>
          <p style={labelStyle}>PROFILE</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="block mb-1" style={{ ...labelStyle, marginBottom: 4 }}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block mb-1" style={{ ...labelStyle, marginBottom: 4 }}>
                Date of Birth (optional)
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="self-end px-5 py-2 rounded-lg text-xs font-medium transition-opacity"
              style={{
                background: 'var(--deep-umber)',
                color: 'var(--plaster)',
                fontFamily: 'Outfit, sans-serif',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Auth Management */}
        <div style={sectionStyle}>
          <p style={labelStyle}>SECURITY</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={async () => {
                if (!user?.email) return;
                const { supabase } = await import('@/lib/supabase');
                if (supabase) {
                  await supabase.auth.resetPasswordForEmail(user.email);
                  toast.success('Password reset email sent.');
                }
              }}
              className="text-left text-xs hover:opacity-70 transition-opacity"
              style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
            >
              Change Password →
            </button>
            <p className="text-xs" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
              Google:{' '}
              {user?.app_metadata?.providers?.includes('google')
                ? 'Linked'
                : 'Not linked'}
            </p>
          </div>
        </div>

        {/* Account Actions */}
        <div style={sectionStyle}>
          <p style={labelStyle}>ACCOUNT</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 text-xs hover:opacity-70 transition-opacity"
              style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
            >
              <Download className="w-3.5 h-3.5" />
              Export All Notes
            </button>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-xs hover:opacity-70 transition-opacity"
              style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="flex items-center gap-2 text-xs hover:opacity-70 transition-opacity mt-2"
                  style={{ color: '#c0392b', fontFamily: 'Outfit, sans-serif' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Account
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle
                    style={{ fontFamily: 'Cormorant Garamond, serif' }}
                  >
                    Delete Account?
                  </AlertDialogTitle>
                  <AlertDialogDescription
                    style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13 }}
                  >
                    This will permanently delete your account, all your notes,
                    folders, and profile data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13 }}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    style={{
                      background: '#c0392b',
                      fontFamily: 'Outfit, sans-serif',
                      fontSize: 13,
                    }}
                  >
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add profile route to App.tsx**

In `src/App.tsx`, add import and route:

Add import:
```typescript
import { ProfilePage } from '@/auth/ProfilePage';
```

Add route inside `<Routes>`:
```typescript
<Route path="/profile" element={<ProfilePage />} />
```

Update `hideFooter` to also hide on profile and login pages:
```typescript
const isProfilePage = location.pathname === '/profile';
const isLoginPage = location.pathname === '/login';
const hideFooter = isDetailPage || isPurposePage || isNotepadPage || isProfilePage || isLoginPage;
```

Also hide header on profile and login pages:
```typescript
{!isNotepadPage && !isProfilePage && !isLoginPage && <Header darkText={isDetailPage} />}
```

- [ ] **Step 3: Verify build**

Run:
```bash
npm run build
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/auth/ProfilePage.tsx src/App.tsx
git commit -m "feat: add Profile page with tier display, edit form, account actions"
```

---

### Task 10: Level-Up Modal

**Files:**
- Create: `src/notepad/components/LevelUpModal.tsx`

- [ ] **Step 1: Create the celebratory level-up modal**

Create `src/notepad/components/LevelUpModal.tsx`:

```typescript
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Tier } from '../gamification/tiers';

interface LevelUpModalProps {
  open: boolean;
  tier: Tier | null;
  onDismiss: () => void;
}

export function LevelUpModal({ open, tier, onDismiss }: LevelUpModalProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setAnimate(true), 100);
      return () => clearTimeout(timer);
    } else {
      setAnimate(false);
    }
  }, [open]);

  if (!tier) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onDismiss()}>
      <DialogContent
        className="flex flex-col items-center text-center p-10 max-w-sm"
        style={{
          background: 'var(--alabaster)',
          border: '1px solid var(--pale-stone)',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        <DialogTitle className="sr-only">Level Up</DialogTitle>

        {/* Fire animation glow */}
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
          style={{
            background: 'radial-gradient(circle, rgba(232, 169, 58, 0.3) 0%, transparent 70%)',
            boxShadow: animate
              ? '0 0 40px rgba(232, 169, 58, 0.4), 0 0 80px rgba(232, 169, 58, 0.2)'
              : 'none',
            transition: 'box-shadow 0.8s ease-out',
          }}
        >
          <span
            className="text-5xl"
            style={{
              filter: animate ? 'brightness(1.2)' : 'brightness(1)',
              transition: 'filter 0.8s ease-out',
            }}
          >
            🔥
          </span>
        </div>

        {/* Tier name */}
        <p
          className="text-[10px] tracking-[0.25em] font-medium mb-2"
          style={{ color: 'var(--silica)' }}
        >
          YOU HAVE REACHED
        </p>
        <h2
          className="text-3xl font-semibold mb-4"
          style={{
            color: 'var(--deep-umber)',
            fontFamily: 'Cormorant Garamond, serif',
            transform: animate ? 'scale(1)' : 'scale(0.8)',
            opacity: animate ? 1 : 0,
            transition: 'transform 0.6s ease-out, opacity 0.6s ease-out',
          }}
        >
          {tier.name}
        </h2>

        {/* Scripture */}
        <p
          className="text-sm italic mb-1"
          style={{
            color: 'var(--deep-umber)',
            fontFamily: 'Cormorant Garamond, serif',
            opacity: animate ? 1 : 0,
            transition: 'opacity 0.8s ease-out 0.3s',
          }}
        >
          "{tier.scripture}"
        </p>
        <p
          className="text-xs mb-8"
          style={{
            color: 'var(--silica)',
            fontFamily: 'Outfit, sans-serif',
            opacity: animate ? 1 : 0,
            transition: 'opacity 0.8s ease-out 0.4s',
          }}
        >
          — {tier.reference}
        </p>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="px-8 py-2.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
          style={{
            background: 'var(--deep-umber)',
            color: 'var(--plaster)',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          Continue
        </button>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
npm run build
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/notepad/components/LevelUpModal.tsx
git commit -m "feat: add celebratory LevelUpModal for tier transitions"
```

---

### Task 11: Tier Badge and Toolbar Auth Integration

**Files:**
- Create: `src/notepad/components/TierBadge.tsx`
- Modify: `src/notepad/components/NotepadToolbar.tsx`

- [ ] **Step 1: Create TierBadge component**

Create `src/notepad/components/TierBadge.tsx`:

```typescript
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Tier } from '../gamification/tiers';

interface TierBadgeProps {
  tier: Tier;
  noteCount: number;
}

export function TierBadge({ tier, noteCount }: TierBadgeProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-black/5 transition-colors cursor-pointer"
        >
          <span className="text-xs">🔥</span>
          <span
            className="text-[10px] font-medium tracking-wider"
            style={{
              color: 'var(--deep-umber)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            {tier.name}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 p-4"
        style={{
          background: 'var(--alabaster)',
          border: '1px solid var(--pale-stone)',
        }}
      >
        <p
          className="text-[10px] tracking-[0.2em] font-medium mb-2"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          SPIRITUAL RANK
        </p>
        <p
          className="text-lg font-medium mb-1"
          style={{
            color: 'var(--deep-umber)',
            fontFamily: 'Cormorant Garamond, serif',
          }}
        >
          {tier.name}
        </p>
        <p
          className="text-xs italic mb-3"
          style={{
            color: 'var(--silica)',
            fontFamily: 'Cormorant Garamond, serif',
          }}
        >
          "{tier.scripture}" — {tier.reference}
        </p>
        <p
          className="text-xs"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          {noteCount} {noteCount === 1 ? 'note' : 'notes'} written
        </p>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Update NotepadToolbar with auth controls**

In `src/notepad/components/NotepadToolbar.tsx`, add sign-in button (when logged out) and avatar + tier badge + dropdown (when logged in).

Add imports:
```typescript
import { useNavigate } from 'react-router-dom';
import { LogIn, User, LogOut } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { useUserTier } from '../hooks/useUserTier';
import { TierBadge } from './TierBadge';
import { LevelUpModal } from './LevelUpModal';
```

Inside the component, after existing hooks:
```typescript
const { user, profile, signOut } = useAuth();
const { currentTier, showLevelUp, levelUpTier, dismissLevelUp } = useUserTier(
  profile?.highestNoteCount ?? 0
);
```

Before the closing `</>` of the return, add the LevelUpModal:
```typescript
<LevelUpModal open={showLevelUp} tier={levelUpTier} onDismiss={dismissLevelUp} />
```

In the toolbar, after the graph toggle button and before the closing `</div>` of the button row, add:

```typescript
{/* Divider */}
<div
  className="mx-2 self-stretch"
  style={{
    width: 1,
    background: 'var(--pale-stone)',
    marginTop: 10,
    marginBottom: 10,
  }}
/>

{/* Auth area */}
{user ? (
  <div className="flex items-center gap-1">
    {currentTier && (
      <TierBadge tier={currentTier} noteCount={profile?.noteCount ?? 0} />
    )}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`${btnClass} w-8 h-8 rounded-full overflow-hidden`}>
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="w-4 h-4" style={{ color: 'var(--deep-umber)' }} />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={{ fontFamily: 'Outfit, sans-serif', minWidth: 140 }}>
        <DropdownMenuItem onClick={() => navigate('/profile')} style={{ fontSize: 12 }}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate('/');
          }}
          style={{ fontSize: 12 }}
        >
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
) : (
  <button
    onClick={() => navigate('/login')}
    className={`${btnClass} flex items-center gap-1.5 px-3 h-8`}
    style={{ fontFamily: 'Outfit, sans-serif' }}
  >
    <LogIn className="w-3.5 h-3.5" style={{ color: 'var(--deep-umber)' }} />
    <span
      className="text-[10px] font-medium tracking-wider"
      style={{ color: 'var(--deep-umber)' }}
    >
      SIGN IN
    </span>
  </button>
)}
```

- [ ] **Step 3: Verify build**

Run:
```bash
npm run build
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/notepad/components/TierBadge.tsx src/notepad/components/NotepadToolbar.tsx
git commit -m "feat: add TierBadge to toolbar and auth sign-in/user-menu controls"
```

---

### Task 12: Migration Dialog (localStorage → Supabase)

**Files:**
- Create: `src/notepad/components/MigrationDialog.tsx`
- Modify: `src/components/sections/Notepad.tsx`

- [ ] **Step 1: Create MigrationDialog component**

Create `src/notepad/components/MigrationDialog.tsx`:

```typescript
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { LocalStorageAdapter } from '../storage/local-storage';
import type { StorageAdapter } from '../storage/adapter';

interface MigrationDialogProps {
  open: boolean;
  onClose: () => void;
  targetAdapter: StorageAdapter;
  onMigrationComplete: () => void;
}

export function MigrationDialog({
  open,
  onClose,
  targetAdapter,
  onMigrationComplete,
}: MigrationDialogProps) {
  const [migrating, setMigrating] = useState(false);
  const localAdapter = new LocalStorageAdapter();

  const localNotesRaw = localStorage.getItem('notepad_notes');
  const localNotes = localNotesRaw ? JSON.parse(localNotesRaw) : [];
  const noteCount = localNotes.length;

  const handleImport = async () => {
    setMigrating(true);
    try {
      // Get all local data
      const notes = await localAdapter.getNotes();
      const folders = await localAdapter.getFolders();

      // Create folders first (so note folder references resolve)
      const folderIdMap = new Map<string, string>();
      for (const folder of folders) {
        const created = await targetAdapter.createFolder({
          name: folder.name,
          parentId: folder.parentId,
          order: folder.order,
          icon: folder.icon,
          color: folder.color,
        });
        folderIdMap.set(folder.id, created.id);
      }

      // Create notes with remapped folder IDs
      for (const note of notes) {
        const mappedFolderId = folderIdMap.get(note.folderId) ?? 'root';
        await targetAdapter.createNote({
          title: note.title,
          content: note.content,
          folderId: mappedFolderId,
          type: note.type,
          tags: note.tags,
          wordCount: note.wordCount ?? 0,
        });
      }

      // Clear localStorage
      localStorage.removeItem('notepad_notes');
      localStorage.removeItem('notepad_folders');

      onMigrationComplete();
      onClose();
    } catch (err) {
      console.error('Migration failed:', err);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-sm p-8"
        style={{
          background: 'var(--alabaster)',
          border: '1px solid var(--pale-stone)',
        }}
      >
        <DialogTitle
          className="text-lg font-medium text-center"
          style={{
            color: 'var(--deep-umber)',
            fontFamily: 'Cormorant Garamond, serif',
          }}
        >
          Import Local Notes?
        </DialogTitle>
        <DialogDescription
          className="text-center text-sm mt-2"
          style={{
            color: 'var(--silica)',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          You have {noteCount} {noteCount === 1 ? 'note' : 'notes'} saved locally.
          Would you like to import them to your account?
        </DialogDescription>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={migrating}
            className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              border: '1px solid var(--pale-stone)',
              color: 'var(--deep-umber)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            No Thanks
          </button>
          <button
            onClick={handleImport}
            disabled={migrating}
            className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-opacity"
            style={{
              background: 'var(--deep-umber)',
              color: 'var(--plaster)',
              fontFamily: 'Outfit, sans-serif',
              opacity: migrating ? 0.6 : 1,
            }}
          >
            {migrating ? 'Importing...' : 'Import Notes'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire MigrationDialog into Notepad workspace**

In `src/components/sections/Notepad.tsx`, add migration dialog logic.

Add imports:
```typescript
import { useEffect } from 'react';
import { MigrationDialog } from '@/notepad/components/MigrationDialog';
import { useAuth } from '@/auth/useAuth';
import { useNotepad } from '@/notepad/context/useNotepad';
```

Inside `NotepadWorkspace`, add migration state:
```typescript
const { user, adapter } = useAuth();
const { refresh } = useNotepad();
const [showMigration, setShowMigration] = useState(false);

// Check for local notes when user logs in
useEffect(() => {
  if (user) {
    const localNotes = localStorage.getItem('notepad_notes');
    if (localNotes) {
      const parsed = JSON.parse(localNotes);
      if (parsed.length > 0) {
        setShowMigration(true);
      }
    }
  }
}, [user]);
```

Add the dialog before the closing tag in the return:
```typescript
<MigrationDialog
  open={showMigration}
  onClose={() => setShowMigration(false)}
  targetAdapter={adapter}
  onMigrationComplete={refresh}
/>
```

- [ ] **Step 3: Verify build**

Run:
```bash
npm run build
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/notepad/components/MigrationDialog.tsx src/components/sections/Notepad.tsx
git commit -m "feat: add localStorage-to-Supabase migration dialog on first login"
```

---

### Task 13: Online Status Hook and Offline Banner

**Files:**
- Create: `src/notepad/hooks/useOnlineStatus.ts`
- Modify: `src/components/sections/Notepad.tsx`

- [ ] **Step 1: Create useOnlineStatus hook**

Create `src/notepad/hooks/useOnlineStatus.ts`:

```typescript
import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

- [ ] **Step 2: Add offline banner to Notepad workspace**

In `src/components/sections/Notepad.tsx`, import and use:

```typescript
import { useOnlineStatus } from '@/notepad/hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';
```

Inside `NotepadWorkspace`:
```typescript
const isOnline = useOnlineStatus();
const isLoggedIn = !!user;
const isOfflineAndLoggedIn = !isOnline && isLoggedIn;
```

Add the banner right after `<NotepadToolbar ... />`:
```typescript
{isOfflineAndLoggedIn && (
  <div
    className="flex items-center justify-center gap-2 py-2 text-xs"
    style={{
      background: 'rgba(232, 169, 58, 0.15)',
      borderBottom: '1px solid rgba(232, 169, 58, 0.3)',
      color: 'var(--deep-umber)',
      fontFamily: 'Outfit, sans-serif',
    }}
  >
    <WifiOff className="w-3.5 h-3.5" />
    You're offline — viewing cached notes
  </div>
)}
```

- [ ] **Step 3: Verify build**

Run:
```bash
npm run build
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/notepad/hooks/useOnlineStatus.ts src/components/sections/Notepad.tsx
git commit -m "feat: add offline detection and banner for logged-in users"
```

---

### Task 14: End-to-End Verification

**Files:** None (testing only)

- [ ] **Step 1: Run final build**

Run:
```bash
npm run build
```

Expected: PASS with no errors

- [ ] **Step 2: Run lint**

Run:
```bash
npm run lint
```

Expected: PASS or only pre-existing warnings

- [ ] **Step 3: Start dev server and verify**

Run:
```bash
npm run dev
```

Verify in browser:
1. `/notepad` loads without auth (localStorage mode works as before)
2. `/login` shows login/signup page with Google button and email form
3. No runtime errors in console
4. Toolbar shows "SIGN IN" button when not logged in
5. All existing notepad features (create note, edit, search, graph) still work

- [ ] **Step 4: Verify with Supabase (if env vars configured)**

If `.env.local` is configured with a real Supabase project:
1. Sign up with email/password
2. Log in
3. Create a note with 20+ words → check if tier system responds
4. Visit `/profile` → verify tier display, edit form, account actions
5. Test Google OAuth flow

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "fix: address any issues found during end-to-end verification"
```
