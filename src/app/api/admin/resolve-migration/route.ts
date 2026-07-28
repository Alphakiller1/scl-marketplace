import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// ONE-TIME v2: fixes the stuck failed migration unconditionally (no IS NULL guard).
// A failed migration has finished_at SET (to the failure time) and logs containing
// the error — our v1 endpoint incorrectly filtered WITH "finished_at IS NULL".
// DELETE this file after getting {"ok":true,"rowsUpdated":1,...}.
async function resolveMigration() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await prisma.$executeRaw`
      UPDATE "scl"."_prisma_migrations"
      SET "finished_at"        = now(),
          "applied_steps_count" = 1,
          "logs"               = NULL
      WHERE "migration_name" = '20260719000000_ci_catchup_istest_needsreview'
    `;
    return NextResponse.json({
      ok: true,
      rowsUpdated: result,
      message:
        result > 0
          ? "✅ Migration marked as applied. Now tell the agent to merge the re-enable PR."
          : "⚠️ No rows updated — migration name not found. Check the DB directly.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const GET  = resolveMigration;
export const POST = resolveMigration;