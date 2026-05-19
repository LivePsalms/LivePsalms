const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(input: string): boolean {
  return EMAIL_RE.test(input.trim());
}
