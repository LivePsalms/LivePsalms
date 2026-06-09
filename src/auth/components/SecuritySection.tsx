import type { CSSProperties } from 'react';
import { getPasswordCapability } from '../passwordCapability';

interface SecuritySectionProps {
  providers: string[];
  onChangePassword: () => void;
  sectionStyle: CSSProperties;
  labelStyle: CSSProperties;
}

export function SecuritySection({
  providers,
  onChangePassword,
  sectionStyle,
  labelStyle,
}: SecuritySectionProps) {
  const { canChange, managedBy } = getPasswordCapability({ app_metadata: { providers } });
  const googleLinked = providers.includes('google');
  const appleLinked = providers.includes('apple');
  const managedLabel =
    managedBy === 'your linked account' ? 'your linked account' : `your ${managedBy} account`;

  return (
    <div style={sectionStyle}>
      <p style={labelStyle}>SECURITY</p>
      <div className="flex flex-col gap-3">
        {canChange ? (
          <button
            data-testid="security-change-password"
            onClick={onChangePassword}
            className="text-left text-xs hover:opacity-70 transition-opacity"
            style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
          >
            Change Password →
          </button>
        ) : (
          <div data-testid="security-password-managed" className="flex flex-col gap-1">
            <span
              className="text-xs"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
            >
              Change Password
            </span>
            <span
              className="text-xs"
              style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif', opacity: 0.8 }}
            >
              Password managed by {managedLabel}
            </span>
          </div>
        )}
        <p
          data-testid="security-google"
          className="text-xs"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Google: {googleLinked ? 'Linked' : 'Not linked'}
        </p>
        <p
          data-testid="security-apple"
          className="text-xs"
          style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}
        >
          Apple: {appleLinked ? 'Linked' : 'Not linked'}
        </p>
      </div>
    </div>
  );
}
