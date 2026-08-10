import {
  parseSenderAddress,
  registrableHost,
  senderDomain,
  senderMatchesSite,
} from "@/lib/email-sender";
import { supabaseRefFromKey, supabaseRefFromUrl } from "@/lib/supabase-config";

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

function isEmailAddress(value: string | undefined) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value?.trim() ?? "");
}

function usesSclSchema(value: string | undefined) {
  return Boolean(value && /[?&]schema=scl(?:&|$)/i.test(value));
}

/**
 * The domain the site has claimed as its own, or null if it has not claimed one.
 *
 * Only an explicit `NEXT_PUBLIC_SITE_URL` counts. A `*.vercel.app` deploy host
 * can never be verified with a mail provider, so measuring the sender against it
 * would warn forever on a project that has not cut over to its domain yet — and a
 * check that is permanently yellow is a check nobody reads.
 */
function canonicalSiteHost(env: ReleaseEnvironment): string | null {
  const raw = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  const host = registrableHost(
    /^https?:\/\//i.test(raw) ? raw : `https://${raw}`,
  );
  return host && !host.endsWith(".vercel.app") ? host : null;
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
  // Parse before validating: `SCL <no-reply@example.com>` is a valid sender that
  // fails a bare address test, so testing the raw value reported the recommended
  // display-name form as unconfigured.
  const senderAddress = parseSenderAddress(env.EMAIL_FROM?.trim() ?? "");
  const emailConfigured =
    isConfigured(env.RESEND_API_KEY) &&
    isEmailAddress(senderAddress ?? undefined) &&
    !/@scl\.local$/i.test(senderAddress ?? "");
  // A correct-looking address on somebody else's domain still delivers, so this
  // is a warning, not a block — but a capper reading the from line is the person
  // who otherwise finds it, and by then it reads as a phish.
  const senderHost = senderDomain(env.EMAIL_FROM?.trim() ?? "");
  const siteHost = canonicalSiteHost(env);
  const senderIsForeign =
    emailConfigured &&
    Boolean(siteHost) &&
    !senderMatchesSite(senderHost, siteHost);
  const supportConfigured = isEmailAddress(env.SUPPORT_EMAIL_TO);
  const mediaConfigured =
    (isConfigured(env.SUPABASE_URL) ||
      isConfigured(env.NEXT_PUBLIC_SUPABASE_URL)) &&
    (isConfigured(env.SUPABASE_SERVICE_ROLE_KEY) ||
      isConfigured(env.SUPABASE_SECRET_KEY));
  // A URL from one project and a key from another read as "rejected key" or
  // "missing bucket" at the call site, so name the real fault here.
  const mediaUrlRef = supabaseRefFromUrl(
    env.SUPABASE_URL?.trim() || env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "",
  );
  const mediaKeyRef = supabaseRefFromKey(
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      env.SUPABASE_SECRET_KEY?.trim() ||
      "",
  );
  const mediaMismatch = Boolean(
    mediaUrlRef && mediaKeyRef && mediaUrlRef !== mediaKeyRef,
  );
  const releaseIdentityConfigured =
    env.VERCEL_ENV?.trim() !== "production" ||
    isConfigured(env.VERCEL_GIT_COMMIT_SHA);
  const oddsConfigured = isConfigured(
    env.ODDS_API_KEY?.trim() || env.ODD_API_KEY?.trim(),
  );

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
      label: "Transactional email",
      status: !emailConfigured
        ? "blocked"
        : senderIsForeign
          ? "warning"
          : "ready",
      detail: !emailConfigured
        ? "RESEND_API_KEY and a verified, non-.local EMAIL_FROM are required for signup, password reset, and support delivery."
        : senderIsForeign
          ? `Mail is sent from ${senderHost}, not ${siteHost}. Verify ${siteHost} with the mail provider and move EMAIL_FROM onto it — cappers read the from line, and a link from an unrelated company reads as a phish.`
          : "Resend delivery uses an explicit, non-.local sender address on the site's own domain.",
    },
    {
      id: "support-mailbox",
      label: "Support mailbox",
      status: supportConfigured ? "ready" : "blocked",
      detail: supportConfigured
        ? `Support requests route to ${env.SUPPORT_EMAIL_TO!.trim()}.`
        : "Set SUPPORT_EMAIL_TO to the monitored mailbox that receives support requests.",
    },
    {
      id: "profile-media",
      label: "Profile media uploads",
      status: mediaMismatch ? "blocked" : mediaConfigured ? "ready" : "warning",
      detail: mediaMismatch
        ? `Supabase URL and service-role key name different projects (${mediaUrlRef} vs ${mediaKeyRef}); uploads fail until both come from the same project.`
        : mediaConfigured
          ? "Supabase Storage is configured for avatar and cover uploads."
          : "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) are missing; profile media uploads will be unavailable.",
    },
    {
      id: "odds-provider",
      label: "Odds verification provider",
      status: oddsConfigured ? "ready" : "blocked",
      detail: oddsConfigured
        ? "The Odds API credential is configured."
        : "ODDS_API_KEY (or the deployed ODD_API_KEY alias) is required for Odds Verification and the pick-entry board.",
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
      id: "release-identity",
      label: "Deployment identity",
      status: releaseIdentityConfigured ? "ready" : "blocked",
      detail: releaseIdentityConfigured
        ? env.VERCEL_ENV?.trim() === "production"
          ? "Vercel exposes the deployed Git commit to the production health gate."
          : "The commit-identity gate is enforced on production deployments."
        : "Enable Automatically expose System Environment Variables in Vercel so production exposes VERCEL_GIT_COMMIT_SHA.",
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
