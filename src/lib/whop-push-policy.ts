/**
 * What SCL sends to Whop on a storefront push, and when a failed push is
 * retried. Pure, so both rules are unit-tested.
 *
 * Found 2026-11-13: four @pbssports packages edited on 2026-10-26 never reached
 * Whop. The push sent the whole package description as Whop's `headline`, Whop
 * caps a headline at 80 characters and rejects the entire update with HTTP 400,
 * and the 5-minute cron retried the same payload 5,254 times — never able to
 * succeed, logging an error and flagging the store connection on every pass.
 */

/** Whop rejects a product headline longer than this (HTTP 400). */
export const WHOP_HEADLINE_MAX = 80;

/**
 * A headline Whop will accept: the description's first non-empty line, with
 * whitespace collapsed, clipped at a word boundary to fit with an ellipsis.
 * The full text still goes to Whop's `description`; the headline is only the
 * prominent one-line summary on the product page.
 *
 * Counted in code points (`Array.from`), so an emoji is never split in half.
 */
export function whopHeadline(
  description: string | null | undefined,
): string | null {
  const firstLine = (description ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .find(Boolean);
  if (!firstLine) return null;
  const chars = Array.from(firstLine);
  if (chars.length <= WHOP_HEADLINE_MAX) return firstLine;

  const room = chars.slice(0, WHOP_HEADLINE_MAX - 1).join("");
  const space = room.lastIndexOf(" ");
  // Prefer a word boundary unless that would throw away most of the line.
  const cut = space >= room.length / 2 ? room.slice(0, space) : room;
  return `${cut.replace(/[\s,;:.!?\-–—]+$/u, "")}…`;
}

/** How often a push Whop will not accept as-is is tried again. */
export const WHOP_PERMANENT_RETRY_MS = 24 * 60 * 60 * 1000;

const REJECTED = /^Whop rejected the update \(HTTP (\d{3})\)/;

/**
 * A failure that the same request cannot fix by being sent again: Whop
 * rejected the payload or the product (a 4xx other than a timeout or rate
 * limit), or the connection has no usable credentials. Network failures, 5xx,
 * 408 and 429 are transient.
 */
export function isPermanentWhopPushError(
  error: string | null | undefined,
): boolean {
  if (!error) return false;
  const rejected = REJECTED.exec(error);
  if (rejected) {
    const status = Number(rejected[1]);
    return status >= 400 && status < 500 && status !== 408 && status !== 429;
  }
  return (
    error.startsWith("Whop credentials or company mapping are unavailable") ||
    error.startsWith("Whop is not connected")
  );
}

/**
 * Whether a pending push should be attempted on this cron pass.
 *
 * New and transiently failed pushes run every pass. A permanent failure is
 * retried once a day — `updatedAt` moves on every failed attempt, so it is the
 * time of the last try — which keeps a stuck package visible and self-healing
 * (a fix ships, or Whop's rules change) without hammering Whop and the
 * database every five minutes. A new SCL edit resets the error and runs at once.
 */
export function whopPushDue(
  pending: { whopPushLastError: string | null; updatedAt: Date },
  now: Date,
): boolean {
  if (!isPermanentWhopPushError(pending.whopPushLastError)) return true;
  return now.getTime() - pending.updatedAt.getTime() >= WHOP_PERMANENT_RETRY_MS;
}
