import { describe, it, expect } from 'vitest';
import { validateContactInput, buildResendPayload } from './contact-message';

describe('validateContactInput', () => {
  it('accepts a valid trio and trims whitespace', () => {
    const r = validateContactInput({
      name: '  Sarah Lee  ',
      email: ' sarah@example.com ',
      subject: '  Hello there  ',
    });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({
      name: 'Sarah Lee',
      email: 'sarah@example.com',
      subject: 'Hello there',
    });
  });

  it('rejects missing fields with one error each', () => {
    const r = validateContactInput({ name: '', email: '', subject: '' });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('name is required');
    expect(r.errors).toContain('email is required');
    expect(r.errors).toContain('subject is required');
  });

  it('rejects a malformed email', () => {
    const r = validateContactInput({ name: 'Sarah', email: 'not-an-email', subject: 'Hi' });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('email is invalid');
  });

  it('rejects an over-length name', () => {
    const r = validateContactInput({ name: 'a'.repeat(101), email: 'a@b.com', subject: 'Hi' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('name must be at most'))).toBe(true);
  });

  it('rejects an over-length subject', () => {
    const r = validateContactInput({ name: 'Sarah', email: 'a@b.com', subject: 'a'.repeat(2001) });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('subject must be at most'))).toBe(true);
  });

  it('handles null / undefined / non-object input without throwing', () => {
    expect(validateContactInput(null).ok).toBe(false);
    expect(validateContactInput(undefined).ok).toBe(false);
    expect(validateContactInput('nope').ok).toBe(false);
  });
});

describe('buildResendPayload', () => {
  const input = { name: 'Sarah Lee', email: 'sarah@example.com', subject: 'Prayer request' };

  it('sends from contact@ to support@ with reply_to = submitter email', () => {
    const p = buildResendPayload(input);
    expect(p.from).toBe('LivePsalms Contact <contact@livepsalms.com>');
    expect(p.to).toEqual(['support@livepsalms.com']);
    expect(p.reply_to).toBe('sarah@example.com');
  });

  it('prefixes the subject line and includes the message snippet', () => {
    const p = buildResendPayload(input);
    expect(p.subject).toBe('New contact form message: Prayer request');
  });

  it('truncates a long subject snippet with an ellipsis', () => {
    const p = buildResendPayload({ ...input, subject: 'a'.repeat(100) });
    expect(p.subject.startsWith('New contact form message: ')).toBe(true);
    expect(p.subject.endsWith('…')).toBe(true);
  });

  it('does not truncate at exactly the 80-char limit but does at 81', () => {
    const atLimit = buildResendPayload({ ...input, subject: 'a'.repeat(80) });
    expect(atLimit.subject).toBe(`New contact form message: ${'a'.repeat(80)}`);

    const oneOver = buildResendPayload({ ...input, subject: 'a'.repeat(81) });
    expect(oneOver.subject).toBe(`New contact form message: ${'a'.repeat(80)}…`);
  });

  it('includes name, email, and subject in the text body', () => {
    const p = buildResendPayload(input);
    expect(p.text).toContain('Sarah Lee');
    expect(p.text).toContain('sarah@example.com');
    expect(p.text).toContain('Prayer request');
  });

  it('escapes HTML-significant characters in the html body', () => {
    const p = buildResendPayload({ ...input, name: `A<b>&"'` });
    expect(p.html).toContain('A&lt;b&gt;&amp;&quot;&#39;');
    expect(p.html).not.toContain('<b>');
  });
});
