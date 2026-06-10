import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuthSession } from './context/useAuthSession';

export interface VerifyEmailNoticeProps {
  email: string;
  onBack: () => void;
  onVerified?: () => void;
  cooldownSeconds?: number;
}

export function VerifyEmailNotice({
  email,
  onBack,
  onVerified,
  cooldownSeconds = 45,
}: VerifyEmailNoticeProps) {
  const { user, session } = useAuthSession();
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-advance once verification establishes a session (incl. cross-tab sync).
  useEffect(() => {
    if (user) onVerified?.();
  }, [user, onVerified]);

  // Clear the cooldown interval on unmount.
  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  const startCooldown = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCooldown(cooldownSeconds);
    intervalRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    try {
      await session.resendSignupEmail(email);
      toast.success('Verification email sent.');
      startCooldown();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const mmss = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}`;

  return (
    <div className="text-center">
      <h2
        className="text-lg font-medium mb-2"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Cormorant Garamond, serif' }}
      >
        Check your email
      </h2>
      <p
        className="text-sm mb-1"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        We sent a verification link to
      </p>
      <p
        className="text-sm font-medium mb-4"
        style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
      >
        {email}
      </p>
      <p
        className="text-xs mb-6"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        Click it to finish creating your account. Don&apos;t see it? Check your spam folder.
      </p>
      <button
        type="button"
        onClick={handleResend}
        disabled={resending || cooldown > 0}
        className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity"
        style={{
          background: 'var(--deep-umber)',
          color: 'var(--plaster)',
          fontFamily: 'Outfit, sans-serif',
          opacity: resending || cooldown > 0 ? 0.6 : 1,
        }}
      >
        {cooldown > 0 ? `Resend in ${mmss}` : resending ? 'Sending…' : 'Resend email'}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="mt-4 text-xs underline hover:opacity-70 transition-opacity"
        style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
      >
        ← Back to sign in
      </button>
    </div>
  );
}
