/**
 * Resolve Whop credentials from env. Owner guide and `.env.example` use slightly
 * different names — accept both so production can be configured either way.
 *
 * SCL's public Whop app id and affiliate username are safe to default when env
 * is unset — they appear in OAuth redirects and checkout URLs anyway.
 */

/** SCL Whop app (`Sports Cappers Leaderboard`) — public OAuth client id. */
export const SCL_WHOP_APP_ID = "app_I5rsiJlsDgRe5O";

/** SCL affiliate slug on Whop checkout links (`?a=`). */
export const SCL_WHOP_AFFILIATE_USERNAME = "SportsCappersLeaderboard";

export function whopAccountApiKey(): string | null {
  return process.env.WHOP_API_KEY?.trim() || null;
}

export function whopAppId(): string | null {
  return (
    process.env.NEXT_PUBLIC_WHOP_APP_ID?.trim() ||
    process.env.WHOP_APP_ID?.trim() ||
    SCL_WHOP_APP_ID
  );
}

export function whopAppApiKey(): string | null {
  return (
    process.env.WHOP_APP_API_KEY?.trim() ||
    process.env.WHOP_CLIENT_SECRET?.trim() ||
    null
  );
}

export function whopWebhookSecret(): string | null {
  return process.env.WHOP_WEBHOOK_SECRET?.trim() || null;
}

/** SCL's affiliate username on Whop checkout links (`?a=`). */
export function whopAffiliateUsername(): string | null {
  return (
    process.env.WHOP_AFFILIATE_USERNAME?.trim() || SCL_WHOP_AFFILIATE_USERNAME
  );
}

/** Capper app-install OAuth — needs the public app id + server secret. */
export function whopOAuthConfigured(): boolean {
  return Boolean(whopAppId() && whopAppApiKey());
}

export function whopWebhookConfigured(): boolean {
  return Boolean(whopWebhookSecret());
}

export type WhopIntegrationStatus = {
  oauth: boolean;
  webhook: boolean;
  affiliateUsername: boolean;
  accountApiKey: boolean;
  storefrontSync: boolean;
};

export function whopStorefrontSyncConfigured(): boolean {
  return whopOAuthConfigured() && Boolean(whopAffiliateUsername());
}

export function whopIntegrationStatus(): WhopIntegrationStatus {
  return {
    oauth: whopOAuthConfigured(),
    webhook: whopWebhookConfigured(),
    affiliateUsername: Boolean(whopAffiliateUsername()),
    accountApiKey: Boolean(whopAccountApiKey()),
    storefrontSync: whopStorefrontSyncConfigured(),
  };
}
