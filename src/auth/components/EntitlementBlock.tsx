import type { LamplightEntitlement, PromoConfig } from '@/notepad/storage/lamplight-adapter';

export interface EntitlementBlockProps {
  entitlement: LamplightEntitlement | null;
  promo: PromoConfig;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(d);
}

export function EntitlementBlock({ entitlement, promo }: EntitlementBlockProps) {
  const tier = entitlement?.tier ?? 'none';

  if (tier === 'none' && !promo.promoActive) return null;

  let heading: string;
  let detail: string | null = null;
  let caption: string | null = null;

  if (tier === 'plus' || tier === 'lite') {
    heading = tier === 'plus' ? 'Lamplight Plus' : 'Lamplight Lite';
    const fmt = formatDate(entitlement?.expiresAt ?? null);
    detail = fmt ? `until ${fmt}` : null;
    caption = entitlement?.source ? `via ${entitlement.source}` : null;
  } else {
    heading = 'Free during launch promo';
    const fmt = formatDate(promo.promoEndsAt);
    detail = fmt ? `ends ${fmt}` : null;
  }

  return (
    <div
      className="mb-4 px-4 py-3 rounded-md"
      style={{ background: 'var(--alabaster)', border: '1px solid var(--pale-stone)' }}
      data-testid="entitlement-block"
    >
      <div
        className="text-sm"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
      >
        {heading}
        {detail ? <span className="ml-2 text-xs" style={{ color: 'var(--silica)' }}>· {detail}</span> : null}
      </div>
      {caption ? (
        <div className="mt-1 text-[11px]" style={{ color: 'var(--silica)' }}>{caption}</div>
      ) : null}
    </div>
  );
}
