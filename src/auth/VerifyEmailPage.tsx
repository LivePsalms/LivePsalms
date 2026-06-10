import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthSession } from './context/useAuthSession';

const PENDING_EMAIL_KEY = 'lp.verifyEmail';

export interface VerifyEmailPageProps {
  cooldownSeconds?: number;
}

export function VerifyEmailPage({ cooldownSeconds = 45 }: VerifyEmailPageProps) {
  const navigate = useNavigate();
  const { user, session } = useAuthSession();
  const [email] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(PENDING_EMAIL_KEY);
    } catch {
      return null;
    }
  });
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // No pending email → nothing to verify here.
  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
  }, [email, navigate]);

  // Auto-advance once verification establishes a session (incl. cross-tab sync).
  useEffect(() => {
    if (user) navigate('/notepad/notes', { replace: true });
  }, [user, navigate]);

  // Clear the cooldown interval on unmount.
  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  const startCooldown = () => {
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
    if (!email || resending || cooldown > 0) return;
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

  if (!email) return null;

  const mmss = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}`;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--app-bg)' }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-8 text-center"
        style={{
          background: 'var(--alabaster)',
          border: '1px solid var(--pale-stone)',
          boxShadow: '0 4px 24px rgba(58, 52, 38, 0.08)',
        }}
      >
        <img src="/logo-icon.png" alt="LivePsalms" className="h-10 w-auto mb-4 mx-auto" />
        <h1
          className="text-lg font-medium mb-2"
          style={{ color: 'var(--deep-umber)', fontFamily: 'Cormorant Garamond, serif' }}
        >
          Check your email
        </h1>
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
          Click it to finish creating your account. Don't see it? Check your spam folder.
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
          onClick={() => navigate('/login')}
          className="mt-4 text-xs underline hover:opacity-70 transition-opacity"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          ← Back to sign in
        </button>
      </div>
    </div>
  );
}
