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
  // Outcome is authoritative: PENDING has no realized profit, LOSS forfeits the
  // stake, and PUSH/VOID return it. A provided profitUnits only overrides the
  // (variable) WIN payout, so it can never contradict the recorded outcome.
  if (p.outcome === "PENDING") return null;
  if (p.outcome === "LOSS") return -p.units;
  if (p.outcome === "WIN") {
    return round2(p.profitUnits ?? payout(p.units, p.oddsAmerican));
  }
  return 0; // PUSH / VOID — stake returned
}

async function importCapper(c: LegacyCapperInput) {
  const email = (c.email ?? `${c.username}@legacy.scl`).toLowerCase();
  // Omitted optionals stay `undefined` so Prisma skips them on update (leaving
  // prior values intact) and applies the schema defaults on create.
  const profileData = {
    isLegacy: true,
    headline: c.headline,
    bio: c.bio,
    avatarUrl: c.avatarUrl,
    sports: c.sports,
    specialties: c.specialties,
    betTypes: c.betTypes,
    providerType: c.providerType,
    dailyVolume: c.dailyVolume,
    biggestBetWon: c.biggestBetWon,
    instagram: c.instagram,
    twitter: c.twitter,
    facebook: c.facebook,
    tiktok: c.tiktok,
    website: c.website,
  };

  // The import only ever (re)writes legacy records. If the email already
  // belongs to a real, non-legacy user, skip rather than overwrite them.
  const collision = await prisma.user.findUnique({
    where: { email },
    select: {
      passwordHash: true,
      capperProfile: { select: { isLegacy: true } },
    },
  });
  if (collision && !collision.capperProfile?.isLegacy) {
    throw new Error(
      `${email} already belongs to a non-legacy user — skipping to avoid overwriting it`,
    );
  }

  // Carry the previous platform's credential across so the capper signs in with
  // the password they already have. Once they've set an SCL password (claimed
  // the account or already migrated), a re-run must not resurrect the old one.
  const legacyCredential =
    c.passwordHash && !collision?.passwordHash
      ? {
          legacyPasswordHash: c.passwordHash,
          legacyPasswordFormat: c.passwordFormat ?? null,
        }
      : {};

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      username: c.username,
      displayName: c.displayName,
      emailVerified: c.verified ? new Date() : undefined,
      ...legacyCredential,
      capperProfile: { upsert: { create: profileData, update: profileData } },
    },
    create: {
      email,
      username: c.username,
      displayName: c.displayName,
      role: "CAPPER",
      ...legacyCredential,
      // No SCL password. With a legacy credential above, the capper signs in
      // with their old one and it is upgraded on first use; without one, the
      // profile stays unclaimed until they set a password (signup / reset link
      // / admin-issued link). See docs/LEGACY_MIGRATION.md.
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
