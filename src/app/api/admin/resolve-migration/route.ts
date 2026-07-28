import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// ONE-TIME v3: batch-resolves ALL migrations that were applied manually to production.
// Reads each migration.sql file, computes the SHA-256 checksum (same algo Prisma uses),
// and UPSERTs rows in _prisma_migrations so that only GradeJobRun is left to apply.
// DELETE this file after getting {"ok":true}.

const GRADE_JOB_RUN = "20260728160025_add_grade_job_run";

async function resolveMigrations() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const migrationsDir = join(process.cwd(), "prisma", "migrations");
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== GRADE_JOB_RUN)
    .map((d) => d.name)
    .sort();

  const results: Record<string, string> = {};

  for (const dir of dirs) {
    const sqlPath = join(migrationsDir, dir, "migration.sql");
    let content: string;
    try {
      content = readFileSync(sqlPath, "utf8");
    } catch {
      results[dir] = "SKIPPED (no migration.sql)";
      continue;
    }

    // Prisma stores sha256(file_content) as lowercase hex
    const checksum = createHash("sha256").update(content).digest("hex");

    try {
      // UPSERT: insert as applied if missing, or fix if failed
      await prisma.$executeRaw`
        INSERT INTO "scl"."_prisma_migrations"
          (id, checksum, started_at, finished_at, migration_name, logs, rolled_back_at, applied_steps_count)
        VALUES
          (gen_random_uuid()::text, ${checksum}, now(), now(), ${dir}, NULL, NULL, 1)
        ON CONFLICT (migration_name) DO UPDATE SET
          finished_at        = now(),
          applied_steps_count = 1,
          logs               = NULL,
          checksum           = EXCLUDED.checksum
      `;
      results[dir] = "OK";
    } catch (err) {
      results[dir] = `ERR: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const failed = Object.entries(results).filter(([, v]) => v !== "OK");
  return NextResponse.json({
    ok: failed.length === 0,
    total: dirs.length,
    results,
    next: "Trigger a new Vercel deploy — only GradeJobRun migration will now be applied.",
  });
}

export const GET  = resolveMigrations;
export const POST = resolveMigrations;