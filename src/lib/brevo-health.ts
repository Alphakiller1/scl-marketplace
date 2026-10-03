/**
 * Non-sending Brevo acceptance probe.
 *
 * Environment presence only proves that somebody pasted a value. The account
 * endpoint proves that Brevo still accepts the key without contacting a capper.
 */

import { brevoApiKeys } from "@/lib/brevo-config";

const PROBE_TIMEOUT_MS = 3_000;
const PROBE_CACHE_MS = 60_000;

export type BrevoProbe = {
  configured: boolean;
  /** null means the provider could not be reached, not that the key is bad. */
  authenticated: boolean | null;
  webhookConfigured: boolean;
  senderConfigured: boolean;
  dailyLimit: number;
  providerCredits: number | null;
  reason: string | null;
};

let cached: { at: number; probe: BrevoProbe } | null = null;

function configuredDailyLimit(): number {
  const value = Number(process.env.BREVO_DAILY_LIMIT ?? "300");
  return Number.isInteger(value) && value > 0 ? Math.min(value, 100_000) : 300;
}

function sendLimitCredits(payload: unknown): number | null {
  const plans = (payload as { plan?: unknown } | null)?.plan;
  if (!Array.isArray(plans)) return null;
  for (const plan of plans) {
    if (!plan || typeof plan !== "object") continue;
    const row = plan as { credits?: unknown; creditsType?: unknown };
    if (row.creditsType !== "sendLimit") continue;
    const credits = Number(row.credits);
    if (Number.isFinite(credits) && credits >= 0) return credits;
  }
  return null;
}

async function runProbe(): Promise<BrevoProbe> {
  const apiKeys = brevoApiKeys();
  const senderConfigured = Boolean(
    process.env.BREVO_EMAIL_FROM?.trim() || process.env.EMAIL_FROM?.trim(),
  );
  const webhookConfigured = Boolean(process.env.BREVO_WEBHOOK_SECRET?.trim());
  const dailyLimit = configuredDailyLimit();
  const configured = Boolean(
    apiKeys.length > 0 && senderConfigured && webhookConfigured,
  );
  const base = {
    configured,
    webhookConfigured,
    senderConfigured,
    dailyLimit,
    providerCredits: null,
  };

  if (apiKeys.length === 0 || !senderConfigured || !webhookConfigured) {
    return {
      ...base,
      authenticated: false,
      reason:
        apiKeys.length === 0
          ? "BREVO_EMAIL_SEND or BREVO_API_KEY is not set"
          : !senderConfigured
            ? "BREVO_EMAIL_FROM or EMAIL_FROM is not set"
            : "BREVO_WEBHOOK_SECRET is not set",
    };
  }

  let rejectedStatus: number | null = null;
  for (const apiKey of apiKeys) {
    let response: Response;
    try {
      response = await fetch("https://api.brevo.com/v3/account", {
        headers: { accept: "application/json", "api-key": apiKey },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      return {
        ...base,
        authenticated: null,
        reason: "could not reach the Brevo API",
      };
    }

    if (response.status === 401 || response.status === 403) {
      rejectedStatus = response.status;
      continue;
    }
    if (!response.ok) {
      return {
        ...base,
        authenticated: null,
        reason: `Brevo API returned ${response.status}`,
      };
    }

    const payload = await response.json().catch(() => null);
    return {
      ...base,
      authenticated: true,
      providerCredits: sendLimitCredits(payload),
      reason: null,
    };
  }

  return {
    ...base,
    authenticated: false,
    reason: `Brevo API credentials rejected (${rejectedStatus ?? "unknown"}) — rotate or re-set them`,
  };
}

export async function probeBrevo(): Promise<BrevoProbe> {
  if (cached && Date.now() - cached.at < PROBE_CACHE_MS) return cached.probe;
  const probe = await runProbe();
  cached = { at: Date.now(), probe };
  return probe;
}

/** Tests only — the cache is process-wide. */
export function resetBrevoProbeCache() {
  cached = null;
}
