import { execFileSync } from "node:child_process";

import { prisma } from "@/lib/prisma";

const MIGRATION = "20260714220000_add_play_odds_movement";

async function main() {
  const failed = await prisma.$queryRaw<{ id: string }[]>`SELECT id
    FROM scl._prisma_migrations
    WHERE migration_name = ${MIGRATION}
      AND finished_at IS NULL
      AND rolled_back_at IS NULL
    LIMIT 1`;

  if (!failed.length) {
    console.log(`[migration repair] ${MIGRATION}: no failed record`);
    return;
  }

  // This migration previously failed in production after its additive DDL was
  // applied manually/partially. Converge the columns safely before telling
  // Prisma that the historical migration is complete.
  await prisma.$transaction([
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
  ]);

  await prisma.$disconnect();

  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npx, ["prisma", "migrate", "resolve", "--applied", MIGRATION], {
    stdio: "inherit",
    env: process.env,
  });
  console.log(`[migration repair] ${MIGRATION}: repaired and resolved`);
}

main()
  .catch((error) => {
    console.error("[migration repair] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
