import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { reviveCachedDates } from "@/lib/cache-dates";

/**
 * Guards the fix for a live outage on every public capper profile.
 *
 * `unstable_cache` stores its payload as JSON, so a cache HIT returned
 * `lastPlayAt` / `joinedAt` / every play's `createdAt` as ISO strings. The
 * profile header then called `.getFullYear()` on a string and the About block
 * pushed one through `Intl.DateTimeFormat`, so the page crashed for every
 * visitor — while a cache MISS rendered perfectly, which is why checking it
 * once said "fixed".
 */

test("revives dates the JSON cache flattened into strings", () => {
  const payload = {
    capper: {
      handle: "petespicks",
      joinedAt: new Date("2026-02-03T10:00:00Z"),
    },
    plays: [
      {
        id: "p1",
        createdAt: new Date("2026-08-07T22:41:00Z"),
        eventStartsAt: new Date("2026-08-07T23:05:00.123Z"),
        embargoedUntil: null,
      },
    ],
    lastPlayAt: new Date("2026-08-08T01:46:00Z"),
  };

  const revived = reviveCachedDates(
    JSON.parse(JSON.stringify(payload)) as typeof payload,
  );

  assert.ok(revived.capper.joinedAt instanceof Date);
  assert.ok(revived.lastPlayAt instanceof Date);
  assert.ok(revived.plays[0].createdAt instanceof Date);
  assert.ok(revived.plays[0].eventStartsAt instanceof Date);
  assert.equal(revived.plays[0].embargoedUntil, null);
  assert.equal(
    revived.plays[0].createdAt.getTime(),
    payload.plays[0].createdAt.getTime(),
  );
  // Milliseconds survive the round trip — a truncated close would move CLV.
  assert.equal(
    revived.plays[0].eventStartsAt.getTime(),
    payload.plays[0].eventStartsAt.getTime(),
  );
});

test("a real Date passes through untouched (cache MISS path)", () => {
  const at = new Date("2026-08-08T01:46:00Z");
  const revived = reviveCachedDates({ at, nested: { list: [{ at }] } });
  assert.equal(revived.at, at);
  assert.equal(revived.nested.list[0].at, at);
});

test("leaves text that merely mentions a date alone", () => {
  // Only a string that is EXACTLY what Date#toJSON writes may become a Date;
  // turning a bio or a title into an object would crash the render it feeds.
  const revived = reviveCachedDates({
    bio: "Grinding since 2026-08-08T01:46:00Z, every play logged.",
    title: "2026 Season Pass",
    handle: "2026-08-08",
    eventLabel: "Rays @ Yankees",
    date: "2026-08-08",
    time: "01:46:00",
    units: 3.5,
    verified: true,
    missing: null,
  });

  assert.equal(typeof revived.bio, "string");
  assert.equal(typeof revived.title, "string");
  assert.equal(typeof revived.handle, "string");
  assert.equal(typeof revived.date, "string");
  assert.equal(typeof revived.time, "string");
  assert.equal(revived.units, 3.5);
  assert.equal(revived.verified, true);
  assert.equal(revived.missing, null);
});

test("survives a payload with no dates at all", () => {
  assert.deepEqual(reviveCachedDates({ a: [1, 2], b: "x" }), {
    a: [1, 2],
    b: "x",
  });
  assert.equal(reviveCachedDates(null), null);
  assert.equal(reviveCachedDates(undefined), undefined);
});

/**
 * The structural half of the fix: reviving only helps if every cross-request
 * cache goes through the wrapper. `unstable_cache` used directly is how the
 * profile broke, so it may exist in exactly one file.
 */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

test("unstable_cache is only reached through cachedQuery", () => {
  const root = process.cwd();
  const offenders: string[] = [];

  for (const file of [
    ...sourceFiles(path.join(root, "src", "app")),
    ...sourceFiles(path.join(root, "src", "lib")),
  ]) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    if (rel === "src/lib/cached-query.ts") continue;

    fs.readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        // The import, not prose about it — comments cite the name freely.
        if (/^\s*import\b.*\bunstable_cache\b/.test(line)) {
          offenders.push(`${rel}:${i + 1} ${line.trim()}`);
        }
      });
  }

  assert.deepEqual(
    offenders,
    [],
    `unstable_cache imported outside src/lib/cached-query.ts. It round-trips ` +
      `its payload through JSON, so every Date in the cached value comes back ` +
      `as a string on a cache HIT and any component that formats it throws. ` +
      `Use cachedQuery() from "@/lib/cached-query":\n  ${offenders.join("\n  ")}`,
  );
});
