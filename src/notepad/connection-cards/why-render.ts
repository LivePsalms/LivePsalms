// Connection Card "why" render helper. Prepends the user's first name when
// available so the rendered string reads as a personal observation.
// The Connection Why LLM prompt produces bare third-person observations; this
// helper applies the prefix at render time — no model-side word budget hit.

export function prefixWhyWithName(why: string | undefined, firstName: string | null): string {
  const text = why ?? '';
  if (!firstName) return text;
  return `${firstName} — ${text}`;
}
