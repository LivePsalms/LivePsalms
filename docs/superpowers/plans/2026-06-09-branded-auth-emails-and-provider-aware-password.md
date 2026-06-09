# Branded Auth Emails & Provider-Aware Password Change — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide/disable "Change Password" for users without a password (Google/Apple-only), and send all Supabase auth emails from a branded LivePsalms sender with on-brand "Lamplight" templates.

**Architecture:** Part A (frontend) extracts a pure `getPasswordCapability` helper and a presentational `SecuritySection` component so the gate logic is unit-testable in isolation; `ProfilePage` just wires them. Part B (email) is data-driven: one base HTML shell + a pure `renderEmail` function + a Node build script generate all template files, wired into `supabase/config.toml` alongside a Resend custom-SMTP block.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react, Supabase CLI (`config.toml` auth email templates + custom SMTP), Resend SMTP, Node ESM build script.

**Spec:** [docs/superpowers/specs/2026-06-09-branded-auth-emails-and-provider-aware-password-design.md](../specs/2026-06-09-branded-auth-emails-and-provider-aware-password-design.md)

**Baseline discipline:** The repo ships with pre-existing lint/tsc/test failures (see project memory). Verify your changes add **zero new** errors; do **not** gate on a repo-wide green baseline.

---

## File Structure

**Part A — frontend**
- Create `src/auth/passwordCapability.ts` — pure helper: providers → `{ canChange, managedBy }`.
- Create `src/auth/passwordCapability.test.ts` — unit tests for the helper.
- Create `src/auth/components/SecuritySection.tsx` — presentational Security block (button vs disabled row + provider lines).
- Create `src/auth/components/SecuritySection.test.tsx` — component tests.
- Modify `src/auth/ProfilePage.tsx:305-337` — replace inline Security block with `<SecuritySection …/>`.

**Part B — email**
- Create `scripts/email-templates/base.html` — Direction-A shell with `{{PREHEADER}}` + `{{CONTENT}}` slots.
- Create `scripts/email-templates/render.mjs` — pure `renderEmail(baseHtml, template)` + `TEMPLATES` data + `LOGO_URL`.
- Create `scripts/email-templates/render.test.ts` — tests for `renderEmail`.
- Create `scripts/build-email-templates.mjs` — CLI: reads base, writes `supabase/templates/*.html` + `preview.html`.
- Modify `supabase/config.toml:232-250` — add `[auth.email.smtp]`, `[auth.email.template.*]`, `[auth.email.notification.password_changed]`.
- Generated (committed): `supabase/templates/confirmation.html`, `recovery.html`, `magic_link.html`, `invite.html`, `email_change.html`, `reauthentication.html`, `password_changed.html`, `preview.html`.

---

# PART A — Provider-aware Security section

## Task 1: `getPasswordCapability` pure helper

**Files:**
- Create: `src/auth/passwordCapability.ts`
- Test: `src/auth/passwordCapability.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/auth/passwordCapability.test.ts
import { describe, it, expect } from 'vitest';
import { getPasswordCapability } from './passwordCapability';

describe('getPasswordCapability', () => {
  it('email-only account can change password', () => {
    expect(getPasswordCapability({ app_metadata: { providers: ['email'] } }))
      .toEqual({ canChange: true, managedBy: null });
  });

  it('google+email account can change password', () => {
    expect(getPasswordCapability({ app_metadata: { providers: ['email', 'google'] } }))
      .toEqual({ canChange: true, managedBy: null });
  });

  it('google-only account is managed by Google', () => {
    expect(getPasswordCapability({ app_metadata: { providers: ['google'] } }))
      .toEqual({ canChange: false, managedBy: 'Google' });
  });

  it('apple-only account is managed by Apple', () => {
    expect(getPasswordCapability({ app_metadata: { providers: ['apple'] } }))
      .toEqual({ canChange: false, managedBy: 'Apple' });
  });

  it('falls back to "your linked account" when no known provider', () => {
    expect(getPasswordCapability({ app_metadata: { providers: ['azure'] } }))
      .toEqual({ canChange: false, managedBy: 'your linked account' });
  });

  it('handles missing/empty metadata safely', () => {
    expect(getPasswordCapability(null)).toEqual({ canChange: false, managedBy: 'your linked account' });
    expect(getPasswordCapability({})).toEqual({ canChange: false, managedBy: 'your linked account' });
    expect(getPasswordCapability({ app_metadata: {} })).toEqual({ canChange: false, managedBy: 'your linked account' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/auth/passwordCapability.test.ts`
