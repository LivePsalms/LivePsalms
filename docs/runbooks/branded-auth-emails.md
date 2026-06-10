# Runbook — Branded Auth Emails (Resend SMTP)

Status: **Live in production** (shipped via PR #24, merged to `main`; Resend SMTP + DNS + logo all configured 2026-06-10).

This covers the LivePsalms-branded Supabase auth emails and the provider-aware "Change Password" UI: how they're built, how to change copy, how to re-apply config, and how to debug deliverability.

---

## What this system is

- **Provider-aware password change.** `src/auth/passwordCapability.ts` + `src/auth/components/SecuritySection.tsx` (used by `ProfilePage`). "Change Password" is an active button only when `app_metadata.providers` includes `email`; Google/Apple-only accounts see a disabled "Password managed by your <provider> account" row. The gate is presentational only — there is no server guard (triggering a reset for a password-less account is a legitimate set-password path, not a vulnerability).
- **Branded emails ("Lamplight" direction).** All active Supabase auth emails are re-skinned to the brand: confirmation, recovery (reset password), magic_link, invite, email_change, reauthentication, plus the `password_changed` security notification.
- **Sender:** `LivePsalms <noreply@livepsalms.com>` via **Resend** custom SMTP.

## Source of truth & file map

`supabase/config.toml` is authoritative — a `supabase config push` overwrites any edits made in the Supabase Dashboard. Don't manage these emails from the Dashboard unless you intend to stop using `config push`.

| File | Role |
| --- | --- |
| `scripts/email-templates/base.html` | Brand shell (logo, kicker, divider, Psalm 119:105 footer, support footer) with `{{PREHEADER}}` / `{{LOGO_URL}}` / `{{CONTENT}}` slots |
| `scripts/email-templates/render.mjs` | Pure `renderEmail()` + `TEMPLATES` data (all copy) + `LOGO_URL` constant |
| `scripts/build-email-templates.mjs` | `npm run build:emails` → generates the files below |
| `supabase/templates/*.html` | **Generated** per-email HTML (committed). Do not hand-edit — edit source + rebuild |
| `supabase/templates/preview.html` | Generated all-in-one preview for visual QA (not referenced by config) |
| `supabase/config.toml` → `[auth.email.smtp]`, `[auth.email.template.*]`, `[auth.email.notification.password_changed]` | Wires Resend SMTP + points each email at its template |

## Configured values (Resend)

- SMTP host `smtp.resend.com`, port `465`, user `resend`, pass `env(RESEND_SMTP_PASSWORD)` (the Resend `re_…` API key).
- Sender: `admin_email = noreply@livepsalms.com`, `sender_name = LivePsalms`.
- `livepsalms.com` verified in Resend (SPF/DKIM/DMARC).
- Logo: Supabase Storage public bucket `brand-assets` → `LOGO_URL = https://auth.livepsalms.com/storage/v1/object/public/brand-assets/Psalms_logo_(80%20x%2080).png`.

---

## How to change email copy or design

1. Edit `scripts/email-templates/render.mjs` (copy/subjects/preheaders in `TEMPLATES`) and/or `scripts/email-templates/base.html` (shared chrome).
2. Rebuild: `npm run build:emails`.
3. Eyeball `supabase/templates/preview.html` in a browser.
4. Run tests: `npm test -- scripts/email-templates/render.test.ts`.
5. Commit the source **and** the regenerated `supabase/templates/*.html` (they must stay in sync — CI/build re-run should produce no diff).
6. Re-apply to the live project (see below).

## How to (re-)apply config to the hosted project

`env(RESEND_SMTP_PASSWORD)` is resolved from the **shell environment / dotenv at push time** — it is NOT `supabase secrets set` (that store only feeds Edge Functions).

```bash
# one-time: link the repo to the hosted project (ref in Dashboard → Project Settings → General)
npx supabase link --project-ref <project-ref>

# key lives in a gitignored env file
# supabase/.env.production  →  RESEND_SMTP_PASSWORD=re_xxx   (already gitignored)

# apply SMTP + templates
npx @dotenvx/dotenvx run -f supabase/.env.production -- npx supabase config push
```

Plain alternative (no dotenvx): `export RESEND_SMTP_PASSWORD=re_xxx` then `npx supabase config push`.

## How to rotate the logo

Upload a new object to the `brand-assets` bucket (keep it public, ~80×80, small KB), copy its public URL, set `LOGO_URL` in `render.mjs`, `npm run build:emails`, commit, re-push config. Email clients can't use relative paths — `LOGO_URL` must stay an absolute, publicly reachable URL.

---

## Verify it works (smoke test)

1. In the app, sign in with an **email/password** account → Profile → **Change Password**.
2. Confirm the email arrives **from `LivePsalms <noreply@livepsalms.com>`** and renders in **Gmail + Apple Mail**: logo loads, fonts/fallbacks fine, CTA works, Psalm 119:105 footer present.
3. Sign in with a **Google-only** account → Profile → Security shows the greyed "Password managed by your Google account" row (no button).
4. (Optional) Check Resend Dashboard → **Logs** for the delivered message + open/click events.

## Troubleshooting

- **Email lands in spam / rejected:** re-check Resend domain status is **Verified** (SPF/DKIM/DMARC still present at the DNS host; Cloudflare records DNS-only, not proxied).
- **Logo doesn't render in the email:** open `LOGO_URL` in a browser — must be HTTP 200, `image/png`, and the bucket must be public. A `"Bucket not found"`/`403` means the bucket lost its public flag.
- **`config push` says the env var is empty:** you didn't load `supabase/.env.production` (use the dotenvx command or `export` first). `supabase secrets set` does NOT help here.
- **Dashboard edits disappeared:** expected — `config.toml` is authoritative and overwrites on push. Edit source files instead.
- **Template shows a raw `{{ .Something }}` to recipients:** that's a Supabase Go template var the server didn't substitute — check the variable name matches Supabase's auth template vars (`{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .NewEmail }}`, `{{ .Email }}`).

## Known limitation

Supabase auth email has **no configurable Reply-To**. From is `noreply@livepsalms.com`; `support@livepsalms.com` is surfaced in every email footer instead.

## References

- Design spec: `docs/superpowers/specs/2026-06-09-branded-auth-emails-and-provider-aware-password-design.md`
- Implementation plan: `docs/superpowers/plans/2026-06-09-branded-auth-emails-and-provider-aware-password.md`
