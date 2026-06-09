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
