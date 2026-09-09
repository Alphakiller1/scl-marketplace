import "server-only";

import {
  completeOddsRun,
  failOddsRun,
  type ClaimedOddsRun,
} from "@/lib/odds-control-runtime";
import { siteUrl } from "@/lib/site-url";

export async function executeClaimedOddsRun(
  origin: string,
  run: ClaimedOddsRun,
): Promise<{
  id: string;
  sport: string;
  tier: string;
  ok: boolean;
  credits: number;
}> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    const error = new Error("CRON_SECRET is unavailable.");
    await failOddsRun(run.id, error);
    return {
      id: run.id,
      sport: run.sport,
      tier: run.tier,
      ok: false,
      credits: 0,
    };
  }
  // The dispatcher hands us its own request origin, which on a Vercel cron is
  // the DEPLOYMENT host, not the production alias — and that host sits behind
  // deployment protection, which answers a POST with an HTML challenge page.
  // The first run that ever got past the credit guard died on
  // `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`, having never
  // reached the route at all. The canonical origin is the one to call; the
  // passed-in origin stays as the local-dev fallback.
  const target = new URL("/api/cron/odds-populate", siteUrl() || origin);
  target.searchParams.set("sports", run.sport);
  target.searchParams.set("surface", run.tier === "surface" ? "1" : "0");
  target.searchParams.set(
    "expanded",
    run.tier === "expanded" ? String(run.maxEventsPerRun) : "0",
  );
  target.searchParams.set("expandedDays", "today,tomorrow");
  target.searchParams.set("skipPopulated", "1");
  target.searchParams.set("expandedMaxAgeMinutes", String(run.cadenceMinutes));
  const headers = new Headers({
    authorization: `Bearer ${secret}`,
    "x-scl-managed-run": "1",
  });
  headers.set(
    run.tier === "surface" ? "x-scl-surface-markets" : "x-scl-expanded-markets",
    run.markets.join(","),
  );
  if (run.leagues.length) headers.set("x-scl-leagues", run.leagues.join(","));

  try {
    const response = await fetch(target, {
      method: "POST",
      headers,
      cache: "no-store",
    });
    // Read as text first. A non-JSON body means the request never reached the
    // route — an HTML challenge or error page — and `response.json()` turns
    // that into a parser error that says nothing about the status code.
    const body = await response.text();
    let payload: {
      ok?: boolean;
      creditsUsed?: number;
      requestsRemaining?: number | null;
      error?: string;
      [key: string]: unknown;
    };
    try {
      payload = JSON.parse(body) as typeof payload;
    } catch {
      payload = {
        ok: false,
        error: `Population returned HTTP ${response.status} with a non-JSON body: ${body.slice(0, 120)}`,
      };
    }
    const ok = response.ok && payload.ok === true;
    const credits = Number(payload.creditsUsed ?? 0);
    await completeOddsRun(run.id, {
      ok,
      credits,
      remaining:
        typeof payload.requestsRemaining === "number"
          ? payload.requestsRemaining
          : null,
      details: payload,
      error: ok
        ? undefined
        : (payload.error ?? `Population returned HTTP ${response.status}.`),
    });
    return { id: run.id, sport: run.sport, tier: run.tier, ok, credits };
  } catch (error) {
    await failOddsRun(run.id, error);
    return {
      id: run.id,
      sport: run.sport,
      tier: run.tier,
      ok: false,
      credits: 0,
    };
  }
}
