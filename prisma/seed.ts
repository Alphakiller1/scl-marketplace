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
  const capper = await prisma.user.upsert({
    where: { email: "capper@scl.local" },
    update: {
      capperProfile: {
        upsert: {
          create: {
            headline: "Demo capper for local testing",
            sports: ["NBA", "NFL"],
          },
          update: {},
        },
      },
    },
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
    include: { capperProfile: true },
  });

  // Sample plays for the demo capper (idempotent — only if none exist).
  if (capper.capperProfile) {
    const existing = await prisma.play.count({
      where: { capperId: capper.capperProfile.id },
    });
    if (existing === 0) {
      await prisma.play.createMany({
        data: [
          {
            capperId: capper.capperProfile.id,
            sport: "NBA",
            market: "Spread",
            selection: "Celtics -4.5",
            oddsAmerican: -110,
            units: 2,
            outcome: "WIN",
            profitUnits: 1.82,
            gradedAt: new Date(),
          },
          {
            capperId: capper.capperProfile.id,
            sport: "NFL",
            market: "Total",
            selection: "Chiefs/Bills Over 48.5",
            oddsAmerican: -105,
            units: 1.5,
            outcome: "LOSS",
            profitUnits: -1.5,
            gradedAt: new Date(),
          },
          {
            capperId: capper.capperProfile.id,
            sport: "MLB",
            market: "Moneyline",
            selection: "Dodgers ML",
            oddsAmerican: 135,
            units: 1,
            outcome: "PENDING",
          },
        ],
      });
    }
  }

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
