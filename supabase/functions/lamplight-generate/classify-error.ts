// Classifies a thrown error into a known lamplight_usage error_code.
// Kept in its own file so it can be imported by both index.ts and tests
// without pulling in the Deno serve() binding.

export function classifyGenerateError(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err).toLowerCase();
  if (msg.includes('validators_failed')) return 'validators_failed';
  if (msg.includes('no_embedding'))      return 'no_embedding';
  if (msg.includes('not_neighbor'))      return 'not_neighbor';
  if (msg.includes('network'))           return 'network';
  return 'unknown';
}
