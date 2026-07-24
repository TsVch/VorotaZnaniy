/**
 * Shared OAuth profile interface used by Google and GitHub strategies.
 *
 * Extracted to a standalone file to avoid cross-dependency between
 * google.strategy.ts and github.strategy.ts.
 */
export interface OAuthProfile {
  email: string;
  provider: 'google' | 'github';
  providerId: string;
  name?: string;
  avatarUrl?: string;
}
