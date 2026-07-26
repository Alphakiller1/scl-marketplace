import { PrismaClient, type Outcome, type ProviderType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** American-odds profit for a winning unit stake. */
function payout(units: number, odds: number): number {
  return odds > 0 ? units * (odds / 100) : units * (100 / Math.abs(odds));
}

type Persona = {
  email: string;
  username: string;
  displayName: string;
  verified: boolean;
  providerType: ProviderType;
  headline: string;
  bio: string;
  sports: string[];
  writtenAnalysis: boolean;
  instagram?: string;
  twitter?: string;
  website?: string;
  /** Settled outcomes, oldest → newest. W=win, L=loss, P=push. */
  results: string;
  pending: number;
  sportRotation: string[];
  markets: string[];
  selections: string[];
  oddsPool: number[];
  unitsPool: number[];
};

const PERSONAS: Persona[] = [
  {
    email: "sharpsignals@scl.demo",
    username: "sharpsignals",
    displayName: "Sharp Signals",
    verified: true,
    providerType: "PREMIUM",
    headline: "Data-driven NBA sides, totals & player props.",
    bio: "Full-time handicapper focused on NBA sides, totals, and player props. Every play is modeled, posted before tip-off, and graded — no deleted losses, no fake records.",
    sports: ["NBA", "NCAAB"],
    writtenAnalysis: true,
    instagram: "sharpsignals",
    twitter: "sharpsignals",
    website: "https://sharpsignals.example.com",
    results: "WWLWWLWLWWWLWWLWWWLWWW",
    pending: 2,
    sportRotation: ["NBA", "NBA", "NBA", "NCAAB"],
    markets: ["Spread", "Total", "Player Prop", "Moneyline"],
    selections: [
      "Celtics -4.5",
      "Nuggets/Suns Over 224.5",
      "Jokic Over 27.5 Pts",
      "Knicks -3.5",
      "Tatum Over 5.5 Ast",
    ],
    oddsPool: [-110, -105, -115, 100, -120],
    unitsPool: [2, 1.5, 2, 3, 1],
  },
  {
    email: "bankrollbuilders@scl.demo",
    username: "bankrollbuilders",
    displayName: "Bankroll Builders",
    verified: true,
    providerType: "HYBRID",
    headline: "Long-term MLB grinder. Slow money is real money.",
    bio: "Volume MLB bettor building bankrolls one disciplined unit at a time. Tracked plays across sides, totals, and first-five innings.",
    sports: ["MLB"],
    writtenAnalysis: false,
    twitter: "bankrollbuilders",
    website: "https://bankrollbuilders.example.com",
    results: "WLWWLWLWWLWWLPWLWWLWWLW",
    pending: 1,
    sportRotation: ["MLB"],
    markets: ["Moneyline", "Run Line", "Total", "First 5"],
    selections: [
      "Dodgers ML",
      "Braves -1.5",
      "Yankees/Sox Over 8.5",
      "Astros F5 -0.5",
      "Phillies ML",
    ],
    oddsPool: [120, -130, -110, 105, -115],
    unitsPool: [1, 1, 1.5, 2, 1],
  },
  {
    email: "gridironedge@scl.demo",
    username: "gridironedge",
    displayName: "Gridiron Edge",
    verified: true,
    providerType: "PREMIUM",
    headline: "NFL sides & totals with a documented edge.",
    bio: "Former DFS grinder turned NFL handicapper. Specializing in number-shopping, key-number value, and situational spots most books are slow to adjust.",
    sports: ["NFL", "NCAAF"],
    writtenAnalysis: true,
    twitter: "gridironedge",
    instagram: "gridironedge",
    results: "WLWWWLWLWWLWWLWWW",
    pending: 1,
    sportRotation: ["NFL", "NFL", "NCAAF"],
    markets: ["Spread", "Total", "Team Total", "Moneyline"],
    selections: [
      "Chiefs/Bills Over 48.5",
      "49ers -6.5",
      "Ravens -3",
      "Georgia -14.5",
      "Lions Team Over 27.5",
    ],
    oddsPool: [-110, -105, 100, -115],
    unitsPool: [3, 2, 2, 1.5],
  },
  {
    email: "pucklinepros@scl.demo",
    username: "pucklinepros",
    displayName: "Puck Line Pros",
    verified: false,
    providerType: "FREE",
    headline: "NHL puck lines and live-dog value.",
    bio: "Hockey-only capper hunting puck-line value and live underdogs. Verification in progress — record imported from a prior platform.",
    sports: ["NHL"],
    writtenAnalysis: false,
    twitter: "pucklinepros",
    results: "WLWLWWLWPLWWWLWL",
    pending: 1,
    sportRotation: ["NHL"],
    markets: ["Puck Line", "Moneyline", "Total"],
    selections: [
      "Oilers -1.5",
      "Bruins ML",
      "Rangers/Devils Under 6.5",
      "Avalanche -1.5",
      "Panthers ML",
    ],
    oddsPool: [150, -120, -110, 135],
    unitsPool: [1, 1, 1.5, 1],
  },
  {
    email: "courtvision@scl.demo",
    username: "courtvision",
    displayName: "Court Vision",
    verified: true,
    providerType: "HYBRID",
    headline: "College hoops mismatches before the market moves.",
    bio: "College basketball specialist focused on conference play, pace mismatches, and early-week line value across the full Division I board.",
    sports: ["NCAAB", "NBA"],
    writtenAnalysis: true,
    instagram: "courtvision",
    website: "https://courtvision.example.com",
    results: "LWWLWPWLWWLWWW",
    pending: 1,
    sportRotation: ["NCAAB", "NCAAB", "NBA"],
    markets: ["Spread", "Total", "Moneyline"],
    selections: [
      "UNC +6.5",
      "Duke/Kansas Under 145.5",
      "Gonzaga -8",
      "Houston -5",
      "Purdue ML",
    ],
    oddsPool: [-110, -105, 100, -108],
    unitsPool: [2, 1.5, 2, 1],
  },
];

const OUTCOME_BY_CHAR: Record<string, Outcome> = {
  W: "WIN",
  L: "LOSS",
  P: "PUSH",
};

function buildPlays(capperId: string, p: Persona) {
  const now = Date.now();
  const total = p.results.length;
  const plays = [...p.results].map((ch, i) => {
    const outcome = OUTCOME_BY_CHAR[ch];
    const odds = p.oddsPool[i % p.oddsPool.length];
    const units = p.unitsPool[i % p.unitsPool.length];
    const daysAgo = total - i; // oldest first, newest most recent
    const profitUnits =
      outcome === "WIN"
        ? round2(payout(units, odds))
        : outcome === "LOSS"
          ? -units
          : 0;
    return {
      capperId,
      sport: p.sportRotation[i % p.sportRotation.length],
      market: p.markets[i % p.markets.length],
      selection: p.selections[i % p.selections.length],
      oddsAmerican: odds,
      units,
      outcome,
      profitUnits,
      gradedAt: new Date(now - daysAgo * DAY),
      createdAt: new Date(now - daysAgo * DAY - 6 * 60 * 60 * 1000),
    };
  });

  for (let j = 0; j < p.pending; j++) {
    const odds = p.oddsPool[j % p.oddsPool.length];
    const units = p.unitsPool[j % p.unitsPool.length];
    plays.push({
      capperId,
      sport: p.sportRotation[j % p.sportRotation.length],
      market: p.markets[j % p.markets.length],
      selection: p.selections[(j + 2) % p.selections.length],
      oddsAmerican: odds,
      units,
      outcome: "PENDING",
      profitUnits: 0,
      gradedAt: new Date(now), // unused for pending
      createdAt: new Date(now - j * 60 * 60 * 1000),
    });
  }

  // Pending plays carry no profit/graded timestamp in the real schema.
  return plays.map((pl) =>
    pl.outcome === "PENDING"
      ? { ...pl, profitUnits: null, gradedAt: null }
      : pl,
  );
}

async function seedPersona(passwordHash: string, p: Persona) {
  const profileData = {
    headline: p.headline,
    bio: p.bio,
    sports: p.sports,
    providerType: p.providerType,
    writtenAnalysis: p.writtenAnalysis,
    instagram: p.instagram,
    twitter: p.twitter,
    website: p.website,
  };

  const user = await prisma.user.upsert({
    where: { email: p.email },
    update: {
      emailVerified: p.verified ? new Date() : null,
      capperProfile: {
        upsert: { create: profileData, update: profileData },
      },
    },
    create: {
      email: p.email,
      username: p.username,
      displayName: p.displayName,
      role: "CAPPER",
      emailVerified: p.verified ? new Date() : null,
      passwordHash,
      capperProfile: { create: profileData },
    },
    include: { capperProfile: true },
  });

  if (!user.capperProfile) return;
  const existing = await prisma.play.count({
    where: { capperId: user.capperProfile.id },
  });
  if (existing === 0) {
    await prisma.play.createMany({
      data: buildPlays(user.capperProfile.id, p),
    });
  }
}

async function main() {
  const target = process.env.SCL_SEED_TARGET?.trim().toLowerCase();
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    target === "production"
  ) {
    throw new Error(
      "The demo seed is disabled for production databases. Provision an existing owner account instead.",
    );
  }

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

  // Rich demo cappers for a full-looking local/preview leaderboard.
  // These are clearly-demo accounts (@scl.demo) — do not run against production.
  for (const persona of PERSONAS) {
    await seedPersona(capperPassword, persona);
  }

  console.log("Seeded:");
  console.log("  admin@scl.local  / admin1234  (ADMIN)");
  console.log("  capper@scl.local / capper1234 (CAPPER)");
  console.log(`  + ${PERSONAS.length} demo cappers (@scl.demo / capper1234)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
