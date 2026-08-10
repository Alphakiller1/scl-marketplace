import { pathToFileURL } from "node:url";
import path from "node:path";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

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

async function fetchText(url, headers = {}) {
  const response = await fetch(url, {
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

async function fetchJson(url, headers = {}) {
  const body = await fetchText(url, headers);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${new URL(url).pathname} returned invalid JSON`);
  }
}

export async function verifyProductionRelease({
  baseUrl,
  expectedRelease,
  cronSecret,
  rounds = 8,
  intervalMs = 2_000,
}) {
  invariant(baseUrl, "baseUrl is required");
  invariant(expectedRelease, "expectedRelease is required");
  invariant(cronSecret, "CRON_SECRET is required for deep production checks");
  const base = baseUrl.replace(/\/$/, "");

  for (let round = 1; round <= rounds; round += 1) {
    const nonce = `${Date.now()}-${round}`;
    const [health, deep, picks, packages, leaderboard, home] =
      await Promise.all([
        fetchJson(`${base}/api/health?verify=${nonce}`),
        fetchJson(`${base}/api/health/deep?verify=${nonce}`, {
          authorization: cronSecret,
        }),
        fetchText(`${base}/picks?verify=${nonce}`),
        fetchText(`${base}/packages?verify=${nonce}`),
        fetchText(`${base}/leaderboard?verify=${nonce}`),
        fetchText(`${base}/?verify=${nonce}`),
      ]);

    verifyPublicHealth(health, expectedRelease);
    verifyDeepHealth(deep, expectedRelease);
    verifyPageMarker(picks, "picks", "data-pick-count");
    verifyPageMarker(packages, "packages", "data-package-count");
    verifyPageMarker(leaderboard, "leaderboard", "data-capper-count");
    verifyPageMarker(home, "home-leaderboard", "data-capper-count");

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
