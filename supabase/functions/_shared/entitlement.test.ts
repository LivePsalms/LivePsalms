// supabase/functions/_shared/entitlement.test.ts
import { describe, it, expect } from 'vitest';
import { hasChatAccess } from './entitlement.ts';

describe('hasChatAccess', () => {
  it('grants when an active promo is on, regardless of tier', () => {
    expect(hasChatAccess({ tier: 'none', promoActive: true })).toBe(true);
    expect(hasChatAccess({ tier: 'lite', promoActive: true })).toBe(true);
  });
  it('grants to plus tier', () => {
    expect(hasChatAccess({ tier: 'plus', promoActive: false })).toBe(true);
  });
  it('denies lite and none without promo', () => {
    expect(hasChatAccess({ tier: 'lite', promoActive: false })).toBe(false);
    expect(hasChatAccess({ tier: 'none', promoActive: false })).toBe(false);
  });
});
