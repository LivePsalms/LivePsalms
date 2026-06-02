// src/components/sections/notepad/mobile/MobileAuthModal.tsx
import { X } from 'lucide-react';
import { AuthCard } from '@/auth/AuthCard';

export interface MobileAuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function MobileAuthModal({ open, onClose }: MobileAuthModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in or create an account"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.35)' }}
      />
      <div className="relative w-full max-w-sm my-auto">
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 flex items-center justify-center w-8 h-8 rounded-full shadow"
          style={{ background: 'var(--alabaster)', border: '1px solid var(--pale-stone)', color: 'var(--deep-umber)' }}
        >
          <X size={16} />
        </button>
        <AuthCard onAuthenticated={onClose} />
      </div>
    </div>
  );
}
