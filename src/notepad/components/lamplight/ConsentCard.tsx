import { useState } from 'react';
import type { LamplightVoice, LamplightTradition } from '../../storage/lamplight-adapter';

export interface ConsentCardProps {
  onTurnOn: (choices: { voicePreference: LamplightVoice; traditionHint: LamplightTradition }) => void;
  onMaybeLater: () => void;
}

const VOICES: LamplightVoice[] = ['Lord', 'Father', 'Abba', 'Jesus'];
const TRADITIONS: { value: LamplightTradition; label: string }[] = [
  { value: 'evangelical', label: 'Evangelical' },
  { value: 'catholic', label: 'Catholic' },
  { value: 'orthodox', label: 'Orthodox' },
  { value: 'unspecified', label: 'Skip' },
];

export function ConsentCard({ onTurnOn, onMaybeLater }: ConsentCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [voice, setVoice] = useState<LamplightVoice>('Lord');
  const [tradition, setTradition] = useState<LamplightTradition>('unspecified');

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[420px] px-6 py-10 text-center"
      style={{ background: 'var(--alabaster)' }}
    >
      <div className="text-3xl mb-3" aria-hidden>🕯</div>
      <h3
        className="text-xl mb-3"
        style={{ fontFamily: 'Cormorant Garamond, serif', color: 'var(--deep-umber)' }}
      >
        Welcome the lamp.
      </h3>
      <p
        className="text-sm max-w-md leading-relaxed mb-4"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        A quiet companion that draws a daily devotion from your own journey.
        It reads only your notes, cites every verse, and never trains on your data.
      </p>

      {!revealed && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="px-4 py-2 text-xs rounded"
            style={{
              background: 'var(--deep-umber)', color: 'var(--alabaster)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Turn on Lamplight
          </button>
          <button
            type="button"
            onClick={onMaybeLater}
            className="px-4 py-2 text-xs rounded"
            style={{
              background: 'transparent',
              border: '1px solid var(--pale-stone)',
              color: 'var(--deep-umber)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Maybe later
          </button>
        </div>
      )}

      {revealed && (
        <div className="w-full max-w-md mt-4 text-left">
          <p
            className="text-[11px] uppercase tracking-widest mb-2"
            style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
          >
            Optional — helps Lamplight speak in your tradition
          </p>
          <fieldset className="mb-4">
            <legend className="text-xs mb-1" style={{ color: 'var(--deep-umber)' }}>
              Tradition
            </legend>
            <div className="flex gap-3 flex-wrap">
              {TRADITIONS.map((t) => (
                <label key={t.value} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="tradition"
                    value={t.value}
                    checked={tradition === t.value}
                    onChange={() => setTradition(t.value)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mb-4">
            <legend className="text-xs mb-1" style={{ color: 'var(--deep-umber)' }}>
              How would you like Lamplight to refer to God?
            </legend>
            <div className="flex gap-3 flex-wrap">
              {VOICES.map((v) => (
                <label key={v} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="voice"
                    value={v}
                    checked={voice === v}
                    onChange={() => setVoice(v)}
                  />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            onClick={() => onTurnOn({ voicePreference: voice, traditionHint: tradition })}
            className="px-4 py-2 text-xs rounded"
            style={{
              background: 'var(--deep-umber)', color: 'var(--alabaster)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
