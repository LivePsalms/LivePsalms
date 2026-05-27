// Canonical artifact types shared between the Edge Function (Deno) and the
// React client (Node/browser via tsc). Framework-free: no I/O, no Deno or
// Node globals.

export interface DailyDevotion {
  opening: string;
  scripture: {
    ref: string;
    text: string;
  };
  reflection: string;
  prompt: string;
  note_citations: Array<{
    note_id: string;
    reason: string;
  }>;
}
