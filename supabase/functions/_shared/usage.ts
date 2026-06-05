// Fire-and-forget audit insert. A usage-table outage must never break the
// primary work path (embedding, generation). Errors log; the function resolves.

export interface UsageRow {
  user_id: string;
  // null when no model ran (quota block, context-build throw). A fictional
  // model id would corrupt cost attribution — null is the honest value.
  model: string | null;
  artifact_kind: string;
  tokens_in: number;
  tokens_out: number;
  status: 'ok' | 'error';
  error_code?: string | null;
}

// The per-call usage payload, minus the identity fields the lifecycle owns.
// Pipelines build a UsageCore; runGeneration merges user_id + artifact_kind.
export type UsageCore = Omit<UsageRow, 'user_id' | 'artifact_kind'>;

// Minimal Supabase client shape required by this helper. Keeping the type
// narrow makes it easy to fake in unit tests and avoids cross-runtime
// (Deno vs Node) type drag from the official client.
export interface UsageSupabaseClient {
  from(table: 'lamplight_usage'): {
    insert(row: UsageRow): Promise<{ error: { message: string } | null }>;
  };
}

export async function recordLamplightUsage(
  supabase: UsageSupabaseClient,
  row: UsageRow,
): Promise<void> {
  try {
    const { error } = await supabase.from('lamplight_usage').insert(row);
    if (error) {
      console.error('[lamplight_usage] insert failed', error.message, { row });
    }
  } catch (e) {
    console.error('[lamplight_usage] insert threw', e, { row });
  }
}
