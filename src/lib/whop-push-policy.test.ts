import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isPermanentWhopPushError,
  WHOP_HEADLINE_MAX,
  WHOP_PERMANENT_RETRY_MS,
  whopHeadline,
  whopPushDue,
} from "@/lib/whop-push-policy";

const codePoints = (s: string) => Array.from(s).length;

test("a long description becomes a headline Whop accepts (≤80, word boundary, ellipsis)", () => {
  // Shape of the four stuck @pbssports packages: 474–717 characters.
  const description =
    "PBS Sports VIP gives you every play we bet across the NFL, NBA, college football and college basketball, with units, reasoning and live updates.\n\nMore detail below...".repeat(
      3,
    );
  const headline = whopHeadline(description)!;
  assert.ok(codePoints(headline) <= WHOP_HEADLINE_MAX, headline);
  assert.ok(headline.endsWith("…"));
  assert.ok(headline.startsWith("PBS Sports VIP gives you every play"));
  // Cut at a word boundary: the last word before the ellipsis is whole.
  const body = headline.slice(0, -1);
  assert.ok(description.startsWith(body));
  assert.equal(description[body.length], " ");
});

test("the headline is the first non-empty line, whitespace collapsed", () => {
  assert.equal(
    whopHeadline("\n\n  Daily  NBA   plays  \nUnits, reasoning and results."),
    "Daily NBA plays",
  );
  assert.equal(whopHeadline("Short and sweet"), "Short and sweet");
  assert.equal(whopHeadline(""), null);
  assert.equal(whopHeadline("   \n  "), null);
  assert.equal(whopHeadline(null), null);
});

test("exactly 80 characters is kept whole; 81 is clipped", () => {
  const eighty = "a".repeat(WHOP_HEADLINE_MAX);
  assert.equal(whopHeadline(eighty), eighty);
  const clipped = whopHeadline("a".repeat(WHOP_HEADLINE_MAX + 1))!;
  assert.equal(codePoints(clipped), WHOP_HEADLINE_MAX);
});

test("an emoji is never split in half", () => {
  const description = `${"🔥".repeat(90)} VIP`;
  const headline = whopHeadline(description)!;
  assert.ok(codePoints(headline) <= WHOP_HEADLINE_MAX);
  // Every code point is a whole fire emoji or the ellipsis — no lone surrogate.
  for (const ch of Array.from(headline)) assert.ok(ch === "🔥" || ch === "…");
});

test("only rejections Whop will never accept are permanent", () => {
  const rejected = (status: number) =>
    `Whop rejected the update (HTTP ${status}): {"error":{"message":"..."}}`;
  assert.equal(isPermanentWhopPushError(rejected(400)), true);
  assert.equal(isPermanentWhopPushError(rejected(404)), true);
  assert.equal(isPermanentWhopPushError(rejected(422)), true);
  assert.equal(isPermanentWhopPushError(rejected(408)), false);
  assert.equal(isPermanentWhopPushError(rejected(429)), false);
  assert.equal(isPermanentWhopPushError(rejected(500)), false);
  assert.equal(isPermanentWhopPushError(rejected(503)), false);
  assert.equal(isPermanentWhopPushError("Could not reach Whop."), false);
  assert.equal(
    isPermanentWhopPushError(
      "Whop credentials or company mapping are unavailable.",
    ),
    true,
  );
  assert.equal(isPermanentWhopPushError(null), false);
});

test("a permanent failure retries daily; everything else every pass", () => {
  const now = new Date("2026-11-13T21:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const headline400 =
    'Whop rejected the update (HTTP 400): {"error":{"message":"Headline is too long (maximum is 80 characters)"}}';
  assert.equal(
    whopPushDue({ whopPushLastError: null, updatedAt: ago(1000) }, now),
    true,
  );
  assert.equal(
    whopPushDue(
      { whopPushLastError: "Could not reach Whop.", updatedAt: ago(1000) },
      now,
    ),
    true,
  );
  assert.equal(
    whopPushDue(
      { whopPushLastError: headline400, updatedAt: ago(5 * 60 * 1000) },
      now,
    ),
    false,
  );
  assert.equal(
    whopPushDue(
      {
        whopPushLastError: headline400,
        updatedAt: ago(WHOP_PERMANENT_RETRY_MS),
      },
      now,
    ),
    true,
  );
});

test("the outbound push sends the clipped headline, never the raw description", () => {
  const source = readFileSync("src/lib/whop-sync.ts", "utf8");
  assert.match(source, /headline: whopHeadline\(pkg\.description\)/);
  assert.doesNotMatch(source, /headline: pkg\.description/);
});
