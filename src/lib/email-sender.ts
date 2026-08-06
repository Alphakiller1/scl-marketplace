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
    domain,
    siteDomain,
    matchesSite: senderMatchesSite(domain, siteDomain),
  };
}
