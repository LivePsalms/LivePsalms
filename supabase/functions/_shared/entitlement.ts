// supabase/functions/_shared/entitlement.ts
// Single source of truth for chat gating. Mirrors useLamplightEntitlement's
// 'chat' branch on the client so server and UI agree. Chat is a `plus`-only
// feature (or anyone while a promo is active).

export type LamplightTier = 'plus' | 'lite' | 'none';

export function hasChatAccess(args: { tier: LamplightTier; promoActive: boolean }): boolean {
  if (args.promoActive) return true;
  return args.tier === 'plus';
}
