// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

afterEach(() => cleanup());
import { EntitlementBlock } from './EntitlementBlock';
import type { LamplightEntitlement, PromoConfig } from '@/notepad/storage/lamplight-adapter';

const promoActive: PromoConfig = { promoActive: true, promoEndsAt: '2099-06-15T00:00:00Z' };
const promoOff: PromoConfig    = { promoActive: false, promoEndsAt: null };

const plus: LamplightEntitlement = {
  userId: 'u1', tier: 'plus', source: 'subscription',
  grantedAt: '2026-01-01T00:00:00Z', expiresAt: '2099-06-15T00:00:00Z',
};
const lite: LamplightEntitlement = {
  userId: 'u1', tier: 'lite', source: 'grant',
  grantedAt: '2026-01-01T00:00:00Z', expiresAt: null,
};
const none: LamplightEntitlement = {
  userId: 'u1', tier: 'none', source: null, grantedAt: null, expiresAt: null,
};

describe('EntitlementBlock', () => {
  it('renders Plus + expiry + source caption', () => {
    render(<EntitlementBlock entitlement={plus} promo={promoOff} />);
    expect(screen.getByText(/Lamplight Plus/i)).toBeInTheDocument();
    expect(screen.getByText(/Jun 15, 2099/)).toBeInTheDocument();
    expect(screen.getByText(/via subscription/i)).toBeInTheDocument();
  });

  it('renders Lite without expiry (null) and source caption', () => {
    render(<EntitlementBlock entitlement={lite} promo={promoOff} />);
    expect(screen.getByText(/Lamplight Lite/i)).toBeInTheDocument();
    expect(screen.queryByText(/until/i)).not.toBeInTheDocument();
    expect(screen.getByText(/via grant/i)).toBeInTheDocument();
  });

  it('renders launch promo copy when tier=none and promo active', () => {
    render(<EntitlementBlock entitlement={none} promo={promoActive} />);
    expect(screen.getByText(/Free during launch promo/i)).toBeInTheDocument();
    expect(screen.getByText(/Jun 15, 2099/)).toBeInTheDocument();
  });

  it('renders nothing when tier=none and promo inactive', () => {
    const { container } = render(<EntitlementBlock entitlement={none} promo={promoOff} />);
    expect(container.firstChild).toBeNull();
  });

  it('handles null entitlement gracefully (treats as none)', () => {
    const { container } = render(<EntitlementBlock entitlement={null} promo={promoOff} />);
    expect(container.firstChild).toBeNull();
  });
});
