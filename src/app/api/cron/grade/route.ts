import { NextRequest, NextResponse } from "next/server";

import { autoGradePending } from "@/lib/results/auto-grade";
import { snapshotClosingOdds } from "@/lib/results/closing-snapshot";
import { getResultsProvider } from "@/lib/results/provider";

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
  try {
    const clv = await snapshotClosingOdds();
    clvSnapshots = clv.snapshots;
  } catch (err) {
    console.error("[cron/grade] CLV snapshot skipped:", err);
  }

  try {
    const result = await autoGradePending(getResultsProvider());
    return NextResponse.json({
      ...result,
      clvSnapshots,
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
