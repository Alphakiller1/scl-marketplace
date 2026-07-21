import { NextRequest, NextResponse } from "next/server";

import { getGradingHealthReport } from "@/lib/grading-health";
import { autoGradePending } from "@/lib/results/auto-grade";
import { snapshotClosingOdds } from "@/lib/results/closing-snapshot";
import { getResultsProvider } from "@/lib/results/provider";
import { listAgedOutPendingPlays } from "@/lib/results/stuck-plays";

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();

  if (secret) {
    const auth = req.headers.get("authorization");
    return auth === `Bearer ${secret}`;
  }

  // CRON_SECRET unset — accept Vercel's cron invocation header only.
  if (req.headers.get("x-vercel-cron") === "1") {
    return true;
  }

  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    console.error("[cron/grade] CRON_SECRET is not set in production");
  }
  return false;
}

export async function GET(req: NextRequest) {
  return runGrade(req);
}

export async function POST(req: NextRequest) {
  return runGrade(req);
}

async function runGrade(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let clvSnapshots = 0;
  let clvBackfilled = 0;
  try {
    const clv = await snapshotClosingOdds();
    clvSnapshots = clv.snapshots;
    clvBackfilled = clv.backfilled;
  } catch (err) {
    console.error("[cron/grade] CLV snapshot skipped:", err);
  }

  try {
    const result = await autoGradePending(getResultsProvider());
    const health = await getGradingHealthReport();
    const stuckPlays =
      (result.skippedByReason.aged_out ?? 0) > 0
        ? await listAgedOutPendingPlays()
        : [];
    if (health.status === "UNHEALTHY") {
      console.warn(
        `[cron/grade] health=UNHEALTHY pendingPast24h=${health.pendingPast24h}` +
          ` cliffRisk=${health.cliffRisk}` +
          ` skippedByReason=${JSON.stringify(result.skippedByReason)}`,
      );
    }
    return NextResponse.json({
      ...result,
      clvSnapshots,
      clvBackfilled,
      health,
      stuckPlays,
    });
  } catch (err) {
    console.error("[cron/grade] autoGradePending failed:", err);
    const message = err instanceof Error ? err.message : "Grade job failed";
    return NextResponse.json(
      { error: "Grade job failed", message },
      { status: 500 },
    );
  }
}
