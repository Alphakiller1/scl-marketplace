import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { PrismaClient } from "@prisma/client";

import {
  legacyRecordsImportSchema,
  type LegacyRecordCapper,
} from "../src/lib/schemas/legacy-records.schema";

// A bare `tsx` run doesn't load .env the way `prisma db seed` does.
try {
  process.loadEnvFile();
} catch {
  // No .env file present — fall back to ambient environment variables.
}

const prisma = new PrismaClient();

/**
 * Imports the aggregate totals carried over from the previous SCL platform.
 * Run AFTER `db:import-legacy`, which creates the profiles these attach to.
 *
 * Idempotent: records are keyed by (capper, scope, sport) and upserted, and a
 * re-run with a smaller export prunes the scope/sport rows that disappeared so
 * stale totals can't linger on a profile.
 */
async function importRecords(c: LegacyRecordCapper) {
  const user = await prisma.user.findUnique({
    where: { username: c.username },
    select: { capperProfile: { select: { id: true, isLegacy: true } } },
  });

  const profile = user?.capperProfile;
  if (!profile) {
    throw new Error(
      "no capper profile — run `npm run db:import-legacy` first so the profile exists",
    );
  }
  // These totals have no pick-level evidence behind them. Attaching them to a
  // natively-grown capper would inflate a record that was earned on SCL.
  if (!profile.isLegacy) {
    throw new Error(
      "profile is not flagged isLegacy — refusing to attach carried-over totals to a native capper",
    );
  }

  const written: string[] = [];
  for (const r of c.records) {
    const data = {
      wins: r.wins,
      losses: r.losses,
      pushes: r.pushes,
      unitsRisked: r.unitsRisked,
      unitsNet: r.unitsNet,
      capturedAt: c.capturedAt,
    };
    await prisma.legacyRecord.upsert({
      where: {
        capperId_scope_sport: {
          capperId: profile.id,
          scope: r.scope,
          sport: r.sport,
        },
      },
      update: data,
      create: { capperId: profile.id, scope: r.scope, sport: r.sport, ...data },
    });
    written.push(`${r.scope}:${r.sport}`);
  }

  const stale = await prisma.legacyRecord.deleteMany({
    where: {
      capperId: profile.id,
      NOT: c.records.map((r) => ({ scope: r.scope, sport: r.sport })),
    },
  });

  return { written: written.length, pruned: stale.count };
}

async function main() {
  const fileArg = process.argv[2] ?? "prisma/legacy-records.json";
  const filePath = path.resolve(process.cwd(), fileArg);

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    console.error(`✖ Could not read import file: ${filePath}`);
    console.error(
      "  Usage: npm run db:import-legacy-records -- path/to/legacy-records.json",
    );
    process.exitCode = 1;
    return;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error(`✖ ${fileArg} is not valid JSON.`, err);
    process.exitCode = 1;
    return;
  }

  const parsed = legacyRecordsImportSchema.safeParse(json);
  if (!parsed.success) {
    console.error("✖ Import file failed validation:");
    console.error(JSON.stringify(parsed.error.flatten(), null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(
    `Importing carried-over records for ${parsed.data.length} capper(s) from ${fileArg}…`,
  );
  let ok = 0;
  let rows = 0;
  let pruned = 0;
  const failures: { username: string; error: string }[] = [];

  for (const capper of parsed.data) {
    try {
      const res = await importRecords(capper);
      ok++;
      rows += res.written;
      pruned += res.pruned;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ username: capper.username, error: msg });
      console.error(`  ✖ @${capper.username}: ${msg}`);
    }
  }

  console.log(
    `\nDone. ${ok} capper(s), ${rows} record rows written` +
      `${pruned ? `, ${pruned} stale pruned` : ""}, ${failures.length} failed.`,
  );
  if (failures.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
