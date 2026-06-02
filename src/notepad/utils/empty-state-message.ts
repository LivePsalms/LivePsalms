import { sanitizeFirstName } from './personalization';

/**
 * Copy for the editor's no-active-note state. Personalizes with the user's
 * first name when one is available; otherwise returns the name-less line,
 * which is a true subset so the loading state never produces a jarring swap.
 *
 * First-name extraction is delegated to `sanitizeFirstName` (injection-safe,
 * first-token-only). Any unusable name falls back to the plain line.
 */
export function emptyStateMessage(fullName: string | null | undefined): string {
  const firstName = sanitizeFirstName(fullName);
  return firstName ? `The page is yours, ${firstName}.` : 'The page is yours.';
}
