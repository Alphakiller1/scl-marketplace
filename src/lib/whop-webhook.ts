import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Whop webhook signature verification.
 *
 * Whop signs each delivery with the app's webhook signing secret and sends the
 * signature and timestamp as headers. We recompute the HMAC over
 * `<timestamp>.<raw body>` and compare in constant time.
 *
 * The raw body matters: re-serialising the parsed JSON changes key order and
 * whitespace, which changes the digest. Callers must pass `await req.text()`.
 *
 * Deliberately a pure function with no `server-only` guard and no ambient env
 * read: the caller supplies the secret. That keeps this unit-testable, which
 * matters more here than elsewhere — an untested signature check that silently
 * accepts everything is indistinguishable from a working one.
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

/**
 * Signature headers carry either a bare hex digest or a comma-separated
 * `v1=<hex>` list. Return every candidate digest so either shape verifies.
 */
function parseSignatures(raw: string): string[] {
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
  // timingSafeEqual throws on length mismatch, which would itself leak a bit.
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyWhopSignature(
  rawBody: string,
  headers: Headers,
  secret: string | undefined,
  now: Date = new Date(),
): WhopVerifyResult {
  if (!secret?.trim()) {
    // Fail closed. An unset secret must never mean "accept everything".
    return {
      ok: false,
      reason: "WHOP_WEBHOOK_SECRET is not configured",
      status: 503,
    };
  }

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

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) {
    return { ok: false, reason: "malformed timestamp", status: 401 };
  }
  // Accept seconds or milliseconds — providers differ, and guessing wrong would
  // reject every delivery.
  const sentMs = sent > 1e12 ? sent : sent * 1000;
  if (Math.abs(now.getTime() - sentMs) > MAX_SKEW_SECONDS * 1000) {
    return {
      ok: false,
      reason: "timestamp outside accepted window",
      status: 401,
    };
  }

  const expected = createHmac("sha256", secret.trim())
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const candidates = parseSignatures(signatureHeader);
  const matched = candidates.some((candidate) =>
    safeEqualHex(expected, candidate),
  );
  if (!matched) {
    return { ok: false, reason: "signature mismatch", status: 401 };
  }

  return { ok: true };
}
