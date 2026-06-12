import type { SupabaseClient } from '@supabase/supabase-js';
import type { BibleHighlight, BibleHighlightAdapter } from './types';

interface HighlightRow {
  verse_id: string;
  swatch_id: string;
}

// Backed by the bible_highlights table (RLS-scoped to the signed-in user).
export class SupabaseBibleHighlightAdapter implements BibleHighlightAdapter {
  #client: SupabaseClient;
  #userId: string;

  constructor(client: SupabaseClient, userId: string) {
    this.#client = client;
    this.#userId = userId;
  }

  async getChapterHighlights(book: string, chapter: number): Promise<BibleHighlight[]> {
    const { data, error } = await this.#client
      .from('bible_highlights')
      .select('verse_id, swatch_id')
      .like('verse_id', `${book}.${chapter}.%`);
    if (error) throw error;
    return ((data ?? []) as HighlightRow[]).map((r) => ({
      verseId: r.verse_id,
      swatchId: r.swatch_id,
    }));
  }

  async setHighlight(verseId: string, swatchId: string): Promise<void> {
    const { error } = await this.#client
      .from('bible_highlights')
      .upsert(
        {
          user_id: this.#userId,
          verse_id: verseId,
          swatch_id: swatchId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,verse_id' },
      );
    if (error) throw error;
  }

  async removeHighlight(verseId: string): Promise<void> {
    const { error } = await this.#client
      .from('bible_highlights')
      .delete()
      .eq('user_id', this.#userId)
      .eq('verse_id', verseId);
    if (error) throw error;
  }
}
