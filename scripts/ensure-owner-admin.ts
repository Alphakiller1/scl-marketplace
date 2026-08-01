import { PrismaClient } from "@prisma/client";

/**
 * Promote an explicitly supplied, existing platform owner to ADMIN.
 * Also deactivate leftover e2e smoke packages so they never stay live.
 */
const SMOKE_PACKAGE_TITLE = "SCL Smoke E2E Package";

async function main() {
  if (process.env.VERCEL_ENV !== "production") {
    throw new Error("This provisioning script only runs for production.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const ownerEmail = process.env.OWNER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) {
    throw new Error("OWNER_ADMIN_EMAIL is required.");
  }

  const prisma = new PrismaClient();
  try {
    const result = await prisma.user.updateMany({
      where: { email: ownerEmail },
      data: { role: "ADMIN" },
    });
    if (result.count !== 1) {
      throw new Error(
        `Expected one existing owner account for ${ownerEmail}; updated=${result.count}.`,
      );
    }
    console.log(`[ensure-owner-admin] ${ownerEmail}: updated=${result.count}`);

    const smoke = await prisma.package.updateMany({
      where: { title: SMOKE_PACKAGE_TITLE, isActive: true },
      data: { isActive: false },
    });
    console.log(
      `[ensure-owner-admin] smoke packages deactivated=${smoke.count}`,
    );

    // Seed accounts must never be usable in production. `admin@scl.local` was
    // found live and ACTIVE with the seed password `admin1234` still working —
    // a credential published in a public repo. The demo seed refuses to run
    // against production now, but that guard postdates the account, so this
    // sweeps up anything already there and keeps it swept on every deploy.
    //
    // Runs only after the real owner has been promoted above, so it can never
    // leave the platform without an admin.
    const seedAccounts = await prisma.user.updateMany({
      where: {
        email: { endsWith: "@scl.local" },
        accountStatus: { not: "DISABLED" },
        NOT: { email: ownerEmail },
      },
      data: { accountStatus: "DISABLED" },
    });
    console.log(
      `[ensure-owner-admin] seed accounts disabled=${seedAccounts.count}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[ensure-owner-admin] failed", error);
  process.exitCode = 1;
});
