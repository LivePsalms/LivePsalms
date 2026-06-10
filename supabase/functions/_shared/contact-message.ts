// supabase/functions/_shared/contact-message.ts
//
// Pure validation + Resend payload building for the public contact form.
// No I/O, no Deno APIs — unit-tested under Vitest (Node), the same discipline
// as _shared/process-job.ts. The Deno handler (contact-message/index.ts) wraps
// these with CORS, secret reading, and the actual fetch to Resend.

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  value?: ContactInput;
}

const NAME_MAX = 100;
const SUBJECT_MAX = 2000;
// Pragmatic shape check: non-space + @ + non-space + . + non-space.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContactInput(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  const email = typeof obj.email === 'string' ? obj.email.trim() : '';
  const subject = typeof obj.subject === 'string' ? obj.subject.trim() : '';

  if (!name) errors.push('name is required');
  else if (name.length > NAME_MAX) errors.push(`name must be at most ${NAME_MAX} characters`);

  if (!email) errors.push('email is required');
  else if (!EMAIL_RE.test(email)) errors.push('email is invalid');

  if (!subject) errors.push('subject is required');
  else if (subject.length > SUBJECT_MAX) errors.push(`subject must be at most ${SUBJECT_MAX} characters`);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: { name, email, subject } };
}

export interface ResendEmail {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  text: string;
  html: string;
}

const FROM_ADDRESS = 'LivePsalms Contact <contact@livepsalms.com>';
const TO_ADDRESS = 'support@livepsalms.com';
const SUBJECT_SNIPPET_MAX = 80;

// Escape the five HTML-significant chars so submitted text can't inject markup
// into the notification email body.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildResendPayload(input: ContactInput): ResendEmail {
  const snippet =
    input.subject.length > SUBJECT_SNIPPET_MAX
      ? `${input.subject.slice(0, SUBJECT_SNIPPET_MAX)}…`
      : input.subject;

  const text = [
    'New contact form submission from livepsalms.com',
    '',
    `Name:    ${input.name}`,
    `Email:   ${input.email}`,
    '',
    'Subject / Message:',
    input.subject,
  ].join('\n');

  const html = [
    '<h2>New contact form submission</h2>',
    `<p><strong>Name:</strong> ${escapeHtml(input.name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(input.email)}</p>`,
    '<p><strong>Subject / Message:</strong></p>',
    `<p style="white-space:pre-wrap">${escapeHtml(input.subject)}</p>`,
  ].join('\n');

  return {
    from: FROM_ADDRESS,
    to: [TO_ADDRESS],
    reply_to: input.email,
    subject: `New contact form message: ${snippet}`,
    text,
    html,
  };
}
