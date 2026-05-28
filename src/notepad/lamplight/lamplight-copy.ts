// Personalized copy helpers for the three non-LLM Lamplight UI surfaces.
// Each helper takes a sanitized firstName (string | null) and returns the
// appropriate variant. Comma form is used here (vs em-dash in the artifact
// opening) because these are short utility strings.

export function loadingState(firstName: string | null): string {
  return firstName
    ? `${firstName}, Today's Lamp is on its way…`
    : `Today's Lamp is on its way…`;
}

export function emptyStateInsufficientNotes(firstName: string | null): string {
  return firstName
    ? `${firstName}, write a few more notes this week and Today's Lamp will appear here.`
    : `Write a few more notes this week and Today's Lamp will appear here.`;
}

export function generationFailedToast(firstName: string | null): string {
  return firstName
    ? `${firstName}, we couldn't generate Today's Lamp — try again?`
    : `We couldn't generate Today's Lamp — try again?`;
}
