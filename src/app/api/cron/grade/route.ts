import { NextRequest, NextResponse } from "next/server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getGradingHealthReport } from "@/lib/grading-health";
import { autoGradePending } from "@/lib/results/auto-grade";
import { snapshotClosingOdds } from "@/lib/results/closing-snapshot";
import { getResultsProvider } from "@/lib/results/provider";
import { listAgedOutPendingPlays } from "@/lib/results/stuck-plays";

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization");

  if (secret) {
    return auth === secret;
  }

  // CRON_SECRET unset — allow local dev with no secret via x-vercel-cron header
  if (req.headers.get("x-vercel-cron") === "1") return true;

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

  // Prevent overlapping runs
  const running = await prisma.gradeJobRun.findFirst({ where: { status: "RUNNING" } });
  if (running) {
    console.warn(`[cron/grade] overlapping run prevented — existing run ${running.id}`);
    return NextResponse.json({ error: "Run already in progress", runId: running.id }, { status: 409 });
  }

  const provider = process.env.RESULTS_PROVIDER || "default";
  const job = await prisma.gradeJobRun.create({
    data: {
      provider,
      status: "RUNNING",
      skippedByReason: {},
    },
  });

  await prisma.gradeJobRun.update({ where: { id: job.id }, data: { startedAt: new Date() } });

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

    const stuckPlays = (result.skippedByReason?.aged_out ?? 0) > 0 ? await listAgedOutPendingPlays() : [];

    // Update job run with final stats
    await prisma.gradeJobRun.update({
      where: { id: job.id },
      data: {
        finishedAt: new Date(),
        status: "SUCCESS",
        graded: result.graded ?? 0,
        skipped: result.skipped ?? 0,
        parlaysGraded: result.parlaysGraded ?? 0,
        skippedByReason: result.skippedByReason ?? {},
        meta: { clvSnapshots, clvBackfilled, health },
      },
    });

    // Revalidate admin and public pages
    revalidatePath("/admin/grading");
    revalidatePath("/admin/plays");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/picks");
    revalidatePath("/picks");
    revalidatePath("/leaderboard");
    revalidatePath("/");

    if (health.status === "UNHEALTHY") {
      console.warn(
        `[cron/grade] health=UNHEALTHY pendingPast24h=${health.pendingPast24h}` +
          ` cliffRisk=${health.cliffRisk}` +
          ` skippedByReason=${JSON.stringify(result.skippedByReason)}`,
      );
    }

    return NextResponse.json({
      ok: true,
      runId: job.id,
      ...result,
      clvSnapshots,
      clvBackfilled,
      health,
      stuckPlays,
    });
  } catch (err) {
    console.error("[cron/grade] autoGradePending failed:", err);
    const message = err instanceof Error ? err.message : "Grade job failed";

    await prisma.gradeJobRun.update({
      where: { id: job.id },
      data: {
        finishedAt: new Date(),
        status: "FAILED",
        error: message,
      },
    });

    return NextResponse.json({ error: "Grade job failed", message }, { status: 500 });
  }
}
