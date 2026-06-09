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
