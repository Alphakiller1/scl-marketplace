/**
 * Diagnose why a capper cannot upload profile media.
 *
 *   npx tsx scripts/diagnose-profile-upload.ts kennykash
 *   npx tsx scripts/diagnose-profile-upload.ts wisegentlemensports@gmail.com
 */
import process from "node:process";

import { PrismaClient } from "@prisma/client";

import { emailVerificationEnforced } from "../src/lib/email-verification-policy";
import { getCurrentPolicyBundle } from "../src/lib/queries/policies";
import { probeProfileMediaStorage } from "../src/lib/supabase-storage";

try {
  process.loadEnvFile();
} catch {
  // No .env — fall back to ambient environment variables.
}

const prisma = new PrismaClient();

async function main() {
  const raw = process.argv[2]?.trim();
  if (!raw) {
    console.error(
      "usage: diagnose-profile-upload.ts <username-or-email>\n" +
        "example: diagnose-profile-upload.ts kennykash",
    );
    process.exitCode = 1;
    return;
  }

  const handle = raw.replace(/^@+/, "").toLowerCase();
  const isEmail = raw.includes("@");

  const policyBundle = await getCurrentPolicyBundle();
  const account = await prisma.user.findFirst({
    where: isEmail
      ? { email: raw.toLowerCase() }
      : { username: { equals: handle, mode: "insensitive" } },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      accountStatus: true,
      emailVerified: true,
      capperProfile: {
        select: {
          id: true,
          avatarUrl: true,
          bannerUrl: true,
        },
      },
      termsAcceptances: {
        where: { policyVersion: policyBundle.id },
        select: { acceptedAt: true, policyVersion: true },
        orderBy: { acceptedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!account) {
    console.log(`No account found for ${raw}`);
    return;
  }

  const storage = await probeProfileMediaStorage();
  const verificationEnforced = emailVerificationEnforced();
  const termsAccepted = account.termsAcceptances[0] ?? null;
  const blockers: string[] = [];

  if (account.accountStatus !== "ACTIVE") {
    blockers.push(
      `account status is ${account.accountStatus} (must be ACTIVE)`,
    );
  }
  if (verificationEnforced && !account.emailVerified) {
    blockers.push("email is not verified");
  }
  if (!termsAccepted) {
    blockers.push(`current policy bundle ${policyBundle.id} not accepted`);
  }
  if (!account.capperProfile) {
    blockers.push("no CapperProfile row (upload now upserts one on save)");
  }
  if (!storage.configured) {
    blockers.push("Supabase storage env vars are missing");
  } else if (!storage.bucketReady) {
    blockers.push(`Supabase bucket ${storage.bucket} is not ready`);
  }

  console.log(
    `\nProfile upload diagnosis for @${account.username ?? "(no handle)"}\n`,
  );
  console.log(`  id               : ${account.id}`);
  console.log(`  email            : ${account.email}`);
  console.log(`  role             : ${account.role}`);
  console.log(`  account status   : ${account.accountStatus}`);
  console.log(
    `  email verified   : ${account.emailVerified ? account.emailVerified.toISOString() : "no"}`,
  );
  console.log(
    `  verify enforced  : ${verificationEnforced ? "yes" : "no (gate off, uploads allowed unverified)"}`,
  );
  console.log(
    `  terms accepted   : ${termsAccepted ? `${termsAccepted.policyVersion} @ ${termsAccepted.acceptedAt.toISOString()}` : "no"}`,
  );
  console.log(`  capper profile   : ${account.capperProfile?.id ?? "missing"}`);
  console.log(
    `  avatar url       : ${account.capperProfile?.avatarUrl ?? "(none)"}`,
  );
  console.log(
    `  banner url       : ${account.capperProfile?.bannerUrl ?? "(none)"}`,
  );
  console.log(
    `  storage          : configured=${storage.configured} bucketReady=${storage.bucketReady} bucket=${storage.bucket}`,
  );

  if (blockers.length === 0) {
    console.log(
      "\n  upload blockers  : none detected in account/storage state",
    );
    console.log(
      "  likely causes    : file over 5 MB, unsupported format (GIF), or client/network error",
    );
    console.log(
      "  ask capper       : exact toast/error text, device/browser, original photo size/format",
    );
  } else {
    console.log("\n  upload blockers  :");
    for (const blocker of blockers) {
      console.log(`    - ${blocker}`);
    }
  }
  console.log();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
