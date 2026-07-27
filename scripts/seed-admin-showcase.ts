/**
 * Adds idempotent, non-public operational examples to existing ghost cappers.
 *
 * Run against local/staging:
 *   ADMIN_SHOWCASE_SEED=1 npm run seed:admin-showcase
 *
 * Production additionally requires:
 *   ADMIN_SHOWCASE_SEED_FORCE=1
 */
import { prisma } from "@/lib/prisma";
import { seedAdminShowcase } from "@/lib/admin-showcase";

async function main() {
  const result = await seedAdminShowcase({
    allowProduction: process.env.ADMIN_SHOWCASE_SEED_FORCE === "1",
  });
  console.log(
    `Admin showcase ready: ${result.connections} connections, ${result.packages} packages, ${result.clicks} tracked clicks.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
