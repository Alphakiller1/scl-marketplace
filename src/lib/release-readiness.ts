export type ReleaseCheckStatus = "ready" | "warning" | "blocked";

export type ReleaseReadinessCheck = {
  id: string;
  label: string;
  status: ReleaseCheckStatus;
  detail: string;
};

type ReleaseEnvironment = Record<string, string | undefined>;

function isConfigured(value: string | undefined) {
  return Boolean(value?.trim());
}

function usesSclSchema(value: string | undefined) {
  return Boolean(value && /[?&]schema=scl(?:&|$)/i.test(value));
}

export function evaluateReleaseConfiguration(
  env: ReleaseEnvironment,
): ReleaseReadinessCheck[] {
  const databaseConfigured =
    isConfigured(env.DATABASE_URL) && isConfigured(env.DIRECT_URL);
  const databaseUsesScl =
    usesSclSchema(env.DATABASE_URL) && usesSclSchema(env.DIRECT_URL);
  const authConfigured =
    (env.AUTH_SECRET?.trim().length ?? 0) >= 32 &&
    env.AUTH_TRUST_HOST?.trim().toLowerCase() === "true" &&
    /^https:\/\//i.test(env.AUTH_URL?.trim() ?? "");
  const emailConfigured =
    isConfigured(env.RESEND_API_KEY) &&
    isConfigured(env.EMAIL_FROM) &&
    !/@scl\.local$/i.test(env.EMAIL_FROM?.trim() ?? "");
  const mediaConfigured =
    isConfigured(env.SUPABASE_URL) &&
    isConfigured(env.SUPABASE_SERVICE_ROLE_KEY);

  return [
    {
      id: "database-config",
      label: "Production database",
      status: databaseConfigured && databaseUsesScl ? "ready" : "blocked",
      detail: !databaseConfigured
        ? "DATABASE_URL and DIRECT_URL must both be configured."
        : databaseUsesScl
          ? "Runtime and migration connections target the isolated scl schema."
          : "Both database URLs must explicitly target schema=scl.",
    },
    {
      id: "authentication-config",
      label: "Authentication",
      status: authConfigured ? "ready" : "blocked",
      detail: authConfigured
        ? "Production origin, trusted host, and a strong Auth.js secret are configured."
        : "Set an HTTPS AUTH_URL, AUTH_TRUST_HOST=true, and an AUTH_SECRET of at least 32 characters.",
    },
    {
      id: "transactional-email",
      label: "Account and support email",
      status: emailConfigured ? "ready" : "blocked",
      detail: emailConfigured
        ? `Resend delivery is configured${isConfigured(env.SUPPORT_EMAIL_TO) ? " with an explicit support inbox" : " with the support@scl.com fallback inbox"}.`
        : "RESEND_API_KEY and a verified, non-.local EMAIL_FROM are required for signup, password reset, and support delivery.",
    },
    {
      id: "profile-media",
      label: "Profile media uploads",
      status: mediaConfigured ? "ready" : "warning",
      detail: mediaConfigured
        ? "Supabase Storage is configured for avatar and cover uploads."
        : "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing; profile media uploads will be unavailable.",
    },
    {
      id: "odds-provider",
      label: "Odds verification provider",
      status: isConfigured(env.ODDS_API_KEY) ? "ready" : "blocked",
      detail: isConfigured(env.ODDS_API_KEY)
        ? "The Odds API credential is configured."
        : "ODDS_API_KEY is required for Odds Verification and the pick-entry board.",
    },
    {
      id: "grading-cron",
      label: "Automatic grading",
      status: isConfigured(env.CRON_SECRET) ? "ready" : "blocked",
      detail: isConfigured(env.CRON_SECRET)
        ? "The grading endpoint secret is configured."
        : "CRON_SECRET is required for the scheduled grading workflow.",
    },
    {
      id: "ghost-publication",
      label: "Synthetic capper publication",
      status:
        env.SCL_ALLOW_GHOST_PUBLICATION?.trim() === "1" ? "blocked" : "ready",
      detail:
        env.SCL_ALLOW_GHOST_PUBLICATION?.trim() === "1"
          ? "SCL_ALLOW_GHOST_PUBLICATION=1 exposes fabricated demo records; disable it before launch."
          : "Ghost/demo accounts are excluded from public marketplace surfaces.",
    },
    {
      id: "whop-webhook",
      label: "Whop event ingestion",
      status: isConfigured(env.WHOP_WEBHOOK_SECRET) ? "ready" : "warning",
      detail: isConfigured(env.WHOP_WEBHOOK_SECRET)
        ? "Signed Whop webhook delivery is enabled."
        : "Webhook ingestion is not configured; continue using the documented manual affiliate workflow.",
    },
  ];
}

export function releaseReadinessSummary(checks: ReleaseReadinessCheck[]) {
  return checks.reduce(
    (summary, check) => {
      summary[check.status] += 1;
      return summary;
    },
    { ready: 0, warning: 0, blocked: 0 },
  );
}
