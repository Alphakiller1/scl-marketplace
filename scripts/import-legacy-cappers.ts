import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { PrismaClient } from "@prisma/client";

import {
  legacyImportSchema,
  type LegacyCapperInput,
  type LegacyPlayInput,
} from "../src/lib/schemas/legacy-import.schema";

// A bare `tsx` run doesn't load .env the way `prisma db seed` does.
try {
  process.loadEnvFile();
} catch {
  // No .env file present — fall back to ambient environment variables.
}

const prisma = new PrismaClient();

const round2 = (n: number) => Math.round(n * 100) / 100;

/** American-odds profit for a winning unit stake. */
function payout(units: number, odds: number): number {
  return odds > 0 ? units * (odds / 100) : units * (100 / Math.abs(odds));
}

function resolveProfit(p: LegacyPlayInput): number | null {
  if (p.outcome === "PENDING") return null;
  if (p.profitUnits != null) return round2(p.profitUnits);
  if (p.outcome === "WIN") return round2(payout(p.units, p.oddsAmerican));
  if (p.outcome === "LOSS") return -p.units;
  return 0; // PUSH / VOID — stake returned
}

async function importCapper(c: LegacyCapperInput) {
  const email = (c.email ?? `${c.username}@legacy.scl`).toLowerCase();
  const profileData = {
    isLegacy: true,
    headline: c.headline,
    bio: c.bio,
    avatarUrl: c.avatarUrl,
    sports: c.sports ?? [],
    specialties: c.specialties ?? [],
    betTypes: c.betTypes ?? [],
    providerType: c.providerType ?? "FREE",
    instagram: c.instagram,
    twitter: c.twitter,
    facebook: c.facebook,
    tiktok: c.tiktok,
    website: c.website,
  };

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      displayName: c.displayName,
      emailVerified: c.verified ? new Date() : null,
      capperProfile: { upsert: { create: profileData, update: profileData } },
    },
    create: {
      email,
      username: c.username,
      displayName: c.displayName,
      role: "CAPPER",
      // No password — legacy profiles stay unclaimed until the Phase 2 claim flow.
      emailVerified: c.verified ? new Date() : null,
      capperProfile: { create: profileData },
    },
    include: { capperProfile: true },
  });

  let playsInserted = 0;
  if (user.capperProfile && c.plays?.length) {
    const profileId = user.capperProfile.id;
    const existing = await prisma.play.count({
      where: { capperId: profileId },
    });
    if (existing === 0) {
      const now = new Date();
      const res = await prisma.play.createMany({
        data: c.plays.map((p) => ({
          capperId: profileId,
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
            (p.outcome === "PENDING" ? null : (p.createdAt ?? now)),
          createdAt: p.createdAt ?? now,
        })),
      });
      playsInserted = res.count;
    }
  }

  return { email, playsInserted };
}

async function main() {
  const fileArg = process.argv[2] ?? "prisma/legacy-cappers.json";
  const filePath = path.resolve(process.cwd(), fileArg);

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    console.error(`✖ Could not read import file: ${filePath}`);
    console.error(
      "  Usage: npm run db:import-legacy -- path/to/legacy-cappers.json",
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

  const parsed = legacyImportSchema.safeParse(json);
  if (!parsed.success) {
    console.error("✖ Import file failed validation:");
    console.error(JSON.stringify(parsed.error.flatten(), null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(
    `Importing ${parsed.data.length} legacy capper(s) from ${fileArg}…`,
  );
  let ok = 0;
  let plays = 0;
  const failures: { username: string; error: string }[] = [];

  for (const capper of parsed.data) {
    try {
      const res = await importCapper(capper);
      ok++;
      plays += res.playsInserted;
      console.log(
        `  ✓ @${capper.username} (${res.email})${res.playsInserted ? ` — ${res.playsInserted} plays` : ""}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ username: capper.username, error: msg });
      console.error(`  ✖ @${capper.username}: ${msg}`);
    }
  }

  console.log(
    `\nDone. ${ok} imported, ${plays} plays inserted, ${failures.length} failed.`,
  );
  if (failures.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
