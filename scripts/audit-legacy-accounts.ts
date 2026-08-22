/**
 * Roster-wide audit of the legacy migration: is the carried-over data attached
 * to the right accounts, and can every one of those cappers actually sign in?
 *
 *   npx tsx scripts/audit-legacy-accounts.ts            # summary + problems
 *   npx tsx scripts/audit-legacy-accounts.ts --all      # every account, one line each
 *
 * Read-only. Exits non-zero when any account is unable to sign in or any record
 * is attached to the wrong owner, so it can gate a release.
 *
 * `scripts/diagnose-login-by-email.ts` answers "why can this one person not get
 * in"; this answers "is the whole roster sound", which is the question you want
 * before telling 108 cappers the site is ready.
 */
import process from "node:process";

import { PrismaClient } from "@prisma/client";

import {
  allTimeLegacyRecordWhere,
  statsBaselineFromLegacyRows,
} from "../src/lib/legacy-all-time";
import { findLoginCandidates } from "../src/lib/user-credentials";

try {
  process.loadEnvFile();
} catch {
  // No .env — fall back to ambient environment variables.
}

const prisma = new PrismaClient();
const showAll = process.argv.includes("--all");

const PLACEHOLDER_DOMAIN = "@legacy.scl";

type Problem = { handle: string; issue: string; blocking: boolean };

function pct(n: number, total: number) {
  return total ? `${Math.round((n / total) * 100)}%` : "—";
}

