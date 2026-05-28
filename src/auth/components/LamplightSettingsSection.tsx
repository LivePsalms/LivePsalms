import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type {
  LamplightAdapter,
  LamplightVoice,
  LamplightTradition,
} from '@/notepad/storage/lamplight-adapter';
import { useLamplightSettings } from '@/notepad/hooks/useLamplightSettings';
import { EntitlementBlock } from './EntitlementBlock';
import type { LamplightEntitlement, PromoConfig } from '@/notepad/storage/lamplight-adapter';

export interface LamplightSettingsSectionProps {
  adapter: LamplightAdapter;
  userId: string;
}

const VOICES: LamplightVoice[] = ['Lord', 'Father', 'Abba', 'Jesus'];
const TRADITIONS: LamplightTradition[] = ['evangelical', 'catholic', 'orthodox', 'unspecified'];

export function LamplightSettingsSection({ adapter, userId }: LamplightSettingsSectionProps) {
  const { settings, upsert, deleteAll, isLoading } = useLamplightSettings({ adapter, userId });
  const [confirmTurnOff, setConfirmTurnOff] = useState(false);

  const [entitlement, setEntitlement] = useState<LamplightEntitlement | null>(null);
  const [promo, setPromo] = useState<PromoConfig>({ promoActive: false, promoEndsAt: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ent, p] = await Promise.all([
          adapter.getEntitlement(userId),
          adapter.getPromoConfig(),
        ]);
        if (cancelled) return;
        setEntitlement(ent);
        setPromo(p);
      } catch {
        // Best-effort — block just won't render if these fail.
      }
    })();
    return () => { cancelled = true; };
  }, [adapter, userId]);

  if (isLoading) {
    return (
      <div
        className="px-6 py-6 rounded-xl"
        style={{ background: 'var(--alabaster)', border: '1px solid var(--pale-stone)' }}
      >
        <p className="text-xs" style={{ color: 'var(--silica)' }}>Loading Lamplight settings…</p>
      </div>
    );
  }

  const enabled = settings?.enabled ?? false;
  const voice = settings?.voicePreference ?? 'Lord';
  const tradition = settings?.traditionHint ?? 'unspecified';

  const handleToggle = async (next: boolean) => {
    if (!next && enabled) {
      setConfirmTurnOff(true);
      return;
    }
    await upsert({
      enabled: next,
      consentDecidedAt: new Date().toISOString(),
    });
  };

  const handleConfirmTurnOff = async () => {
    await upsert({ enabled: false });
    setConfirmTurnOff(false);
  };

  return (
    <div
      className="px-6 py-6 rounded-xl"
      style={{ background: 'var(--alabaster)', border: '1px solid var(--pale-stone)' }}
    >
      <h3
        className="text-sm mb-4"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
      >
        Lamplight
      </h3>

      <EntitlementBlock entitlement={entitlement} promo={promo} />

      <label className="flex items-center gap-2 mb-4 text-xs cursor-pointer">
        <input
          type="checkbox"
          aria-label="Lamplight on"
          checked={enabled}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <span style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}>
          Lamplight on
        </span>
      </label>

      <label className="block text-xs mb-1" htmlFor="lamplight-voice" style={{ color: 'var(--silica)' }}>
        Voice preference
      </label>
      <select
        id="lamplight-voice"
        aria-label="Voice preference"
        value={voice}
        disabled={!enabled}
        onChange={(e) => upsert({ voicePreference: e.target.value as LamplightVoice })}
        className="block w-full mb-4 px-3 py-2 text-xs rounded"
        style={{
          background: 'var(--plaster)', color: 'var(--deep-umber)',
          border: '1px solid var(--pale-stone)',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>

      <label className="block text-xs mb-1" htmlFor="lamplight-tradition" style={{ color: 'var(--silica)' }}>
        Tradition hint
      </label>
      <select
        id="lamplight-tradition"
        aria-label="Tradition hint"
        value={tradition}
        disabled={!enabled}
        onChange={(e) => upsert({ traditionHint: e.target.value as LamplightTradition })}
        className="block w-full mb-6 px-3 py-2 text-xs rounded"
        style={{
          background: 'var(--plaster)', color: 'var(--deep-umber)',
          border: '1px solid var(--pale-stone)',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        {TRADITIONS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="text-xs"
            style={{ color: '#b04040', fontFamily: 'Outfit, sans-serif' }}
          >
            Forget my Lamplight history
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete every Lamplight record?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes every Lamplight record we have for your account — settings,
              entitlements, embeddings, artifacts, jobs, suggestions, and connections.
              Your notes are not touched. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteAll()}>
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmTurnOff} onOpenChange={setConfirmTurnOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn Lamplight off?</AlertDialogTitle>
            <AlertDialogDescription>
              Lamplight will stop reading new notes. Your existing artifacts are preserved
              — you can turn it back on anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmTurnOff()}>
              Turn off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