Expected: FAIL — cannot find module `./passwordCapability`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/auth/passwordCapability.ts
export type PasswordManagedBy = 'Google' | 'Apple' | 'your linked account';

export interface PasswordCapability {
  canChange: boolean;
  managedBy: PasswordManagedBy | null;
}

interface ProviderCarrier {
  app_metadata?: { providers?: string[] | null } | null;
}

/**
 * Determines whether the Security UI should offer "Change Password".
 * Presentational only — `canChange` is true iff the account has an email/password identity.
 */
export function getPasswordCapability(
  user: ProviderCarrier | null | undefined
): PasswordCapability {
  const providers = user?.app_metadata?.providers ?? [];
  if (providers.includes('email')) return { canChange: true, managedBy: null };
  if (providers.includes('google')) return { canChange: false, managedBy: 'Google' };
  if (providers.includes('apple')) return { canChange: false, managedBy: 'Apple' };
  return { canChange: false, managedBy: 'your linked account' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/auth/passwordCapability.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/auth/passwordCapability.ts src/auth/passwordCapability.test.ts
git commit -m "feat(auth): pure helper for password-change capability by provider"
```

---

## Task 2: `SecuritySection` presentational component

**Files:**
- Create: `src/auth/components/SecuritySection.tsx`
- Test: `src/auth/components/SecuritySection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// src/auth/components/SecuritySection.test.tsx
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { SecuritySection } from './SecuritySection';

afterEach(() => cleanup());

const styles = { sectionStyle: {}, labelStyle: {} };

describe('SecuritySection', () => {
  it('renders a working Change Password button for email users', () => {
    const onChangePassword = vi.fn();
    render(
      <SecuritySection providers={['email']} onChangePassword={onChangePassword} {...styles} />
    );
    const btn = screen.getByTestId('security-change-password');
    fireEvent.click(btn);
    expect(onChangePassword).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('security-password-managed')).toBeNull();
  });

  it('renders a disabled managed-by row for Google-only users', () => {
    render(
      <SecuritySection providers={['google']} onChangePassword={vi.fn()} {...styles} />
    );
    expect(screen.queryByTestId('security-change-password')).toBeNull();
    const managed = screen.getByTestId('security-password-managed');
    expect(managed.textContent).toMatch(/managed by your Google account/i);
  });

  it('shows Apple wording for Apple-only users', () => {
    render(
      <SecuritySection providers={['apple']} onChangePassword={vi.fn()} {...styles} />
    );
    expect(screen.getByTestId('security-password-managed').textContent)
      .toMatch(/managed by your Apple account/i);
  });

  it('shows linked status for each provider', () => {
    render(
      <SecuritySection providers={['email', 'google']} onChangePassword={vi.fn()} {...styles} />
    );
    expect(screen.getByTestId('security-google').textContent).toMatch(/Linked/);
    expect(screen.getByTestId('security-apple').textContent).toMatch(/Not linked/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/auth/components/SecuritySection.test.tsx`
Expected: FAIL — cannot find module `./SecuritySection`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/auth/components/SecuritySection.tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/auth/components/SecuritySection.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/auth/components/SecuritySection.tsx src/auth/components/SecuritySection.test.tsx
git commit -m "feat(auth): provider-aware SecuritySection component"
```

---

## Task 3: Wire `SecuritySection` into `ProfilePage`

**Files:**
- Modify: `src/auth/ProfilePage.tsx` (import + replace block at lines ~305-337)

- [ ] **Step 1: Add the import**

At the top of `src/auth/ProfilePage.tsx`, after the existing component imports (e.g. after the `AdminEntryLink` import on line 21), add:

```tsx
import { SecuritySection } from './components/SecuritySection';
```

- [ ] **Step 2: Replace the inline Security block**

Replace the entire block currently at `src/auth/ProfilePage.tsx:305-337` (the `{/* Auth Management */}` comment through its closing `</div>`):

```tsx
        {/* Auth Management */}
        <div style={sectionStyle}>
          <p style={labelStyle}>SECURITY</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={async () => {
                if (!user?.email) return;
                try {
                  await session.resetPassword(user.email);
                  toast.success('Password reset email sent.');
                } catch {
                  toast.error('Could not send reset email. Please try again.');
                }
              }}
              className="text-left text-xs hover:opacity-70 transition-opacity"
              style={{ color: 'var(--deep-umber)', fontFamily: 'Outfit, sans-serif' }}
            >
              Change Password →
            </button>
            <p className="text-xs" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
              Google:{' '}
              {user?.app_metadata?.providers?.includes('google')
                ? 'Linked'
                : 'Not linked'}
            </p>
            <p className="text-xs" style={{ color: 'var(--silica)', fontFamily: 'Outfit, sans-serif' }}>
              Apple:{' '}
              {user?.app_metadata?.providers?.includes('apple')
                ? 'Linked'
                : 'Not linked'}
            </p>
          </div>
        </div>
```

with:

```tsx
        {/* Auth Management */}
        <SecuritySection
          providers={user?.app_metadata?.providers ?? []}
          sectionStyle={sectionStyle}
          labelStyle={labelStyle}
          onChangePassword={async () => {
            if (!user?.email) return;
            try {
              await session.resetPassword(user.email);
              toast.success('Password reset email sent.');
            } catch {
              toast.error('Could not send reset email. Please try again.');
            }
          }}
        />
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc -b --noEmit 2>&1 | grep ProfilePage`
Expected: no output (no new ProfilePage errors). The pre-existing tsc errors are only in `force-sphere.test.ts`.

- [ ] **Step 4: Run the auth tests**

Run: `npm test -- src/auth/passwordCapability.test.ts src/auth/components/SecuritySection.test.tsx`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/auth/ProfilePage.tsx
git commit -m "feat(auth): use provider-aware SecuritySection in ProfilePage"
```

---

# PART B — Branded auth emails

## Task 4: Base shell + pure `renderEmail`

**Files:**
- Create: `scripts/email-templates/base.html`
- Create: `scripts/email-templates/render.mjs`
- Test: `scripts/email-templates/render.test.ts`

> **Note on `LOGO_URL`:** emails cannot use relative paths. `render.mjs` uses an absolute `LOGO_URL` constant set to `https://livepsalms.com/logo-icon.png`. If the logo is hosted elsewhere (e.g. a Supabase Storage public URL), update this one constant before building (see Task 7).

- [ ] **Step 1: Create the base shell**

```html
<!-- scripts/email-templates/base.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <title>LivePsalms</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Outfit:wght@400;500&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background:#988F80;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{PREHEADER}}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#988F80;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#F0ECE8;border-radius:16px;">
          <tr>
            <td style="padding:48px 44px;text-align:center;font-family:'Outfit',Arial,Helvetica,sans-serif;">
              <img src="{{LOGO_URL}}" width="40" height="40" alt="LivePsalms" style="width:40px;height:40px;object-fit:contain;" />
              <div style="font-size:11px;letter-spacing:0.22em;color:#988F80;margin:14px 0 24px;">LIVEPSALMS</div>
              {{CONTENT}}
              <div style="height:1px;background:#CECCCA;margin:28px 0;"></div>
              <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:#988F80;font-style:italic;margin:0;">
                "Your word is a lamp to my feet and a light to my path." — Psalm 119:105
              </p>
              <p style="font-size:11px;color:#8A8B90;margin:18px 0 0;">
                LivePsalms · Questions? <a href="mailto:support@livepsalms.com" style="color:#8A8B90;">support@livepsalms.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

- [ ] **Step 2: Write the failing test**

```ts
// scripts/email-templates/render.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderEmail, TEMPLATES, LOGO_URL } from './render.mjs';

const baseHtml = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'base.html'),
  'utf8'
);

describe('renderEmail', () => {
  const recovery = TEMPLATES.find((t) => t.name === 'recovery')!;

  it('injects headline, body, and CTA into the shell', () => {
    const html = renderEmail(baseHtml, recovery);
    expect(html).toContain("Let's get you back in");
    expect(html).toContain('{{ .ConfirmationURL }}');
    expect(html).toContain('Reset password');
  });

  it('keeps the brand chrome (scripture + support footer + logo)', () => {
    const html = renderEmail(baseHtml, recovery);
    expect(html).toContain('Psalm 119:105');
    expect(html).toContain('support@livepsalms.com');
    expect(html).toContain(LOGO_URL);
    expect(html).not.toContain('{{CONTENT}}');
    expect(html).not.toContain('{{PREHEADER}}');
  });

  it('renders reauthentication as a code block with no CTA link', () => {
    const reauth = TEMPLATES.find((t) => t.name === 'reauthentication')!;
    const html = renderEmail(baseHtml, reauth);
    expect(html).toContain('{{ .Token }}');
    expect(html).not.toContain('href="{{ .ConfirmationURL }}"');
  });

  it('every template defines a non-empty subject and headline', () => {
    for (const t of TEMPLATES) {
      expect(t.subject.length).toBeGreaterThan(0);
      expect(t.headline.length).toBeGreaterThan(0);
    }
  });

  it('covers exactly the seven required templates', () => {
    expect(TEMPLATES.map((t) => t.name).sort()).toEqual(
      ['confirmation', 'email_change', 'invite', 'magic_link', 'password_changed', 'reauthentication', 'recovery']
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- scripts/email-templates/render.test.ts`
Expected: FAIL — cannot find module `./render.mjs`.

- [ ] **Step 4: Write `render.mjs`**

```js
// scripts/email-templates/render.mjs
export const LOGO_URL = 'https://livepsalms.com/logo-icon.png';

const BUTTON = (label, url) =>
  `<a href="${url}" style="display:inline-block;background:#3A3426;color:#F0ECE8;text-decoration:none;font-family:'Outfit',Arial,Helvetica,sans-serif;font-size:14px;font-weight:500;padding:14px 36px;border-radius:100px;">${label}</a>`;

const CODE = (value) =>
  `<div style="font-family:'Outfit',Arial,Helvetica,sans-serif;font-size:28px;letter-spacing:0.3em;color:#3A3426;font-weight:500;padding:8px 0;">${value}</div>`;

const HEADLINE = (text) =>
  `<h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:30px;line-height:1.15;color:#3A3426;margin:0 0 16px;font-weight:500;">${text}</h1>`;

const BODY = (html) =>
  `<p style="font-family:'Outfit',Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:#3A3426;margin:0 auto 28px;max-width:340px;opacity:0.85;">${html}</p>`;

const REASSURANCE = (html) =>
  `<p style="font-family:'Outfit',Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8A8B90;margin:0 auto;max-width:320px;">${html}</p>`;

/**
 * Build the inner content for one template, then inject it + preheader + logo into the base shell.
 * Pure: same inputs → same output.
 */
export function renderEmail(baseHtml, template) {
  const parts = [HEADLINE(template.headline), BODY(template.body)];
  if (template.cta) parts.push(BUTTON(template.cta.label, template.cta.url));
  if (template.code) parts.push(CODE(template.code));
  if (template.reassurance) parts.push(REASSURANCE(template.reassurance));
  const content = parts.join('\n              ');
  return baseHtml
    .replace('{{PREHEADER}}', template.preheader)
    .replace('{{LOGO_URL}}', LOGO_URL)
    .replace('{{CONTENT}}', content);
}

// All copy in the gentle LivePsalms voice (offering, never prophetic).
export const TEMPLATES = [
  {
    name: 'confirmation',
    subject: 'Confirm your email to begin',
    preheader: 'One tap confirms your email and opens LivePsalms.',
    headline: 'Welcome to LivePsalms',
    body: 'Confirm this email address to finish setting up your account and step inside.',
    cta: { label: 'Confirm email', url: '{{ .ConfirmationURL }}' },
    reassurance: "If you didn't create an account, you can safely ignore this email.",
  },
  {
    name: 'recovery',
    subject: "Let's get you back in",
    preheader: 'A link to choose a new password — it rests in 60 minutes.',
    headline: "Let's get you back in",
    body: "We received a request to reset your password. Choose a new one whenever you're ready — this link rests for 60 minutes.",
    cta: { label: 'Reset password', url: '{{ .ConfirmationURL }}' },
    reassurance: "If you didn't ask for this, you can rest easy and ignore it — your password stays exactly as it is.",
  },
  {
    name: 'magic_link',
    subject: 'Your sign-in link',
    preheader: 'Tap to sign in — this link can be used once and expires shortly.',
    headline: 'Your sign-in link',
    body: 'Tap below to sign in to LivePsalms. This link can be used once and expires shortly.',
    cta: { label: 'Sign in', url: '{{ .ConfirmationURL }}' },
    reassurance: "If you didn't request this, you can safely ignore it.",
  },
  {
    name: 'invite',
    subject: "You're invited to LivePsalms",
    preheader: 'Accept your invitation to begin.',
    headline: "You're invited to LivePsalms",
    body: "You've been invited to join LivePsalms. Accept below to create your account and begin.",
    cta: { label: 'Accept invitation', url: '{{ .ConfirmationURL }}' },
    reassurance: "If this wasn't expected, you can safely ignore this email.",
  },
  {
    name: 'email_change',
    subject: 'Confirm your new email address',
    preheader: 'Confirm the new address for your LivePsalms account.',
    headline: 'Confirm your new email',
    body: 'Confirm {{ .NewEmail }} as the new email address for your LivePsalms account.',
    cta: { label: 'Confirm new email', url: '{{ .ConfirmationURL }}' },
    reassurance: "If you didn't request this change, you can safely ignore this email.",
  },
  {
    name: 'reauthentication',
    subject: 'Your verification code',
    preheader: 'Use this code to verify it’s really you.',
    headline: "It's really you?",
    body: 'Use the code below to verify your identity. It expires shortly.',
    code: '{{ .Token }}',
    reassurance: "If you didn't request this, you can safely ignore it.",
  },
  {
    name: 'password_changed',
    subject: 'Your password was changed',
    preheader: 'A quiet note that your password was just updated.',
    headline: 'Your password was changed',
    body: 'The password for your LivePsalms account was just updated.',
    reassurance:
      "If this was you, no action is needed. If it wasn't, reset your password and reach us at support@livepsalms.com right away.",
  },
];
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- scripts/email-templates/render.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/email-templates/base.html scripts/email-templates/render.mjs scripts/email-templates/render.test.ts
git commit -m "feat(email): base shell + pure renderEmail with LivePsalms copy"
```

---

## Task 5: Build script that generates the template files

**Files:**
- Create: `scripts/build-email-templates.mjs`
- Generated: `supabase/templates/*.html` + `supabase/templates/preview.html`

- [ ] **Step 1: Write the build script**

```js
// scripts/build-email-templates.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderEmail, TEMPLATES } from './email-templates/render.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const baseHtml = readFileSync(path.join(here, 'email-templates', 'base.html'), 'utf8');
const outDir = path.join(root, 'supabase', 'templates');

mkdirSync(outDir, { recursive: true });

const previews = [];
for (const template of TEMPLATES) {
  const html = renderEmail(baseHtml, template);
  writeFileSync(path.join(outDir, `${template.name}.html`), html, 'utf8');
  previews.push(
    `<h2 style="font-family:sans-serif">${template.name} — ${template.subject}</h2>\n${html}`
  );
  console.log(`wrote supabase/templates/${template.name}.html`);
}

writeFileSync(
  path.join(outDir, 'preview.html'),
  `<!DOCTYPE html><html><body>${previews.join('<hr/>')}</body></html>`,
  'utf8'
);
console.log('wrote supabase/templates/preview.html');
```

- [ ] **Step 2: Add an npm script**

In `package.json`, inside `"scripts"`, add (after `"build:styles"`):

```json
    "build:emails": "node scripts/build-email-templates.mjs",
```

- [ ] **Step 3: Run the build**

Run: `npm run build:emails`
Expected: console logs `wrote supabase/templates/<name>.html` for all 7 templates plus `preview.html`; files exist.

- [ ] **Step 4: Spot-check the output**

Run: `grep -l "Psalm 119:105" supabase/templates/*.html | wc -l`
Expected: `7` (every generated email carries the footer; `preview.html` also matches, so `8` total from `grep -l` across 8 files — confirm `recovery.html` contains both the headline and `{{ .ConfirmationURL }}`):

Run: `grep -c "{{ .ConfirmationURL }}" supabase/templates/recovery.html`
Expected: `1`.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-email-templates.mjs package.json supabase/templates/
git commit -m "feat(email): build script + generated LivePsalms auth templates"
```

---

## Task 6: Wire SMTP + templates into `supabase/config.toml`

**Files:**
- Modify: `supabase/config.toml` (the commented `[auth.email.smtp]` / template region around lines 232-250)

- [ ] **Step 1: Replace the commented SMTP + template region**

In `supabase/config.toml`, replace the commented block that starts at `# Use a production-ready SMTP server` (line ~231) through the `[auth.email.notification.password_changed]` comment (line ~250) with:

```toml
# Use a production-ready SMTP server (Resend). Secret injected via env — never committed.
[auth.email.smtp]
enabled = true
host = "smtp.resend.com"
port = 465
user = "resend"
pass = "env(RESEND_SMTP_PASSWORD)"
admin_email = "noreply@livepsalms.com"
sender_name = "LivePsalms"

[auth.email.template.confirmation]
subject = "Confirm your email to begin"
content_path = "./supabase/templates/confirmation.html"

[auth.email.template.recovery]
subject = "Let's get you back in"
content_path = "./supabase/templates/recovery.html"

[auth.email.template.magic_link]
subject = "Your sign-in link"
content_path = "./supabase/templates/magic_link.html"

[auth.email.template.invite]
subject = "You're invited to LivePsalms"
content_path = "./supabase/templates/invite.html"

[auth.email.template.email_change]
subject = "Confirm your new email address"
content_path = "./supabase/templates/email_change.html"

[auth.email.template.reauthentication]
subject = "Your verification code"
content_path = "./supabase/templates/reauthentication.html"

[auth.email.notification.password_changed]
enabled = true
subject = "Your password was changed"
content_path = "./supabase/templates/password_changed.html"
```

- [ ] **Step 2: Validate the config parses**

Run: `npx supabase --version` then `npx supabase config push --help`
Expected: commands resolve (CLI present). Do **not** run `config push` yet — secrets/DNS aren't set (Task 7).

If the CLI lints config locally, optionally run `npx supabase start` in a throwaway shell to confirm `config.toml` parses without TOML errors, then `npx supabase stop`. (Skip if Docker isn't available; the subjects/paths above are valid TOML.)

- [ ] **Step 3: Commit**

```bash
git add supabase/config.toml
git commit -m "feat(email): wire Resend SMTP + branded templates in config.toml"
```

---

## Task 7: Operator setup checklist (Resend, DNS, secret, logo) — non-code

> These steps are performed by the operator in external dashboards. No code; document completion in the PR. None of these block earlier commits.

- [ ] **Step 1: Resend account + domain**
  - Create a Resend account; add `livepsalms.com` as a sending domain.
  - Add the SPF, DKIM, and DMARC DNS records Resend provides; wait for "Verified".

- [ ] **Step 2: API key → secret**
  - Create a Resend API key with send permission.
  - Set it as `RESEND_SMTP_PASSWORD` in the Supabase project's env/secrets (used by `config.toml` `env(RESEND_SMTP_PASSWORD)`). Never commit it.

- [ ] **Step 3: Host the logo at an absolute URL**
  - Confirm `https://livepsalms.com/logo-icon.png` serves the logo publicly. If hosting elsewhere (e.g. Supabase Storage public object), update `LOGO_URL` in `scripts/email-templates/render.mjs`, re-run `npm run build:emails`, and commit the regenerated templates.

- [ ] **Step 4: Push config to the hosted project**
  - `npx supabase link --project-ref <ref>` (if not already linked).
  - `npx supabase config push` to apply SMTP + templates. (Alternatively apply via the Management API / dashboard per the spec.)

---

## Task 8: Verification

- [ ] **Step 1: Targeted test run**

Run: `npm test -- src/auth/passwordCapability.test.ts src/auth/components/SecuritySection.test.tsx scripts/email-templates/render.test.ts`
Expected: all PASS.

- [ ] **Step 2: No new type errors**

Run: `npx tsc -b --noEmit 2>&1 | grep -v force-sphere || echo "no new tsc errors"`
Expected: only the pre-existing `force-sphere.test.ts` errors appear (or "no new tsc errors").

- [ ] **Step 3: No new lint errors on touched files**

Run: `npx eslint src/auth/passwordCapability.ts src/auth/components/SecuritySection.tsx src/auth/ProfilePage.tsx`
Expected: clean (0 errors) for these files.

- [ ] **Step 4: Manual UI check (local dev)**

Run: `npm run dev`, sign in as a Google-only user → Profile → Security shows greyed "Change Password" + "Password managed by your Google account", no clickable button. Sign in as an email user → working "Change Password →" sends the toast.

- [ ] **Step 5: Manual email e2e (staging, after Task 7)**

Trigger a password reset for an email account. Confirm the email arrives from `LivePsalms <noreply@livepsalms.com>` via Resend and renders correctly in Gmail + Apple Mail (logo loads, fonts/fallbacks fine, CTA works, Scripture footer present).

- [ ] **Step 6: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to decide merge/PR.

---

## Self-Review Notes

- **Spec coverage:** §1 gating → Tasks 1-3; §2 SMTP/sender → Task 6 + Task 7; §3 templates (Direction A, all 7 incl. password_changed, Scripture footer, robustness, absolute logo) → Tasks 4-5 + Task 7 step 3; §4 testing → Tasks 1,2,4 + Task 8; §5 rollout → Tasks 6-7. Reply-To limitation surfaced in base footer (support@ mailto). ✅
- **Refinement vs spec:** spec listed `supabase/templates/_base.html` + `src/*.html` fragments; plan uses a cleaner data-driven equivalent (base shell + `TEMPLATES` data + pure `renderEmail`) for stronger DRY and unit-testability. Same outputs, same `config.toml` wiring. Spec also said "modify ProfilePage Security section"; plan extracts a `SecuritySection` component for isolation/testability. Both are improvements within scope.
- **Type consistency:** `getPasswordCapability` shape `{ canChange, managedBy }` used identically in helper, component, and tests; `renderEmail(baseHtml, template)` + `TEMPLATES`/`LOGO_URL` names match across `render.mjs`, the build script, and tests.
- **Placeholder scan:** none — all steps contain runnable code/commands. `LOGO_URL` has a concrete default with an explicit update step.
