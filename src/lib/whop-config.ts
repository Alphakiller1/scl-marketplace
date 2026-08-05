/**
 * Resolve Whop credentials from env. Owner guide and `.env.example` use slightly
 * different names — accept both so production can be configured either way.
 */

export function whopAccountApiKey(): string | null {
  return process.env.WHOP_API_KEY?.trim() || null;
}

export function whopAppId(): string | null {
  return (
    process.env.NEXT_PUBLIC_WHOP_APP_ID?.trim() ||
    process.env.WHOP_APP_ID?.trim() ||
    null
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
  return process.env.WHOP_AFFILIATE_USERNAME?.trim() || null;
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
};

export function whopIntegrationStatus(): WhopIntegrationStatus {
  return {
    oauth: whopOAuthConfigured(),
    webhook: whopWebhookConfigured(),
    affiliateUsername: Boolean(whopAffiliateUsername()),
    accountApiKey: Boolean(whopAccountApiKey()),
  };
}
