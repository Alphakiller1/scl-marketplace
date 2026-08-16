import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { circuitBreakThreshold, shouldCircuitBreak } from "@/lib/odds-budget";

/**
 * The coverage warm loop is the most expensive path in the product — roughly 31
 * credits per event, across the whole slate — and it is the only caller that
 * passes `forceRefresh`. When that flag also skipped the circuit breaker, the
 * one safeguard holding a reserve back was disabled on precisely the path that
 * can spend an entire plan in a single run. Five provider keys drained to
 * exactly zero in four days, each stopping only because there was nothing left.
 *
 * Source-level assertions, because the behaviour lives in a `server-only`
 * module that pulls in Vercel's cache client and cannot be imported here.
 */

const CACHE_SRC = readFileSync(
  path.join(process.cwd(), "src/lib/odds-event-board-cache.ts"),
  "utf8",
);

test("a forced refresh still respects the credit reserve", () => {
  // The freshness window may be bypassed...
  assert.match(
    CACHE_SRC,
    /!options\.forceRefresh &&\s*\n\s*cached &&/,
    "forceRefresh should still skip the freshness cache",
  );

  // ...but the breaker check must not be gated on it.
  const breakerCall = CACHE_SRC.slice(
    CACHE_SRC.indexOf("shouldCircuitBreak") - 400,
    CACHE_SRC.indexOf("shouldCircuitBreak"),
  );
  assert.ok(
    !/!options\.forceRefresh\s*&&\s*$/.test(breakerCall.trimEnd()),
    "the circuit breaker must apply to forced refreshes too — that bypass is what drained every key to zero",
  );
});

test("the warm loop stops on the breaker rather than mistaking it for empty fixtures", () => {
  const warmSrc = readFileSync(
    path.join(process.cwd(), "src/lib/odds-coverage-report.ts"),
    "utf8",
  );
  assert.match(warmSrc, /circuit_break_empty/);
  assert.match(warmSrc, /stale_circuit_break/);
  assert.match(warmSrc, /credit_reserve/);
});

test("a small plan reserves credits instead of spending to zero", () => {
  // The free tier is the case that kept biting: a flat 1,000-credit reserve
  // would ban a 500 key outright, so the reserve scales — but it must still be
  // non-zero, or "stop at the reserve" means "stop at empty".
  const reserve = circuitBreakThreshold(500);
  assert.ok(reserve > 0, "a 500-credit plan must still hold something back");
  assert.equal(shouldCircuitBreak(reserve - 1, 500), true);
  assert.equal(shouldCircuitBreak(reserve + 50, 500), false);

  // And the big plan keeps its historical 1,000.
  assert.equal(circuitBreakThreshold(20_000), 1_000);
});
