import process from "node:process";

import { PrismaClient } from "@prisma/client";

/**
 * Removes the fabricated `@ghost.scl.demo` demo cappers that were seeded to
 * preview populated states. They are not real records and must not sit beside
 * imported or native cappers on a public board.
 *
 * Deleting the User cascades to CapperProfile, and from there to Play, Parlay,
 * Package and LegacyRecord — so this is the whole footprint, not just the login.
 *
 * Dry run by default. Pass --commit to actually delete.
 *
 *   npx tsx scripts/wipe-ghost-cappers.ts            # report only
 *   npx tsx scripts/wipe-ghost-cappers.ts --commit   # delete
 */

const GHOST_DOMAIN = "@ghost.scl.demo";

try {
  process.loadEnvFile();
} catch {
  // No .env — rely on ambient environment variables.
}

const prisma = new PrismaClient();

async function main() {
  const commit = process.argv.includes("--commit");

  const target = (process.env.DATABASE_URL ?? "").replace(
    /:\/\/[^@]*@/,
    "://***@",
  );
  console.log(`target: ${target || "(DATABASE_URL unset)"}`);
  console.log(
    commit ? "mode  : COMMIT (will delete)\n" : "mode  : DRY RUN (no writes)\n",
  );

  const ghosts = await prisma.user.findMany({
    where: { email: { endsWith: GHOST_DOMAIN } },
    select: {
      username: true,
      capperProfile: {
        select: {
          _count: { select: { plays: true, parlays: true, packages: true } },
        },
      },
    },
    orderBy: { username: "asc" },
  });

  if (ghosts.length === 0) {
    console.log("No ghost cappers present — nothing to do.");
    return;
  }

  let plays = 0;
  let parlays = 0;
  let packages = 0;
  for (const g of ghosts) {
    const c = g.capperProfile?._count;
    plays += c?.plays ?? 0;
    parlays += c?.parlays ?? 0;
    packages += c?.packages ?? 0;
    console.log(
      `  @${String(g.username ?? "(no handle)").padEnd(20)} plays=${String(c?.plays ?? 0).padStart(4)} parlays=${String(c?.parlays ?? 0).padStart(3)} packages=${String(c?.packages ?? 0).padStart(3)}`,
    );
  }

  // What must NOT be touched — reported so the blast radius is explicit.
  const [survivingUsers, survivingPlays] = await Promise.all([
    prisma.user.count({
      where: { email: { not: { endsWith: GHOST_DOMAIN } } },
    }),
    prisma.play.count({
      where: {
        capper: { user: { email: { not: { endsWith: GHOST_DOMAIN } } } },
      },
    }),
  ]);

  console.log(
    `\nwould delete : ${ghosts.length} users, ${plays} plays, ${parlays} parlays, ${packages} packages`,
  );
  console.log(
    `would keep   : ${survivingUsers} users, ${survivingPlays} plays`,
  );

  if (!commit) {
    console.log("\nDry run — re-run with --commit to apply.");
    return;
  }

  const res = await prisma.user.deleteMany({
    where: { email: { endsWith: GHOST_DOMAIN } },
  });

  const [remaining, playsAfter, usersAfter] = await Promise.all([
    prisma.user.count({ where: { email: { endsWith: GHOST_DOMAIN } } }),
    prisma.play.count(),
    prisma.user.count(),
  ]);
  console.log(`\nDeleted ${res.count} ghost users.`);
  console.log(
    `Verified: ${remaining} ghosts remaining, ${usersAfter} users, ${playsAfter} plays total.`,
  );
  if (remaining !== 0) {
    console.error("!! ghosts still present after delete");
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
