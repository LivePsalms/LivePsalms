// Fire-and-forget audit insert. A usage-table outage must never break the
// primary work path (embedding, generation). Errors log; the function resolves.

export interface UsageRow {
  user_id: string;
  model: string;
  artifact_kind: string;
  tokens_in: number;
  tokens_out: number;
  status: 'ok' | 'error';
  error_code?: string | null;
}

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
