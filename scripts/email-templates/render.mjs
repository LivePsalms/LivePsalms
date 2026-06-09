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
 * Pure: same inputs -> same output.
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
