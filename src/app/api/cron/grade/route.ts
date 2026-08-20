import { NextRequest, NextResponse } from "next/server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getGradingHealthReport } from "@/lib/grading-health";
import { autoGradePending } from "@/lib/results/auto-grade";
import { getResultsProvider } from "@/lib/results/provider";
import {
  listAgedOutPendingPlays,
  listOverduePendingPlays,
} from "@/lib/results/stuck-plays";

export const maxDuration = 300;

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization");

  if (secret) {
    return auth === secret || auth === `Bearer ${secret}`;
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
  const running = await prisma.gradeJobRun.findFirst({
    where: { status: "RUNNING" },
  });
  if (running) {
    const beganAt = running.startedAt ?? running.createdAt;
    const stale = Date.now() - beganAt.getTime() > 10 * 60 * 1_000;
    if (!stale) {
      console.warn("[cron/grade] overlapping run prevented", {
        runId: running.id,
      });
      return NextResponse.json(
        { error: "Run already in progress", runId: running.id },
        { status: 409 },
      );
    }
    await prisma.gradeJobRun.update({
      where: { id: running.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: "Recovered stale RUNNING grader lock after 10 minutes",
      },
    });
    console.error("[cron/grade] recovered stale grader lock", {
      runId: running.id,
      beganAt: beganAt.toISOString(),
    });
  }

  const provider = process.env.RESULTS_PROVIDER || "grading-backstops";
  const job = await prisma.gradeJobRun.create({
    data: {
      provider,
      status: "RUNNING",
      skippedByReason: {},
    },
  });

  await prisma.gradeJobRun.update({
    where: { id: job.id },
    data: { startedAt: new Date() },
  });

  try {
    const result = await autoGradePending(getResultsProvider());
    const health = await getGradingHealthReport();

    const stuckPlays =
      (result.skippedByReason?.aged_out ?? 0) > 0
        ? await listAgedOutPendingPlays()
        : [];
    const overduePending = await listOverduePendingPlays();
    const gradeOk =
      health.status !== "UNHEALTHY" && overduePending.length === 0;

    // Update job run with final stats
    await prisma.gradeJobRun.update({
      where: { id: job.id },
      data: {
        finishedAt: new Date(),
        status: gradeOk ? "SUCCESS" : "FAILED",
        graded: result.graded ?? 0,
        skipped: result.skipped ?? 0,
        parlaysGraded: result.parlaysGraded ?? 0,
        skippedByReason: result.skippedByReason ?? {},
        error: gradeOk
          ? null
          : `${overduePending.length} plays remain pending past expected final time`,
        meta: {
          health,
          overduePending: overduePending.length,
        },
      },
    });

    revalidateTag("leaderboard", { expire: 0 });
    revalidatePath("/admin/grading");
    revalidatePath("/admin/plays");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/picks");
    revalidatePath("/picks");
    revalidatePath("/leaderboard");
    revalidatePath("/discover");
    revalidatePath("/cappers/[handle]", "page");
    revalidatePath("/");

    if (health.status === "UNHEALTHY") {
      console.warn(
        `[cron/grade] health=UNHEALTHY pendingPastExpectedFinal=${health.pendingPastExpectedFinal}` +
          ` pendingPast24h=${health.pendingPast24h}` +
          ` cliffRisk=${health.cliffRisk}` +
          ` skippedByReason=${JSON.stringify(result.skippedByReason)}`,
      );
    }

    return NextResponse.json(
      {
        ok: gradeOk,
        runId: job.id,
        ...result,
        health,
        overduePending,
        stuckPlays,
      },
      { status: gradeOk ? 200 : 503 },
    );
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

    return NextResponse.json(
      { error: "Grade job failed", message },
      { status: 500 },
    );
  }
}
