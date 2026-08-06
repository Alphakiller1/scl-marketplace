import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Whop webhook signature verification.
 *
 * Whop v1 follows the Standard Webhooks spec:
 * - Headers: webhook-id, webhook-timestamp, webhook-signature (v1,<base64>)
 * - Signed content: `{webhook-id}.{webhook-timestamp}.{rawBody}`
 * - HMAC-SHA256 key: UTF-8 bytes of the ws_… signing secret
 *
 * Older deliveries may still use x-whop-signature / x-whop-timestamp with a
 * `{timestamp}.{body}` hex digest — we accept both shapes.
 *
 * Callers must pass `await req.text()` — re-serialising JSON breaks verification.
 */

/** Deliveries older than this are rejected, so a captured request can't be replayed. */
const MAX_SKEW_SECONDS = 5 * 60;

export type WhopVerifyResult =
  | { ok: true }
  | { ok: false; reason: string; status: number };

function headerValue(headers: Headers, ...names: string[]): string | null {
  for (const name of names) {
    const v = headers.get(name);
    if (v) return v;
  }
  return null;
}

function withinSkew(timestamp: string, now: Date): boolean {
  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return false;
  const sentMs = sent > 1e12 ? sent : sent * 1000;
  return Math.abs(now.getTime() - sentMs) <= MAX_SKEW_SECONDS * 1000;
}

function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Legacy Whop header shape — hex digest over `{timestamp}.{body}`.
 */
function parseHexSignatures(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .map((part) =>
      part.includes("=") ? part.split("=").slice(1).join("=") : part,
    )
    .filter(Boolean);
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function verifyLegacyWhopSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
  now: Date,
): WhopVerifyResult {
  const signatureHeader = headerValue(
    headers,
    "x-whop-signature",
    "whop-signature",
  );
  if (!signatureHeader) {
    return { ok: false, reason: "missing signature header", status: 401 };
  }

  const timestamp = headerValue(headers, "x-whop-timestamp", "whop-timestamp");
  if (!timestamp) {
    return { ok: false, reason: "missing timestamp header", status: 401 };
  }
  if (!withinSkew(timestamp, now)) {
    return {
      ok: false,
      reason: "timestamp outside accepted window",
      status: 401,
    };
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const matched = parseHexSignatures(signatureHeader).some((candidate) =>
    safeEqualHex(expected, candidate),
  );
  if (!matched) {
    return { ok: false, reason: "signature mismatch", status: 401 };
  }

  return { ok: true };
}

/**
 * Standard Webhooks v1 — what Whop dashboard v1 deliveries use.
 */
function verifyStandardWebhookSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
  now: Date,
): WhopVerifyResult {
  const msgId = headerValue(headers, "webhook-id");
  const timestamp = headerValue(headers, "webhook-timestamp");
  const signatureHeader = headerValue(headers, "webhook-signature");

  if (!msgId || !timestamp || !signatureHeader) {
    return {
      ok: false,
      reason: "missing standard webhook headers",
      status: 401,
    };
  }
  if (!withinSkew(timestamp, now)) {
    return {
      ok: false,
      reason: "timestamp outside accepted window",
      status: 401,
    };
  }

  const signedContent = `${msgId}.${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret)
    .update(signedContent, "utf8")
    .digest("base64");
  const expectedToken = `v1,${expected}`;

  const matched = signatureHeader
    .split(/\s+/)
    .filter(Boolean)
    .some((candidate) => safeEqualString(candidate, expectedToken));

  if (!matched) {
    return { ok: false, reason: "signature mismatch", status: 401 };
  }

  return { ok: true };
}

export function verifyWhopSignature(
  rawBody: string,
  headers: Headers,
  secret: string | undefined,
  now: Date = new Date(),
): WhopVerifyResult {
  if (!secret?.trim()) {
    return {
      ok: false,
      reason: "WHOP_WEBHOOK_SECRET is not configured",
      status: 503,
    };
  }

  const trimmed = secret.trim();

  // Prefer Standard Webhooks when those headers are present (Whop v1 default).
  if (headerValue(headers, "webhook-signature")) {
    return verifyStandardWebhookSignature(rawBody, headers, trimmed, now);
  }

  return verifyLegacyWhopSignature(rawBody, headers, trimmed, now);
}
