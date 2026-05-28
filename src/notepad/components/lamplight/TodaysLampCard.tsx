import { Link } from 'react-router-dom';
import { useTodaysLamp } from '../../hooks/useTodaysLamp';
import type { LamplightAdapter, LamplightVoice, LamplightTradition } from '../../storage/lamplight-adapter';
import type { DailyDevotion } from '../../storage/lamplight-artifacts';
import { TodaysLampLoading } from './TodaysLampLoading';
import { TodaysLampError } from './TodaysLampError';

export interface TodaysLampCardProps {
  adapter: LamplightAdapter;
  userId: string;
  localDate: string;
  voicePreference: LamplightVoice;
  traditionHint: LamplightTradition;
  firstName: string | null;
}

export function TodaysLampCard({
  adapter, userId, localDate, voicePreference, traditionHint, firstName,
}: TodaysLampCardProps) {
  const { state, retry } = useTodaysLamp({ adapter, userId, localDate });

  if (state.phase === 'loading') return <TodaysLampLoading step={state.loadingStep} firstName={firstName} />;
  if (state.phase === 'error')   return <TodaysLampError reason={state.reason} firstName={firstName} onRetry={retry} />;

  return (
    <Devotion
      artifact={state.artifact}
      localDate={localDate}
      voicePreference={voicePreference}
      traditionHint={traditionHint}
    />
  );
}

function Devotion(props: {
  artifact: DailyDevotion;
  localDate: string;
  voicePreference: LamplightVoice;
  traditionHint: LamplightTradition;
}) {
  const { artifact, localDate, voicePreference, traditionHint } = props;
  return (
    <div
      className="px-6 py-6 max-w-[640px] mx-auto"
      style={{ background: 'var(--alabaster)' }}
    >
      <div
        className="flex items-center gap-2 mb-5 text-[11px]"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        <span aria-hidden>🕯</span>
        <span>Today · {formatLocalDate(localDate)}</span>
      </div>

      <p
        className="mb-6 text-sm leading-relaxed"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        {artifact.opening}
      </p>

      <div
        className="border-t border-b py-4 mb-6"
        style={{ borderColor: 'var(--pale-stone)' }}
      >
        <div
          className="text-[11px] mb-2 uppercase tracking-wider"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          {artifact.scripture.ref}
        </div>
        <p
          className="text-lg italic leading-relaxed"
          style={{ color: 'var(--deep-umber)', fontFamily: 'Cormorant Garamond, serif' }}
        >
          {artifact.scripture.text}
        </p>
      </div>

      <p
        className="mb-6 text-sm leading-relaxed"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        {artifact.reflection}
      </p>

      <p
        className="mb-6 text-sm italic pl-4 border-l-2 leading-relaxed"
        style={{
          color: 'var(--deep-umber)',
          fontFamily: 'Outfit, sans-serif',
          borderColor: 'var(--pale-stone)',
        }}
      >
        {artifact.prompt}
      </p>

      <div
        className="border-t pt-4 mb-4 text-[11px]"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif', borderColor: 'var(--pale-stone)' }}
      >
        <div className="mb-1">Drawing from your notes about:</div>
        <ul className="list-disc list-inside space-y-0.5">
          {artifact.note_citations.map((c, i) => (
            <li key={`${c.note_id}-${i}`}>{c.reason}</li>
          ))}
        </ul>
      </div>

      <div
        className="flex items-center gap-3 text-[11px]"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif', opacity: 0.7 }}
      >
        <span>Voice: {voicePreference}</span>
        <span aria-hidden>·</span>
        <span>Tradition: {traditionHint}</span>
        <span aria-hidden>·</span>
        <Link to="/profile" className="underline" style={{ color: 'var(--deep-umber)' }}>
          Edit preferences →
        </Link>
      </div>
    </div>
  );
}

export function formatLocalDate(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(s => Number.parseInt(s, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}
