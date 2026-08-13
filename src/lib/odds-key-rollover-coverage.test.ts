import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/**
 * Every call to The Odds API must go through `fetchWithOddsKeyRollover`.
 *
 * This is a source scan rather than a unit test because the failure it guards
 * is invisible at runtime. Key rollover was added, but only wired into the
 * per-event path; the BULK BOARD kept calling `fetch()` with `oddsApiKey()`,
 * which is the primary key alone. When the primary ran out of credits the
 * per-event and CLV paths rolled over to a live key and kept working, while
 * every board fetch got a 401 and returned an empty slate — and an empty slate
 * is exactly what "no games today" looks like. MLB, WNBA and NFL served
 * nothing for a full day while the health check reported the provider
 * `reachable: true`, because the catalog endpoint it probes is free.
 *
 * So a new `fetch("https://api.the-odds-api.com/...")` anywhere in `src/lib`
 * fails here with the file and line, rather than silently emptying a board the
 * next time a key expires.
 */
const ODDS_HOST = "api.the-odds-api.com";
const LIB = join(process.cwd(), "src", "lib");

/**
 * The rollover module itself is the one place that may call `fetch` directly —
 * it is what every other caller is required to go through.
 */
const ALLOWED = new Set(["odds-key-rollover.ts"]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (entry.name.endsWith(".ts") && !entry.name.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

test("no Odds API call bypasses key rollover", () => {
  const violations: string[] = [];

  for (const file of sourceFiles(LIB)) {
    const name = file.slice(LIB.length + 1).replace(/\\/g, "/");
    if (ALLOWED.has(name)) continue;

    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    // A file that never names the host cannot call it.
    if (!lines.some((line) => line.includes(ODDS_HOST))) continue;

    // The URL and the fetch that sends it are usually a few lines apart, so
    // the check is per-file: a file that mentions the host must also route
    // through the rollover helper.
    const usesRollover = lines.some((line) =>
      line.includes("fetchWithOddsKeyRollover"),
    );
    if (usesRollover) continue;

    const line = lines.findIndex((l) => l.includes(ODDS_HOST)) + 1;
    violations.push(
      `${name}:${line} builds an Odds API URL without fetchWithOddsKeyRollover`,
    );
  }

  assert.deepEqual(
    violations,
    [],
    `Odds API calls must use fetchWithOddsKeyRollover so an exhausted key ` +
      `rolls over instead of silently emptying the board:\n  ${violations.join("\n  ")}`,
  );
});

test("the guard would actually catch a bypass", () => {
  // Proves the scan is not vacuous: the same predicate over a synthetic file
  // that calls the host with a bare fetch must be rejected.
  const offending = [
    "const url = `https://api.the-odds-api.com/v4/sports/${s}/odds/?apiKey=${k}`;",
    "const res = await fetch(url);",
  ];
  const mentionsHost = offending.some((l) => l.includes(ODDS_HOST));
  const usesRollover = offending.some((l) =>
    l.includes("fetchWithOddsKeyRollover"),
  );
  assert.equal(mentionsHost && !usesRollover, true);
});
