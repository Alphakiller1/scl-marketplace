import { DEFAULT_EMAIL_FROM, senderDomain } from "@/lib/email-sender";

/**
 * Can SCL actually deliver mail right now?
 *
 * `/api/health` used to answer this from `EMAIL_FROM` alone and report
 * `configured: true` — which stayed true with no API key, a revoked key, or a
 * sender domain that was never verified with the provider. Every one of those
 * fails silently: `sendVerificationEmail` swallows the error by design (a dead
 * mailer must not break signup), so a total mail outage looked identical to a
 * healthy system from every dashboard we had. The only symptom was a capper
 * eventually saying "I never got the email".
 *
 * So ask the provider instead of the environment.
 */

const PROBE_TIMEOUT_MS = 3_000;
// Health is polled; the answer changes only when someone edits DNS or rotates a
// key. Long enough to keep repeated polls off Resend, short enough that a fix
// shows up while you are still looking at the page.
const PROBE_CACHE_MS = 60_000;

export type MailerProbe = {
  configured: boolean;
  /** null when the provider could not be reached — unknown, not broken. */
  deliverable: boolean | null;
  senderDomain: string | null;
  /** Provider-reported status for the sender domain, when we got that far. */
  domainStatus: string | null;
  reason: string | null;
};

type ResendDomain = { name?: unknown; status?: unknown };

let cached: { at: number; probe: MailerProbe } | null = null;

/** `mail.scl.com` is covered by a verified `scl.com`. */
function domainCovers(registered: string, sender: string): boolean {
  return sender === registered || sender.endsWith(`.${registered}`);
}

async function runProbe(): Promise<MailerProbe> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const sender =
    from && from !== DEFAULT_EMAIL_FROM ? senderDomain(from) : null;

  if (!apiKey || !sender) {
    return {
      configured: false,
      deliverable: false,
      senderDomain: sender,
      domainStatus: null,
      reason: !apiKey
        ? "RESEND_API_KEY is not set"
        : "EMAIL_FROM is unset or still the placeholder",
    };
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    // Reachability is not the same as misconfiguration — say so rather than
    // reporting a false outage.
    return {
      configured: true,
      deliverable: null,
      senderDomain: sender,
      domainStatus: null,
      reason: "could not reach the Resend API",
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      configured: true,
      deliverable: false,
      senderDomain: sender,
      domainStatus: null,
      reason: `RESEND_API_KEY rejected (${response.status}) — rotate or re-set it`,
    };
  }
  if (!response.ok) {
    return {
      configured: true,
      deliverable: null,
      senderDomain: sender,
      domainStatus: null,
      reason: `Resend API returned ${response.status}`,
    };
  }

  let domains: ResendDomain[] = [];
  try {
    const body: unknown = await response.json();
    const data = (body as { data?: unknown })?.data;
    if (Array.isArray(data)) domains = data as ResendDomain[];
  } catch {
    return {
      configured: true,
      deliverable: null,
      senderDomain: sender,
      domainStatus: null,
      reason: "could not parse the Resend domain list",
    };
  }

  const match = domains.find(
    (entry) =>
      typeof entry.name === "string" &&
      domainCovers(entry.name.toLowerCase(), sender),
  );
  if (!match) {
    return {
      configured: true,
      deliverable: false,
      senderDomain: sender,
      domainStatus: null,
      reason: `${sender} is not registered on this Resend account — mail from it is rejected`,
    };
  }

  const status = typeof match.status === "string" ? match.status : null;
  return {
    configured: true,
    deliverable: status === "verified",
    senderDomain: sender,
    domainStatus: status,
    reason:
      status === "verified"
        ? null
        : `${sender} is registered but not verified (status: ${status ?? "unknown"})`,
  };
}

export async function probeMailer(): Promise<MailerProbe> {
  if (cached && Date.now() - cached.at < PROBE_CACHE_MS) return cached.probe;
  const probe = await runProbe();
  cached = { at: Date.now(), probe };
  return probe;
}

/** Tests only — the cache is process-wide. */
export function resetMailerProbeCache() {
  cached = null;
}
