// Deterministic validators for Lamplight artifacts. Pure functions; no I/O.
// validateCitations + applyContentRules + flattenArtifactText are all reusable
// across future artifact types (Today's Lamp, Weekly Insight, etc.).

export interface Citation {
  type: 'note' | 'verse';
  ref: string;
}

export interface ArtifactSection {
  heading: string;
  body: string;
  citations: Citation[];
}

export interface ArtifactLike {
  opening?: string;
  sections: ArtifactSection[];
}

export interface CitationViolation {
  section_index: number;
  reason: 'no_citations' | 'unknown_note' | 'unknown_verse';
  detail: string;
}

export interface CitationCheckResult {
  ok: boolean;
  violations: CitationViolation[];
}

export function validateCitations<T extends ArtifactLike>(
  artifact: T,
  allowed: { allowedNoteIds: Set<string>; allowedVerseRefs: Set<string> },
): CitationCheckResult {
  const violations: CitationViolation[] = [];
  const verseRefsLower = new Set<string>();
  for (const r of allowed.allowedVerseRefs) verseRefsLower.add(r.toLowerCase());

  artifact.sections.forEach((section, idx) => {
    if (!section.citations || section.citations.length === 0) {
      violations.push({
        section_index: idx,
        reason: 'no_citations',
        detail: `section "${section.heading}" has no citations`,
      });
      return;
    }
    for (const cite of section.citations) {
      if (cite.type === 'note' && !allowed.allowedNoteIds.has(cite.ref)) {
        violations.push({
          section_index: idx,
          reason: 'unknown_note',
          detail: `cited note "${cite.ref}" is not in the user's context`,
        });
      } else if (cite.type === 'verse' && !verseRefsLower.has(cite.ref.toLowerCase())) {
        violations.push({
          section_index: idx,
          reason: 'unknown_verse',
          detail: `cited verse "${cite.ref}" is not in the retrieved passages`,
        });
      }
    }
  });

  return { ok: violations.length === 0, violations };
}

export interface ContentRuleViolation {
  family: 'banned' | 'contested' | 'growth';
  rule: string;
  snippet: string;
}

export interface ContentRules {
  banned: RegExp[];
  contested: string[];
  growth: RegExp[];
  classifier?: (text: string) => Promise<ContentRuleViolation[]>;
}

export interface ContentRuleResult {
  ok: boolean;
  violations: ContentRuleViolation[];
}

const SNIPPET_RADIUS = 40; // chars before + after the match

function snippetAround(text: string, start: number, end: number): string {
  const lo = Math.max(0, start - SNIPPET_RADIUS);
  const hi = Math.min(text.length, end + SNIPPET_RADIUS);
  return text.slice(lo, hi);
}

export async function applyContentRules(
  text: string,
  rules: ContentRules,
): Promise<ContentRuleResult> {
  const violations: ContentRuleViolation[] = [];

  for (const re of rules.banned) {
    // Re-create a global-flagged copy so we can find all matches.
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = global.exec(text)) !== null) {
      violations.push({
        family: 'banned',
        rule: re.source,
        snippet: snippetAround(text, m.index, m.index + m[0].length),
      });
      if (m[0].length === 0) global.lastIndex++;
    }
  }

  const textLower = text.toLowerCase();
  for (const ref of rules.contested) {
    const refLower = ref.toLowerCase();
    let i = textLower.indexOf(refLower);
    while (i !== -1) {
      violations.push({
        family: 'contested',
        rule: ref,
        snippet: snippetAround(text, i, i + refLower.length),
      });
      i = textLower.indexOf(refLower, i + refLower.length);
    }
  }

  for (const re of rules.growth) {
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = global.exec(text)) !== null) {
      violations.push({
        family: 'growth',
        rule: re.source,
        snippet: snippetAround(text, m.index, m.index + m[0].length),
      });
      if (m[0].length === 0) global.lastIndex++;
    }
  }

  if (rules.classifier) {
    const extra = await rules.classifier(text);
    violations.push(...extra);
  }

  return { ok: violations.length === 0, violations };
}

export function flattenArtifactText(artifact: ArtifactLike): string {
  const parts: string[] = [];
  if (artifact.opening) parts.push(artifact.opening);
  for (const s of artifact.sections) {
    parts.push(s.heading);
    parts.push(s.body);
  }
  return parts.join('\n\n');
}
