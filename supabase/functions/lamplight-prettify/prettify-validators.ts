export type Density = 'light' | 'balanced' | 'rich';
type Role = 'key-point' | 'topic' | 'theme';
type Kind = 'underline' | 'bracket' | 'margin-arrow';

export interface DensityBudget {
  keyPoint: number;
  topicTheme: number; // combined cap on topic + theme highlights
  decorations: number;
  connections: number;
}

export const DENSITY_BUDGETS: Record<Density, DensityBudget> = {
  light: { keyPoint: 3, topicTheme: 1, decorations: 2, connections: 1 },
  balanced: { keyPoint: 4, topicTheme: 2, decorations: 4, connections: 2 },
  rich: { keyPoint: 6, topicTheme: 4, decorations: 8, connections: 4 },
};

export interface CleanHighlight { quote: string; occurrence: number; role: Role; }
export interface CleanDecoration { quote: string; occurrence: number; kind: Kind; }
export interface CleanConnection {
  from_quote: string; from_occurrence: number;
  to_quote: string; to_occurrence: number;
}
export interface CleanPlan {
  summary: string;
  highlights: CleanHighlight[];
  decorations: CleanDecoration[];
  connections: CleanConnection[];
}

const ROLES = new Set<Role>(['key-point', 'topic', 'theme']);
const KINDS = new Set<Kind>(['underline', 'bracket', 'margin-arrow']);

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Count whitespace-tolerant, case-insensitive occurrences of `quote` in `content`.
function countOccurrences(content: string, quote: string): number {
  const nQuote = norm(quote);
  if (!nQuote) return 0;
  const nContent = norm(content);
  let count = 0;
  let idx = nContent.indexOf(nQuote);
  while (idx !== -1) {
    count++;
    idx = nContent.indexOf(nQuote, idx + nQuote.length);
  }
  return count;
}

function clampOccurrence(content: string, quote: string, requested: unknown): number | null {
  const total = countOccurrences(content, quote);
  if (total === 0) return null;
  const req = typeof requested === 'number' && Number.isInteger(requested) ? requested : 1;
  if (req < 1 || req > total) return 1;
  return req;
}

interface RawPlan {
  summary?: unknown;
  highlights?: unknown;
  decorations?: unknown;
  connections?: unknown;
}

export function validatePrettify(
  raw: RawPlan,
  contentText: string,
  density: Density,
): { plan: CleanPlan; survived: boolean } {
  const budget = DENSITY_BUDGETS[density];
  const summary = typeof raw.summary === 'string' ? raw.summary.slice(0, 280) : '';

  const rawHighlights = Array.isArray(raw.highlights) ? raw.highlights : [];
  const keyPoints: CleanHighlight[] = [];
  const topicThemes: CleanHighlight[] = [];
  for (const h of rawHighlights as Array<Record<string, unknown>>) {
    const quote = typeof h.quote === 'string' ? h.quote : '';
    const role = h.role as Role;
    if (!quote || !ROLES.has(role)) continue;
    const occurrence = clampOccurrence(contentText, quote, h.occurrence);
    if (occurrence === null) continue;
    const clean: CleanHighlight = { quote, occurrence, role };
    if (role === 'key-point') {
      if (keyPoints.length < budget.keyPoint) keyPoints.push(clean);
    } else if (topicThemes.length < budget.topicTheme) {
      topicThemes.push(clean);
    }
  }
  const highlights = [...keyPoints, ...topicThemes];

  const rawDecorations = Array.isArray(raw.decorations) ? raw.decorations : [];
  const decorations: CleanDecoration[] = [];
  for (const d of rawDecorations as Array<Record<string, unknown>>) {
    if (decorations.length >= budget.decorations) break;
    const quote = typeof d.quote === 'string' ? d.quote : '';
    const kind = d.kind as Kind;
    if (!quote || !KINDS.has(kind)) continue;
    const occurrence = clampOccurrence(contentText, quote, d.occurrence);
    if (occurrence === null) continue;
    decorations.push({ quote, occurrence, kind });
  }

  const rawConnections = Array.isArray(raw.connections) ? raw.connections : [];
  const connections: CleanConnection[] = [];
  for (const c of rawConnections as Array<Record<string, unknown>>) {
    if (connections.length >= budget.connections) break;
    const fromQuote = typeof c.from_quote === 'string' ? c.from_quote : '';
    const toQuote = typeof c.to_quote === 'string' ? c.to_quote : '';
    if (!fromQuote || !toQuote) continue;
    const fromOcc = clampOccurrence(contentText, fromQuote, c.from_occurrence);
    const toOcc = clampOccurrence(contentText, toQuote, c.to_occurrence);
    if (fromOcc === null || toOcc === null) continue;
    connections.push({
      from_quote: fromQuote, from_occurrence: fromOcc,
      to_quote: toQuote, to_occurrence: toOcc,
    });
  }

  const survived = highlights.length + decorations.length + connections.length > 0;
  return { plan: { summary, highlights, decorations, connections }, survived };
}
