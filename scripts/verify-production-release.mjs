import { pathToFileURL } from "node:url";
import path from "node:path";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

export const MARKETING_PAGES = [
  { path: "/picks", story: "picks", countAttribute: "data-pick-count" },
  {
    path: "/packages",
    story: "packages",
    countAttribute: "data-package-count",
  },
  {
    path: "/leaderboard",
    story: "leaderboard",
    countAttribute: "data-capper-count",
  },
  { path: "/", story: "home-leaderboard", countAttribute: "data-capper-count" },
];

export function verifyPublicHealth(health, expectedRelease) {
  invariant(health?.status === "ok", "public health is not ok");
  invariant(
    health?.release === expectedRelease,
    `release mismatch: expected ${expectedRelease}, received ${health?.release ?? "missing"}`,
  );
  invariant(health?.database === "reachable", "database is not reachable");
  invariant(
    health?.databasePool?.pooled === true &&
      Number(health?.databasePool?.connectionLimit) >= 5,
    "database pool is not Fluid Compute safe",
  );
  invariant(
    health?.odds?.configured === true,
    "odds provider is not configured",
  );
  invariant(health?.odds?.reachable === true, "odds provider is not reachable");
}

export function verifyDeepHealth(health, expectedRelease) {
  invariant(health?.status === "ok", "deep health is not ok");
  invariant(
    health?.release === expectedRelease,
    `deep release mismatch: expected ${expectedRelease}, received ${health?.release ?? "missing"}`,
  );
  const failedChecks = Object.entries(health?.checks ?? {})
    .filter(([, ready]) => ready !== true)
    .map(([name]) => name);
  invariant(
    failedChecks.length === 0,
    `deep health checks failed: ${failedChecks.join(", ") || "missing checks"}`,
  );
  invariant(
    Number(health?.counts?.publicCappers) > 0,
    "deep health found no public cappers",
  );
  invariant(
    Number(health?.counts?.publicPicks) > 0,
    "deep health found no public picks",
  );
  invariant(
    Number(health?.counts?.publicPackages) > 0,
    "deep health found no public packages",
  );
  invariant(
    Number(health?.counts?.selectableOddsBoardEvents) > 0,
    "Log a Pick has no selectable Today/Tomorrow events",
  );
  invariant(
    Array.isArray(health?.legacy?.errors) && health.legacy.errors.length === 0,
    `legacy package errors: ${(health?.legacy?.errors ?? ["missing report"]).join("; ")}`,
  );
}

export function verifyPageMarker(html, story, countAttribute) {
  invariant(
    html.includes(`data-scl-verification="${story}"`),
    `${story} verification marker is missing`,
  );
  invariant(
    html.includes('data-data-status="ok"'),
    `${story} rendered degraded data`,
  );
  const match = html.match(new RegExp(`${countAttribute}="(\\d+)"`));
  invariant(match, `${story} count marker is missing`);
  invariant(Number(match[1]) > 0, `${story} rendered an empty data set`);
}

export async function retryAsync(fn, { attempts, delayMs }) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

async function fetchText(url, headers = {}, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: { "cache-control": "no-cache", ...headers },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `${new URL(url).pathname} returned HTTP ${response.status}: ${body.slice(0, 500)}`,
    );
  }
  return body;
}

async function fetchJson(url, headers = {}, fetchImpl = fetch) {
  const body = await fetchText(url, headers, fetchImpl);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${new URL(url).pathname} returned invalid JSON`);
  }
}

export async function fetchMarketingPages(base, nonce, fetchImpl = fetch) {
  const htmlByStory = {};
  // Marketing pages share the 5-connection Fluid pool. Fetch them one at a
  // time so a fresh isolate is not stampeded by health + four ISR renders.
  // 2026-08-22: parallel /picks + /leaderboard + /packages failed deploy
  // with "picks rendered degraded data" while a follow-up curl was `ok`.
  for (const page of MARKETING_PAGES) {
    const html = await fetchText(
      `${base}${page.path}?verify=${nonce}`,
      {},
      fetchImpl,
    );
    verifyPageMarker(html, page.story, page.countAttribute);
    htmlByStory[page.story] = html;
  }
  return htmlByStory;
}

export function verifyMarketingPages(htmlByStory) {
  for (const page of MARKETING_PAGES) {
    verifyPageMarker(htmlByStory[page.story], page.story, page.countAttribute);
  }
}

export async function verifyProductionRelease({
  baseUrl,
  expectedRelease,
  cronSecret,
  rounds = 8,
  intervalMs = 2_000,
  pageRetryAttempts = 3,
  pageRetryDelayMs = 2_000,
  fetchImpl = fetch,
}) {
  invariant(baseUrl, "baseUrl is required");
  invariant(expectedRelease, "expectedRelease is required");
  invariant(cronSecret, "CRON_SECRET is required for deep production checks");
  const base = baseUrl.replace(/\/$/, "");

  for (let round = 1; round <= rounds; round += 1) {
    const nonce = `${Date.now()}-${round}`;
    const [health, deep] = await Promise.all([
      fetchJson(`${base}/api/health?verify=${nonce}`, {}, fetchImpl),
      fetchJson(
        `${base}/api/health/deep?verify=${nonce}`,
        { authorization: cronSecret },
        fetchImpl,
      ),
    ]);

    verifyPublicHealth(health, expectedRelease);
    verifyDeepHealth(deep, expectedRelease);

    await retryAsync(
      (attempt) => fetchMarketingPages(base, `${nonce}-p${attempt}`, fetchImpl),
      { attempts: pageRetryAttempts, delayMs: pageRetryDelayMs },
    );

    console.info(
      JSON.stringify({
        event: "production_release_round_passed",
        round,
        rounds,
        release: expectedRelease,
        deepDurationMs: deep.durationMs,
      }),
    );
    if (round < rounds && intervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  const [baseUrl, expectedRelease, rawRounds, rawInterval] =
    process.argv.slice(2);
  verifyProductionRelease({
    baseUrl,
    expectedRelease,
    cronSecret: process.env.CRON_SECRET,
    rounds: rawRounds ? Number(rawRounds) : 8,
    intervalMs: rawInterval ? Number(rawInterval) : 2_000,
  }).catch((error) => {
    console.error(
      JSON.stringify({
        event: "production_release_verification_failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 1;
  });
}
