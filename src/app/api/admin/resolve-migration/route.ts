import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// ONE-TIME: marks the stuck failed migration as applied so future migrations can run.
// The columns (User.isTest, Play.needsReview) were already added via the SQL runbook.
// DELETE this file after running once in production.

async function resolveMigration() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // Mark the failed migration as applied in the Prisma shadow migrations table.
    const result = await prisma.$executeRaw`
      UPDATE "scl"."_prisma_migrations"
      SET "finished_at" = now(),
          "applied_steps_count" = 1,
          "logs" = NULL
      WHERE "migration_name" = '20260719000000_ci_catchup_istest_needsreview'
        AND "finished_at" IS NULL
    `;
    return NextResponse.json({
      ok: true,
      rowsUpdated: result,
      message:
        result > 0
          ? "✅ Migration marked as applied. Now trigger a new Vercel deploy to apply pending GradeJobRun migration."
          : "ℹ️ No rows updated — migration may already be resolved.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const GET = resolveMigration;
export const POST = resolveMigration;