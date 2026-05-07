export type VerseFetcher = (ref: string) => Promise<{ text: string; translation: string } | null>;

export function createInMemoryVerseFetcher(
  map: Record<string, { text: string; translation: string }>,
): VerseFetcher {
  return async (ref: string) => map[ref] ?? null;
}
