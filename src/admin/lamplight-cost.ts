// Display-only estimate. Source of truth is provider pricing.
// Update when Voyage or Anthropic adjust rates.
const PRICE_PER_M_TOKENS_CENTS: Record<string, { in: number; out: number }> = {
  'voyage-3-large':    { in: 18,   out: 0    },  // $0.18 / 1M
  'claude-haiku-4-5':  { in: 100,  out: 500  },  // verify against Anthropic pricing page before merge
  'claude-sonnet-4-6': { in: 300,  out: 1500 },
};

export function estCostCents(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICE_PER_M_TOKENS_CENTS[model] ?? { in: 0, out: 0 };
  return Math.round((tokensIn * p.in + tokensOut * p.out) / 1_000_000);
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
