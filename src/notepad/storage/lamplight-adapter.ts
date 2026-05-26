// Lamplight adapter contract. Implementations live in
// supabase-lamplight-adapter.ts (production) and fake-lamplight-adapter.ts
// (tests). This file is intentionally narrow — sub-projects 2-5 will extend
// it; keep it free of implementation to minimise merge churn.

export type LamplightVoice = 'Lord' | 'Father' | 'Abba' | 'Jesus';
export type LamplightTradition =
  | 'evangelical'
  | 'catholic'
  | 'orthodox'
  | 'unspecified';
export type LamplightTier = 'plus' | 'lite' | 'none';
export type LamplightEntitlementSource =
  | 'promo'
  | 'subscription'
  | 'grant';

export interface LamplightSettings {
  userId: string;
  enabled: boolean;
  quietMode: boolean;
  voicePreference: LamplightVoice;
  traditionHint: LamplightTradition;
  inlineSuggestions: boolean;
  weeklyEmail: boolean;
  consentDecidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LamplightEntitlement {
  userId: string;
  tier: LamplightTier;
  source: LamplightEntitlementSource | null;
  grantedAt: string | null;
  expiresAt: string | null;
}

export interface PromoConfig {
  promoActive: boolean;
  promoEndsAt: string | null;
}

export interface LamplightAdapter {
  getSettings(userId: string): Promise<LamplightSettings | null>;
  upsertSettings(
    userId: string,
    patch: Partial<Omit<LamplightSettings, 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<LamplightSettings>;
  deleteAllUserData(userId: string): Promise<void>;
  getEntitlement(userId: string): Promise<LamplightEntitlement | null>;
  getPromoConfig(): Promise<PromoConfig>;
}
