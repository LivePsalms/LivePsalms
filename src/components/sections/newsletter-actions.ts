const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(input: string): boolean {
  return EMAIL_RE.test(input.trim());
}

export type NewsletterInsertResult = {
  error: { code?: string; message?: string } | null;
};

export interface NewsletterClient {
  from(table: string): {
    insert(row: Record<string, unknown>): Promise<NewsletterInsertResult>;
  };
}

export type SubscribeResult =
  | { kind: 'success'; alreadySubscribed: boolean }
  | { kind: 'invalid-email' }
  | { kind: 'no-client' }
  | { kind: 'network-error' };

export interface SubscribeInput {
  email: string;
  source?: string;
  client: NewsletterClient | null;
}

export async function subscribe(input: SubscribeInput): Promise<SubscribeResult> {
  const email = input.email.trim();
  const { error } = await input.client!
    .from('newsletter_subscribers')
    .insert({ email, source: input.source ?? null });
  if (error) {
    return { kind: 'network-error' };
  }
  return { kind: 'success', alreadySubscribed: false };
}
