import { siteUrl } from "@/lib/site-url";

/**
 * Who SCL's mail says it is from.
 *
 * `EMAIL_FROM` is a single opaque env var, so a sender left pointing at an
 * unrelated domain is invisible until a capper reads the "from" line and asks
 * why SCL is emailing them from somebody else's company. It cannot be corrected
 * from code — the domain has to be verified with the mail provider first — so
 * the job here is to make the mismatch legible instead of silent.
 */

export const DEFAULT_EMAIL_FROM = "no-reply@scl.local";

/** `SCL <no-reply@example.com>` and `no-reply@example.com` both yield the address. */
export function parseSenderAddress(value: string): string | null {
  const angled = /<([^>]+)>/.exec(value);
  const address = (angled?.[1] ?? value).trim();
  return address.includes("@") ? address.toLowerCase() : null;
}

/**
 * The half of the sender an inbox actually renders.
 *
 * `Chase Analytics <no-reply@sportscappersleaderboard.com>` is a correct address
 * wearing somebody else's name, and a domain check calls it clean — so checking
 * the domain alone is exactly how a foreign sender survives review. Returns null
 * for a bare address, which is not a fault: no name means the inbox falls back to
 * the address, and the address is already checked.
 */
export function parseSenderName(value: string): string | null {
  const angled = /^\s*(.*?)\s*<[^>]+>\s*$/.exec(value);
  if (!angled) return null;
  // A display name containing a comma or colon has to be quoted per RFC 5322;
  // the quotes are transport syntax, not part of the name.
  const name = angled[1]
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .trim();
  return name || null;
}

export function senderDomain(value: string): string | null {
  const address = parseSenderAddress(value);
  if (!address) return null;
  const domain = address.slice(address.lastIndexOf("@") + 1).trim();
  return domain || null;
}

/** `https://www.sportscappersleaderboard.com` -> `sportscappersleaderboard.com` */
export function registrableHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True when the sender domain belongs to the site it claims to be — the same
 * host, or a subdomain of it (`mail.sportscappersleaderboard.com` is fine).
 */
export function senderMatchesSite(
  sender: string | null,
  siteHost: string | null,
): boolean {
  if (!sender || !siteHost) return false;
  return sender === siteHost || sender.endsWith(`.${siteHost}`);
}

export type EmailSenderStatus = {
  configured: boolean;
  displayName: string | null;
  domain: string | null;
  siteDomain: string | null;
  matchesSite: boolean;
};

export function emailSenderStatus(): EmailSenderStatus {
  const raw = process.env.EMAIL_FROM?.trim();
  const domain = raw ? senderDomain(raw) : null;
  const siteDomain = registrableHost(siteUrl());
  return {
    configured: Boolean(raw) && raw !== DEFAULT_EMAIL_FROM,
    // Reported, not judged. Which names are legitimately SCL's is a branding
    // question with no answer in code, and a check that guessed would either
    // block a rename or wave through the next wrong one. A human reading
    // /api/health can tell in a second; the point is to put it in front of them.
    displayName: raw ? parseSenderName(raw) : null,
    domain,
    siteDomain,
    matchesSite: senderMatchesSite(domain, siteDomain),
  };
}
