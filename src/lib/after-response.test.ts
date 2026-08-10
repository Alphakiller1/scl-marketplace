import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { afterResponse } from "@/lib/after-response";

/**
 * Guards the fix for a production outage: unawaited post-response work wedged
 * pooled connections `idle in transaction` until the pooler timed them out.
 * With `max_connections = 60`, a handful starved the pool and pick entry
 * started returning `ECHECKOUTTIMEOUT` 500s — odds telemetry taking down the
 * ability to log a play.
 */

test("afterResponse runs the work when there is no request scope", async () => {
  // Outside a request, `after()` throws and the fallback must still run the
  // work — otherwise scripts and the cron worker would silently drop writes.
  let ran = false;
  afterResponse(async () => {
    ran = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ran, true);
});

test("afterResponse swallows failures so post-response work cannot break a page", async () => {
  let settled = false;
  assert.doesNotThrow(() => {
    afterResponse(async () => {
      settled = true;
      throw new Error("boom");
    });
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, true);
});

/**
 * A bare `void someAsyncCall()` in server code races the response: on
 * serverless the isolate can be frozen once the response is sent, cutting a
 * transaction between BEGIN and COMMIT. Anything genuinely deferred must go
 * through `afterResponse` (or `after()`), which keeps the invocation alive.
 *
 * The allowlist below is deliberately tiny and explicit. Adding to it should
 * require justifying why the call cannot leak a connection.
 */
const VOID_ALLOWLIST = new Set([
  // The fallback inside afterResponse itself — no response to race there.
  "src/lib/after-response.ts",
  // Module-scope schema probes, before any response exists.
  "src/lib/prisma.ts",
]);

test("public health and odds routes never launch grading work", () => {
  for (const rel of [
    "src/app/api/health/route.ts",
    "src/app/api/odds/route.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    assert.doesNotMatch(source, /maybeSweepGrading|autoGradePending/);
  }
});

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

test("no new fire-and-forget calls in server code", () => {
  const root = process.cwd();
  const offenders: string[] = [];

  for (const file of [
    ...sourceFiles(path.join(root, "src", "app")),
    ...sourceFiles(path.join(root, "src", "lib")),
  ]) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    if (VOID_ALLOWLIST.has(rel)) continue;

    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      // `void ` starting a statement and calling something.
      if (/^\s*void\s+[A-Za-z_$][\w$.]*\s*\(/.test(line)) {
        offenders.push(`${rel}:${i + 1} ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(
    offenders,
    [],
    `Unawaited call(s) found. On serverless these race the response and can ` +
      `leave a database transaction open, wedging a pooled connection until it ` +
      `times out. Wrap the work in afterResponse() from "@/lib/after-response", ` +
      `or await it:\n  ${offenders.join("\n  ")}`,
  );
});