async function main() {
  const users = await prisma.user.findMany({
    where: { capperProfile: { isLegacy: true } },
    select: {
      id: true,
      email: true,
      username: true,
      passwordHash: true,
      legacyPasswordHash: true,
      legacyPasswordFormat: true,
      accountStatus: true,
      emailVerified: true,
      isTest: true,
      termsAcceptances: { select: { policyVersion: true }, take: 1 },
      capperProfile: {
        select: {
          id: true,
          isLegacy: true,
          _count: { select: { plays: true, parlays: true, packages: true } },
          legacyRecords: {
            where: { ...allTimeLegacyRecordWhere, sport: "ALL" },
            select: { wins: true, losses: true, pushes: true, unitsNet: true },
          },
        },
      },
    },
    orderBy: { username: "asc" },
  });

  if (!users.length) {
    console.log("No legacy capper profiles found. Nothing to audit.");
    return;
  }

  // How many accounts share each inbox — an email alone cannot name one of these.
  const perEmail = new Map<string, number>();
  for (const u of users) {
    const key = u.email.toLowerCase();
    perEmail.set(key, (perEmail.get(key) ?? 0) + 1);
  }

  const problems: Problem[] = [];
  let signInReady = 0;
  let sclPassword = 0;
  let legacyOnly = 0;
  let noCredential = 0;
  let withPlays = 0;
  let withCarriedRecord = 0;
  let withPackages = 0;
  let acceptedTerms = 0;

  for (const u of users) {
    const handle = u.username ?? `(no username, id ${u.id})`;
    const add = (issue: string, blocking = true) =>
      problems.push({ handle, issue, blocking });

    // ---- can this person sign in at all? -------------------------------
    const hasScl = Boolean(u.passwordHash);
    const hasLegacy = Boolean(u.legacyPasswordHash);
    if (hasScl) sclPassword++;
    else if (hasLegacy) legacyOnly++;
    else noCredential++;

    if (!u.username) {
      add(
        "no username — cannot be identified at sign-in, and has no public profile URL",
      );
    }
    if (!hasScl && !hasLegacy) {
      add(
        "no password and no carried credential — must claim the account before signing in",
      );
    }
    if (u.accountStatus !== "ACTIVE") {
      add(`accountStatus is ${u.accountStatus} — sign-in is refused`);
    }
    if (!u.emailVerified) {
      add(
        "email not verified — sign-in lands on /verify instead of the dashboard",
      );
    }
    if (u.email.toLowerCase().endsWith(PLACEHOLDER_DOMAIN)) {
      add(
        "placeholder @legacy.scl email — no reset or notice can reach them; needs an admin claim link",
        false,
      );
    }
    if (u.email.includes("+")) {
      add(
        "plus-addressed email left over from an older import — sign-in resolves it, but reset and admin views show the wrong address",
        false,
      );
    }
    if ((perEmail.get(u.email.toLowerCase()) ?? 0) > 1) {
      add(
        `shares an inbox with ${(perEmail.get(u.email.toLowerCase()) ?? 1) - 1} other account(s) — must sign in with the username if the passwords match`,
        false,
      );
    }

    // ---- does what they type actually resolve to THIS account? ---------
    // The real sign-in lookup, not a re-implementation: the case-sensitivity
    // bug that locked out every mixed-case handle was invisible to any check
    // that did not run this exact code path.
    if (u.username) {
      const byUsername = await findLoginCandidates(
        u.username.toLowerCase(),
        "username",
      );
      if (!byUsername.some((c) => c.id === u.id)) {
        add(
          `username "${u.username}" does not resolve to this account at sign-in`,
        );
      }
    }
    const byEmail = await findLoginCandidates(u.email.toLowerCase(), "email");
    if (!byEmail.some((c) => c.id === u.id)) {
      add(`email "${u.email}" does not resolve to this account at sign-in`);
    }

    const canSignIn =
      Boolean(u.username) &&
      (hasScl || hasLegacy) &&
      u.accountStatus === "ACTIVE" &&
      Boolean(u.emailVerified);
    if (canSignIn) signInReady++;

    // ---- is the carried data attached to this account? -----------------
    const profile = u.capperProfile;
    if (!profile) {
      add("no capper profile — plays and packages have nothing to hang off");
      continue;
    }
    const plays = profile._count.plays + profile._count.parlays;
    const carried = statsBaselineFromLegacyRows(
      profile.legacyRecords.map((row) => ({
        wins: row.wins,
        losses: row.losses,
        pushes: row.pushes,
        unitsRisked: 0,
        unitsNet: row.unitsNet,
      })),
    );
    if (plays > 0) withPlays++;
    if (carried) withCarriedRecord++;
    if (profile._count.packages > 0) withPackages++;

    if (!plays && !carried) {
      add(
        "no plays and no carried record — their public profile shows an empty history",
        false,
      );
    }
    if (u.termsAcceptances.length) acceptedTerms++;

    if (showAll) {
      const credential = hasScl ? "scl" : hasLegacy ? "legacy" : "NONE";
      console.log(
        `${canSignIn ? "ok  " : "FAIL"} @${handle.padEnd(22)} ` +
          `cred=${credential.padEnd(6)} plays=${String(plays).padStart(4)} ` +
          `carried=${carried ? `${carried.wins}-${carried.losses}-${carried.pushes}` : "—"} ` +
          `pkgs=${profile._count.packages} ${u.email}`,
      );
    }
  }

  // ---- ownership integrity ---------------------------------------------
  // Only the check a foreign key cannot make: plays and packages cannot dangle
  // (the FK enforces that), but a *carried-over total* landing on a profile
  // that grew its record natively is a data error the schema permits.
  const orphanRecords = await prisma.legacyRecord.count({
    where: { capper: { isLegacy: false } },
  });
  if (orphanRecords > 0) {
    problems.push({
      handle: "(schema)",
      issue: `${orphanRecords} carried-over record(s) attached to a NON-legacy profile — those totals would inflate a natively-grown capper`,
      blocking: true,
    });
  }

  const total = users.length;
  console.log(`\nLegacy roster: ${total} account(s)\n`);
  console.log("  Sign-in readiness");
  console.log(
    `    ready to sign in        : ${signInReady} (${pct(signInReady, total)})`,
  );
  console.log(`    SCL password set        : ${sclPassword}`);
  console.log(
    `    carried credential only : ${legacyOnly}   (upgrades to bcrypt on first sign-in)`,
  );
  console.log(`    no credential at all    : ${noCredential}   (must claim)`);
  console.log("\n  Carried data");
  console.log(
    `    with plays              : ${withPlays} (${pct(withPlays, total)})`,
  );
  console.log(
    `    with carried record     : ${withCarriedRecord} (${pct(withCarriedRecord, total)})`,
  );
  console.log(
    `    with packages           : ${withPackages} (${pct(withPackages, total)})`,
  );
  console.log(
    `    accepted current terms  : ${acceptedTerms} (the rest are prompted at sign-in)`,
  );

  const blocking = problems.filter((p) => p.blocking);
  const advisory = problems.filter((p) => !p.blocking);

  if (blocking.length) {
    console.log(
      `\n  BLOCKING — these cappers cannot sign in (${blocking.length}):`,
    );
    for (const p of blocking) console.log(`    @${p.handle}: ${p.issue}`);
  } else {
    console.log("\n  No blocking problems: every legacy account can sign in.");
  }

  if (advisory.length) {
    console.log(`\n  Worth knowing (${advisory.length}):`);
    for (const p of advisory) console.log(`    @${p.handle}: ${p.issue}`);
  }

  if (blocking.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
