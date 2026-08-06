/**
 * Inspect every account tied to an inbox for login troubleshooting.
 *
 *   npx tsx scripts/diagnose-login-by-email.ts wisegentlemensports@gmail.com
 */
import process from "node:process";

import { PrismaClient } from "@prisma/client";

import { buildLegacyPlusAddressEmail } from "../src/lib/user-credentials";

try {
  process.loadEnvFile();
} catch {
  // No .env — fall back to ambient environment variables.
}

const prisma = new PrismaClient();

async function main() {
  const raw = process.argv[2]?.trim().toLowerCase();
  if (!raw || !raw.includes("@")) {
    console.error(
      "usage: diagnose-login-by-email.ts <email>\n" +
        "example: diagnose-login-by-email.ts wisegentlemensports@gmail.com",
    );
    process.exitCode = 1;
    return;
  }

  const at = raw.indexOf("@");
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);

  const accounts = await prisma.user.findMany({
    where: {
      OR: [
        { email: raw },
        { email: { startsWith: `${local}+`, endsWith: `@${domain}` } },
      ],
    },
    select: {
      id: true,
      username: true,
      email: true,
      passwordHash: true,
      legacyPasswordHash: true,
      legacyPasswordFormat: true,
      accountStatus: true,
      emailVerified: true,
      capperProfile: { select: { isLegacy: true } },
    },
    orderBy: { username: "asc" },
  });

  if (!accounts.length) {
    console.log(`No accounts found for inbox ${raw}`);
    return;
  }

  console.log(`\n${accounts.length} account(s) for inbox ${raw}\n`);
  for (const account of accounts) {
    const handle = account.username ?? "(no username)";
    const legacyPlus =
      account.email.includes("+") || account.email === raw
        ? null
        : buildLegacyPlusAddressEmail(raw, handle);

    console.log(`@${handle}`);
    console.log(`  id              : ${account.id}`);
    console.log(`  stored email    : ${account.email}`);
    console.log(
      `  legacy profile  : ${account.capperProfile?.isLegacy ?? false}`,
    );
    console.log(`  account status  : ${account.accountStatus}`);
    console.log(
      `  email verified  : ${account.emailVerified ? account.emailVerified.toISOString() : "no"}`,
    );
    console.log(`  scl password    : ${account.passwordHash ? "yes" : "no"}`);
    console.log(
      `  legacy password : ${account.legacyPasswordHash ? (account.legacyPasswordFormat ?? "detect") : "no"}`,
    );
    if (legacyPlus && legacyPlus !== account.email) {
      console.log(`  login fallback  : also matches stored ${legacyPlus}`);
    }
    console.log(
      `  sign in with    : username=@${handle}, email=${raw}, legacy password`,
    );
    console.log();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
