import { PrismaClient } from "@prisma/client";

/**
 * Ensure the platform owner can reach /admin/* in production.
 * Also deactivate leftover e2e smoke packages so they never stay live.
 */
const OWNER_EMAIL = "chase4sichi@gmail.com";
const SMOKE_PACKAGE_TITLE = "SCL Smoke E2E Package";

async function main() {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    console.log("[ensure-owner-admin] skip non-production");
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.log("[ensure-owner-admin] skip (no DATABASE_URL)");
    return;
  }

  const prisma = new PrismaClient();
  try {
    const result = await prisma.user.updateMany({
      where: { email: OWNER_EMAIL },
      data: { role: "ADMIN" },
    });
    console.log(`[ensure-owner-admin] ${OWNER_EMAIL}: updated=${result.count}`);

    const smoke = await prisma.package.updateMany({
      where: { title: SMOKE_PACKAGE_TITLE, isActive: true },
      data: { isActive: false },
    });
    console.log(
      `[ensure-owner-admin] smoke packages deactivated=${smoke.count}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[ensure-owner-admin] failed", error);
  process.exitCode = 1;
});
