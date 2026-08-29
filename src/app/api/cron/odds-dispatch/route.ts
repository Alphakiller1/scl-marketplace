import { NextRequest, NextResponse } from "next/server";

import {
  claimDueOddsRuns,
  completeOddsRun,
  failOddsRun,
  type ClaimedOddsRun,
} from "@/lib/odds-control-runtime";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(
    secret && req.headers.get("authorization") === `Bearer ${secret}`,
  );
}

async function execute(req: NextRequest, run: ClaimedOddsRun) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) throw new Error("CRON_SECRET is unavailable.");
  const target = new URL("/api/cron/odds-populate", req.url);
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
    const payload = (await response.json()) as {
      ok?: boolean;
      creditsUsed?: number;
      requestsRemaining?: number | null;
      error?: string;
      [key: string]: unknown;
    };
    await completeOddsRun(run.id, {
      ok: response.ok && payload.ok === true,
      credits: Number(payload.creditsUsed ?? 0),
      remaining:
        typeof payload.requestsRemaining === "number"
          ? payload.requestsRemaining
          : null,
      details: payload,
      error:
        response.ok && payload.ok === true
          ? undefined
          : (payload.error ?? `Population returned HTTP ${response.status}.`),
    });
    return {
      id: run.id,
      sport: run.sport,
      tier: run.tier,
      ok: payload.ok === true,
    };
  } catch (error) {
    await failOddsRun(run.id, error);
    return { id: run.id, sport: run.sport, tier: run.tier, ok: false };
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const claimed = await claimDueOddsRuns();
  if (!claimed.runs.length) {
    return NextResponse.json({ ok: true, state: claimed.state, runs: [] });
  }
  const runs = await Promise.all(claimed.runs.map((run) => execute(req, run)));
  return NextResponse.json({
    ok: runs.every((run) => run.ok),
    state: claimed.state,
    runs,
  });
}
