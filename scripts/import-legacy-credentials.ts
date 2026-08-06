/**
 * Give imported legacy cappers a working login.
 *
 * The legacy platform stored passwords in PLAINTEXT. The original import
 * deliberately created every capper with no `passwordHash`, pending a claim
 * flow that was never built — so 109 of 130 accounts cannot sign in, and
 * `emailVerified` being null also blocks pick entry (play.action.ts) and
 * redirects to /verify (session.ts).
 *
 * This hashes each legacy password with bcrypt (same cost as the app's own
 * signup) and sets it on the matching account, so a capper's existing password
 * keeps working on the new platform.
 *
 * Matching is by `username`, not email: the extractor plus-addresses shared
 * inboxes to keep them unique (five WGS accounts share one address), so email
 * is not a reliable key. Usernames come straight from legacy `cappers.user`.
 *
 * SAFETY
 *  - Dry-run by default; nothing is written without `--commit`.
 *  - NEVER overwrites an existing passwordHash. A capper who already set a
 *    password on the new platform keeps it.
 *  - Skips SUSPENDED/DISABLED accounts.
 *
 *   npx tsx scripts/import-legacy-credentials.ts <credentials.json>
 *   npx tsx scripts/import-legacy-credentials.ts <credentials.json> --commit
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Matches the cost factor used by the app's own signup path.
const BCRYPT_ROUNDS = 10;

type LegacyCredential = { username: string; password: string };

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const fileArg = args.find((a) => !a.startsWith("--"));
  if (!fileArg) {
    console.error("usage: import-legacy-credentials.ts <file.json> [--commit]");
    process.exitCode = 1;
    return;
  }

  const creds: LegacyCredential[] = JSON.parse(
    readFileSync(path.resolve(process.cwd(), fileArg), "utf8"),
  );

  console.log(
    `\n${commit ? "COMMIT" : "DRY RUN"} — ${creds.length} legacy credentials\n`,
  );

  let willSet = 0;
  let alreadyHad = 0;
  let notFound = 0;
  let skipped = 0;
  let verifiedSet = 0;
  const missing: string[] = [];

  for (const { username, password } of creds) {
    if (!username || !password) {
      skipped += 1;
      continue;
    }

    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        emailVerified: true,
        accountStatus: true,
      },
    });

    if (!user) {
      notFound += 1;
      missing.push(username);
      continue;
    }

    if (
      user.accountStatus === "SUSPENDED" ||
      user.accountStatus === "DISABLED"
    ) {
      skipped += 1;
      continue;
    }

    // Never clobber a password the capper set themselves on the new platform.
    if (user.passwordHash) {
      alreadyHad += 1;
      continue;
    }

    willSet += 1;
    const needsVerify = user.emailVerified === null;
    if (needsVerify) verifiedSet += 1;

    if (!commit) continue;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        // These accounts were verified on the legacy platform; without this,
        // pick entry is blocked and every page redirects to /verify.
        ...(needsVerify ? { emailVerified: new Date() } : {}),
      },
    });
  }

  console.log(`  ${commit ? "set" : "would set"} password : ${willSet}`);
  console.log(
    `  ${commit ? "set" : "would set"} emailVerified: ${verifiedSet}`,
  );
  console.log(`  already had a password : ${alreadyHad} (untouched)`);
  console.log(`  no matching account    : ${notFound}`);
  console.log(`  skipped (blank/disabled): ${skipped}`);
  if (missing.length) {
    console.log(`\n  unmatched usernames: ${missing.slice(0, 15).join(", ")}`);
    if (missing.length > 15) console.log(`  …and ${missing.length - 15} more`);
  }
  if (!commit && willSet) console.log("\nRe-run with --commit to apply.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
