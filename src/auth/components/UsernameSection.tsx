import { useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { toast } from 'sonner';
import { normalizeUsername, validateUsername } from '@/auth/username/username-rules';
import type { UsernameClaimResult } from '@/auth/username/username-rules';
import { useUsernameAvailability } from '@/auth/username/useUsernameAvailability';

export interface UsernameSectionProps {
  currentUsername: string | null;
  checkAvailable: (name: string) => Promise<boolean>;
  setUsername: (name: string) => Promise<UsernameClaimResult>;
  sectionStyle: CSSProperties;
  labelStyle: CSSProperties;
  inputStyle: CSSProperties;
  debounceMs?: number;
}

export function UsernameSection({
  currentUsername,
  checkAvailable,
  setUsername,
  sectionStyle,
  labelStyle,
  inputStyle,
  debounceMs = 300,
}: UsernameSectionProps) {
  const [value, setValue] = useState(currentUsername ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const normalized = normalizeUsername(value);
  const format = validateUsername(value);
  const unchanged = normalized === (currentUsername ?? '');

  const { status: availability, markTaken } = useUsernameAvailability({
    checkAvailable,
    name: normalized,
    eligible: format.valid && !unchanged,
    debounceMs,
  });

  const canSave =
    format.valid && !unchanged && availability === 'available' && !submitting;

  const status = (() => {
    if (unchanged) return 'This is your current username';
    if (!format.valid) return format.reason ?? null;
    if (availability === 'checking') return 'Checking…';
    if (availability === 'available') return 'Available';
    if (availability === 'taken') return 'Taken';
    return null;
  })();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await setUsername(normalized);
    setSubmitting(false);
    if (result.ok) {
      toast.success('Username updated.');
      return;
    }
    if (result.reason === 'taken') {
      markTaken();
      setSubmitError('That username was just taken. Try another.');
    } else {
      setSubmitError("That username isn't valid.");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={sectionStyle}>
      <p style={labelStyle}>USERNAME</p>
      <div className="flex flex-col gap-2">
        <p
          className="text-xs"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          This is your notepad address.
        </p>
        <input
          type="text"
          aria-label="Username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSubmitError(null);
          }}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={inputStyle}
        />
        {status && (
          <p
            className="text-xs"
            style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
          >
            {status}
          </p>
        )}
        {submitError && (
          <p
            className="text-xs"
            style={{ color: '#b3261e', fontFamily: 'Outfit, sans-serif' }}
          >
            {submitError}
          </p>
        )}
        <button
          type="submit"
          disabled={!canSave}
          className="self-end px-5 py-2 rounded-lg text-xs font-medium transition-opacity"
          style={{
            background: 'var(--deep-umber)',
            color: 'var(--plaster)',
            fontFamily: 'Outfit, sans-serif',
            opacity: canSave ? 1 : 0.6,
          }}
        >
          {submitting ? 'Saving…' : 'Save Username'}
        </button>
      </div>
    </form>
  );
}
