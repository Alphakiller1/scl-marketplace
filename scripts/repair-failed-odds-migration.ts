import { execFileSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";

const MIGRATION = "20260714220000_add_play_odds_movement";
const MAX_ATTEMPTS = 5;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = Math.min(2000 * 2 ** (attempt - 1), 15000);
      console.warn(
        `[migration repair] ${label} attempt ${attempt}/${MAX_ATTEMPTS} failed; retry in ${delay}ms`,
      );
      if (attempt < MAX_ATTEMPTS) await sleep(delay);
    }
  }
  throw lastError;
}

async function main() {
  // Dedicated client with a tiny pool so build-time repair does not compete
  // with warm production isolates for the same connection budget.
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    const failed = await withRetry(
      "lookup failed migration",
      () =>
        prisma.$queryRaw<{ id: string }[]>`SELECT id
        FROM scl._prisma_migrations
        WHERE migration_name = ${MIGRATION}
          AND finished_at IS NULL
          AND rolled_back_at IS NULL
        LIMIT 1`,
    );

    if (!failed.length) {
      console.log(`[migration repair] ${MIGRATION}: no failed record`);
      return;
    }

    // This migration previously failed in production after its additive DDL was
    // applied manually/partially. Converge the columns safely before telling
    // Prisma that the historical migration is complete.
    await withRetry("converge odds columns", () =>
      prisma.$transaction([
        prisma.$executeRawUnsafe(`
          ALTER TABLE scl."Play"
            ADD COLUMN IF NOT EXISTS "selectedOddsAmerican" INTEGER
        `),
        prisma.$executeRawUnsafe(`
          ALTER TABLE scl."Play"
            ADD COLUMN IF NOT EXISTS "oddsMovedAccepted" BOOLEAN
        `),
        prisma.$executeRawUnsafe(`
          ALTER TABLE scl."Play"
            ALTER COLUMN "oddsMovedAccepted" SET DEFAULT false
        `),
        prisma.$executeRawUnsafe(`
          UPDATE scl."Play"
            SET "oddsMovedAccepted" = false
            WHERE "oddsMovedAccepted" IS NULL
        `),
        prisma.$executeRawUnsafe(`
          ALTER TABLE scl."Play"
            ALTER COLUMN "oddsMovedAccepted" SET NOT NULL
        `),
      ]),
    );

    await prisma.$disconnect();

    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    execFileSync(
      npx,
      ["prisma", "migrate", "resolve", "--applied", MIGRATION],
      {
        stdio: "inherit",
        env: process.env,
      },
    );
    console.log(`[migration repair] ${MIGRATION}: repaired and resolved`);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("[migration repair] failed", error);
  process.exitCode = 1;
});
