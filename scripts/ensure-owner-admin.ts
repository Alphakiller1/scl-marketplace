import { PrismaClient } from "@prisma/client";

/**
 * Ensure the platform owner can reach /admin/* in production.
 * Safe to re-run: idempotent update by email.
 */
const OWNER_EMAIL = "chase4sichi@gmail.com";

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
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[ensure-owner-admin] failed", error);
  process.exitCode = 1;
});
