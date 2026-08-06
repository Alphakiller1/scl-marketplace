/**
 * Incremental legacy play import.
 *
 * `db:import-legacy` guards play insertion with `if (existing === 0)`, so once a
 * capper has any plays it skips them entirely — re-running it after the
 * 2026-07-31 migration imports NOTHING and still reports success. That is silent
 * data loss for every pick the legacy site has taken since. This script closes
 * that gap: it diffs the incoming export against what is stored and writes only
 * the difference.
 *
 * Dry-run by default, matching `wipe-ghost-cappers.ts`. Nothing is written
 * without `--commit`.
 *
 *   npm run db:import-legacy-delta -- prisma/legacy-cappers.json
 *   npm run db:import-legacy-delta -- prisma/legacy-cappers.json --commit
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  planDelta,
  type ExistingPlay,
  type DeltaPlan,
} from "../src/lib/legacy-delta";
import { legacyImportSchema } from "../src/lib/schemas/legacy-import.schema";

const prisma = new PrismaClient();

function resolveProfit(p: {
  profitUnits?: number;
  oddsAmerican: number;
  units: number;
  outcome: string;
}): number | null {
  if (p.profitUnits !== undefined) return p.profitUnits;
  if (p.outcome === "WIN")
    return p.oddsAmerican > 0
      ? (p.units * p.oddsAmerican) / 100
      : (p.units * 100) / Math.abs(p.oddsAmerican);
  if (p.outcome === "LOSS") return -p.units;
  if (p.outcome === "PUSH" || p.outcome === "VOID") return 0;
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const fileArg =
    args.find((a) => !a.startsWith("--")) ?? "prisma/legacy-cappers.json";
  const filePath = path.resolve(process.cwd(), fileArg);

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    console.error(`✖ Could not read import file: ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const parsed = legacyImportSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    console.error("✖ Import file failed validation:");
    for (const issue of parsed.error.issues.slice(0, 20)) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n${commit ? "COMMIT" : "DRY RUN"} — ${parsed.data.length} cappers from ${path.basename(filePath)}\n`,
  );

  let totalInsert = 0;
  let totalSettle = 0;
  let totalUnchanged = 0;
  let missingCappers = 0;

  for (const capper of parsed.data) {
    if (!capper.plays?.length) continue;

    const email = (
      capper.email ?? `${capper.username}@legacy.scl`
    ).toLowerCase();
    const user = await prisma.user.findFirst({
      where: { username: capper.username },
      include: { capperProfile: { select: { id: true } } },
    });

    if (!user?.capperProfile) {
      // A capper new since the last import. Leave them to db:import-legacy,
      // which creates the User + CapperProfile; this script only adds plays.
      console.log(
        `  ?  ${capper.username} — no profile yet, run db:import-legacy first`,
      );
      missingCappers += 1;
      continue;
    }

    const stored = await prisma.play.findMany({
      where: { capperId: user.capperProfile.id },
      select: {
        id: true,
        sport: true,
        selection: true,
        oddsAmerican: true,
        createdAt: true,
        outcome: true,
      },
    });

    const plan: DeltaPlan = planDelta(capper.plays, stored as ExistingPlay[]);
    totalInsert += plan.insert.length;
    totalSettle += plan.settle.length;
    totalUnchanged += plan.unchanged;

    if (plan.insert.length || plan.settle.length) {
      console.log(
        `  →  ${capper.username.padEnd(24)} +${plan.insert.length} new, ${plan.settle.length} settling, ${plan.unchanged} unchanged`,
      );
    }

    if (!commit) continue;

    if (plan.insert.length) {
      await prisma.play.createMany({
        data: plan.insert.map((p) => ({
          capperId: user.capperProfile!.id,
          sport: p.sport,
          league: p.league ?? null,
          market: p.market,
          selection: p.selection,
          oddsAmerican: p.oddsAmerican,
          units: p.units,
          outcome: p.outcome,
          profitUnits: resolveProfit(p),
          gradedAt:
            p.gradedAt ??
            (p.outcome === "PENDING" ? null : (p.createdAt ?? null)),
          createdAt: p.createdAt ?? p.gradedAt ?? new Date(),
        })),
      });
    }

    for (const { id, play } of plan.settle) {
      await prisma.play.update({
        where: { id },
        data: {
          outcome: play.outcome,
          profitUnits: resolveProfit(play),
          gradedAt: play.gradedAt ?? play.createdAt ?? new Date(),
        },
      });
    }
  }

  console.log(
    `\n${commit ? "Wrote" : "Would write"}: ${totalInsert} new plays, ${totalSettle} settled.` +
      `\nUnchanged: ${totalUnchanged}. Cappers needing db:import-legacy first: ${missingCappers}.`,
  );
  if (!commit && (totalInsert || totalSettle)) {
    console.log("\nRe-run with --commit to apply.");
  }

  // LegacyRecord aggregates are scope-keyed upserts, so refresh them after this
  // with db:import-legacy-records — PRE_IMPORT is "season total minus imported
  // plays" and every play added here shifts it.
  if (commit && (totalInsert || totalSettle)) {
    console.log(
      "\n⚠ Now re-run `npm run db:import-legacy-records` — PRE_IMPORT subtracts\n" +
        "  imported plays from season totals, so it is now stale.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
