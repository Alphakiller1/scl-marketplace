import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ONE-TIME: marks the stuck failed migration as applied so future migrations can run.
// The columns (User.isTest, Play.needsReview) were already added via the SQL runbook.
// DELETE this file after running once in production.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization");
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // Mark the failed migration as applied in the Prisma shadow migrations table.
    // The scl schema prefix is required because all tables live in the scl schema.
    await prisma.$executeRaw`
      UPDATE "scl"."_prisma_migrations"
      SET "finished_at" = now(),
          "applied_steps_count" = 1,
          "logs" = NULL
      WHERE "migration_name" = '20260719000000_ci_catchup_istest_needsreview'
    `;
    return NextResponse.json({ ok: true, message: "Migration marked as applied." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}