import { useAuthSession } from '@/auth/context/useAuthSession';
import type { LamplightAdapter } from '../../storage/lamplight-adapter';
import { useLamplightSettings } from '../../hooks/useLamplightSettings';
import { useLamplightEntitlement } from '../../hooks/useLamplightEntitlement';
import { SignInGate } from './SignInGate';
import { ConsentCard } from './ConsentCard';
import { OptedOutCard } from './OptedOutCard';
import { OptedInPlaceholder } from './OptedInPlaceholder';
import { PaywallCard } from './PaywallCard';

export interface LamplightTabPanelProps {
  lamplightAdapter: LamplightAdapter;
}

export function LamplightTabPanel({ lamplightAdapter }: LamplightTabPanelProps) {
  const { user } = useAuthSession();
  const userId = user?.id ?? null;

  const settingsState = useLamplightSettings({ adapter: lamplightAdapter, userId });
  const entitlementState = useLamplightEntitlement({ adapter: lamplightAdapter, userId });

  if (!user) return <SignInGate />;

  if (settingsState.isLoading || entitlementState.isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-[420px]"
        style={{ background: 'var(--alabaster)' }}
      >
        <p
          className="text-xs"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Loading…
        </p>
      </div>
    );
  }

  if (settingsState.settings === null) {
    return (
      <ConsentCard
        onTurnOn={({ voicePreference, traditionHint }) =>
          settingsState.upsert({
            enabled: true,
            voicePreference,
            traditionHint,
            consentDecidedAt: new Date().toISOString(),
          })
        }
        onMaybeLater={() =>
          settingsState.upsert({
            enabled: false,
            consentDecidedAt: new Date().toISOString(),
          })
        }
      />
    );
  }

  if (!settingsState.settings.enabled) {
    return <OptedOutCard onChangeMind={() => settingsState.deleteAll()} />;
  }

  if (!entitlementState.hasAccess('today')) {
    return <PaywallCard />;
  }

  return (
    <OptedInPlaceholder
      voicePreference={settingsState.settings.voicePreference}
      traditionHint={settingsState.settings.traditionHint}
    />
  );
}
