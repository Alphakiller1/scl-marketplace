import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin1234", 12);
  await prisma.user.upsert({
    where: { email: "admin@scl.local" },
    update: { role: "ADMIN" },
    create: {
      email: "admin@scl.local",
      username: "admin",
      displayName: "SCL Admin",
      role: "ADMIN",
      emailVerified: new Date(),
      passwordHash: adminPassword,
    },
  });

  const capperPassword = await bcrypt.hash("capper1234", 12);
  await prisma.user.upsert({
    where: { email: "capper@scl.local" },
    update: {},
    create: {
      email: "capper@scl.local",
      username: "demo_capper",
      displayName: "Demo Capper",
      role: "CAPPER",
      emailVerified: new Date(),
      passwordHash: capperPassword,
      capperProfile: {
        create: {
          headline: "Demo capper for local testing",
          sports: ["NBA", "NFL"],
        },
      },
    },
  });

  console.log("Seeded:");
  console.log("  admin@scl.local  / admin1234  (ADMIN)");
  console.log("  capper@scl.local / capper1234 (CAPPER)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
