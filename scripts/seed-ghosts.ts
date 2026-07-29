/**
 * Ghost-capper generator — fills an ISOLATED, non-production database with a
 * realistic, populated marketplace so the states the cold-start UI can't show
 * (full leaderboard, all five Discover lanes, CLV tracker, mature profiles,
 * packages, parlays) can be seen and tested.
 *
 * SAFETY
 *  - Refuses to run against production (see assertNonProd): only localhost or an
 *    explicitly-isolated `schema=scl_staging` (or GHOST_SEED_FORCE=1) is allowed,
 *    and GHOST_SEED=1 must be set so it never runs by accident.
 *  - Ghosts use the clearly-demo `@ghost.scl.demo` domain, are marked `isTest=true`,
 *    and are wiped + rebuilt on each run (idempotent). Populated-state QA must opt
 *    in explicitly; public production queries always exclude them.
 *
 * Run:  GHOST_SEED=1 npm run seed:ghosts     (against a local / staging DATABASE_URL)
 */
import {
  PrismaClient,
  type Outcome,
  type VerificationTier,
  type ProviderType,
  type StoreProvider,
  type BillingPeriod,
} from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  buildAllDiscoverLanes,
  type DiscoverCapperInput,
  type DiscoverPlayRow,
} from "@/lib/discover-lanes";
import { playersForLeague } from "@/lib/player-headshots";
import { WINIBLE_CAPPER_REFERRAL_URL } from "@/lib/store-connection";
import { settleParlay } from "@/lib/grading";
import { computeCapperStats } from "@/lib/stats";
import { computeVerifiedShare } from "@/lib/verification";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const GHOST_DOMAIN = "@ghost.scl.demo";
const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

// ── production guard ─────────────────────────────────────────────────────────
function assertNonProd(force = false) {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.GHOST_SEED !== "1") {
    throw new Error(
      "Refusing to seed: set GHOST_SEED=1 to confirm you are seeding a non-prod database.",
    );
  }
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const isStaging = /schema=scl_staging\b/.test(url);
  const forced = force || process.env.GHOST_SEED_FORCE === "1";
  // The prod database is the Supabase pooler on the `scl` schema.
  const looksProd =
    /pooler\.supabase\.com/.test(url) && /schema=scl\b/.test(url);
  if (looksProd && !forced) {
    throw new Error(
      "Refusing to seed: DATABASE_URL looks like PRODUCTION (supabase pooler + schema=scl). " +
        "Point at localhost or ?schema=scl_staging. (Override only with GHOST_SEED_FORCE=1.)",
    );
  }
  if (!isLocal && !isStaging && !forced) {
    throw new Error(
      "Refusing to seed: DATABASE_URL is neither localhost nor schema=scl_staging. " +
        "Set GHOST_SEED_FORCE=1 only if you are certain this target is isolated from prod.",
    );
  }
}

// ── deterministic PRNG (reproducible ghosts) ─────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260719);
const rand = () => rng();
const randInt = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
const gauss = (mean: number, sd: number) => {
  // Box–Muller
  const u = 1 - rand();
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// ── sport catalog ────────────────────────────────────────────────────────────
type SportKey = "MLB" | "WNBA";
type SportCfg = {
  league: string;
  markets: string[];
  teams: string[];
  totalPts: [number, number]; // total line range
  spread: [number, number]; // abs spread range
};
const SPORTS: Record<SportKey, SportCfg> = {
  MLB: {
    league: "MLB",
    markets: ["Moneyline", "Run Line", "Total", "First 5", "Player Prop"],
    teams: [
      "Dodgers",
      "Braves",
      "Yankees",
      "Astros",
      "Phillies",
      "Orioles",
      "Guardians",
      "Brewers",
      "Padres",
      "Rangers",
    ],
    totalPts: [7, 10.5],
    spread: [1.5, 1.5],
  },
  WNBA: {
    league: "WNBA",
    markets: ["Moneyline", "Spread", "Total", "Player Prop"],
    teams: [
      "Aces",
      "Liberty",
      "Sun",
      "Lynx",
      "Sky",
      "Storm",
      "Mercury",
      "Fever",
      "Wings",
      "Dream",
      "Mystics",
      "Sparks",
    ],
    totalPts: [155, 172],
    spread: [1.5, 12.5],
  },
};
const BOOKS = ["draftkings", "fanduel", "betmgm", "caesars", "espnbet"];

function makeSelection(sport: SportKey): {
  market: string;
  selection: string;
  side: string;
  line: number | null;
} {
  const cfg = SPORTS[sport];
  const market = pick(cfg.markets);
  const team = pick(cfg.teams);
  const opp = pick(cfg.teams.filter((t) => t !== team));
  if (market === "Total" || market === "First 5") {
    const [lo, hi] = cfg.totalPts;
    const line = round2(lo + rand() * (hi - lo));
    const ou = chance(0.5) ? "Over" : "Under";
    return {
      market,
      selection: `${team}/${opp} ${ou} ${line}`,
      side: ou,
      line,
    };
  }
  if (market === "Spread" || market === "Run Line" || market === "Puck Line") {
    const [lo, hi] = cfg.spread;
    const mag = round2(lo + rand() * (hi - lo));
    const sign = chance(0.5) ? "-" : "+";
    return {
      market,
      selection: `${team} ${sign}${mag}`,
      side: team,
      line: Number(`${sign}${mag}`),
    };
  }
  if (market === "Team Total") {
    const line = round2(17.5 + rand() * 14);
    const ou = chance(0.5) ? "Over" : "Under";
    return {
      market,
      selection: `${team} Team ${ou} ${line}`,
      side: `${team} ${ou}`,
      line,
    };
  }
  if (market === "Player Prop") {
    const isMlb = sport === "MLB";
    const players = playersForLeague(isMlb ? "mlb" : "wnba");
    const player = pick(players).name;
    // [stat label, line lo, line hi]
    const props: [string, number, number][] = isMlb
      ? [
          ["Total Bases", 1.5, 2.5],
          ["Hits", 0.5, 1.5],
          ["RBIs", 0.5, 1.5],
          ["Home Runs", 0.5, 0.5],
          ["Runs Scored", 0.5, 1.5],
        ]
      : [
          ["Points", 15.5, 25.5],
          ["Rebounds", 6.5, 11.5],
          ["Assists", 4.5, 8.5],
          ["3-Pointers Made", 1.5, 3.5],
          ["Pts+Reb+Ast", 25.5, 38.5],
        ];
    const [stat, lo, hi] = pick(props);
    const line = round2(lo + rand() * (hi - lo));
    const ou = chance(0.6) ? "Over" : "Under";
    return {
      market,
      selection: `${player} ${ou} ${line} ${stat}`,
      side: ou,
      line,
    };
  }
  return { market, selection: `${team} ML`, side: team, line: null };
}

/** American-odds profit for a winning unit stake. */
function payout(units: number, odds: number): number {
  return odds > 0 ? units * (odds / 100) : units * (100 / Math.abs(odds));
}
function oddsFor(market: string): number {
  if (market === "Moneyline" || market === "First 5")
    return pick([-165, -140, -120, 105, 120, 145, 175, -110]);
  if (market === "Player Prop") return pick([-130, -120, -115, -110, 100, 110]);
  return pick([-115, -112, -110, -108, -105, 100]);
}

// ── roster ───────────────────────────────────────────────────────────────────
type Tier = "elite" | "established" | "developing" | "newly" | "cold";
type Ghost = {
  username: string;
  displayName: string;
  sports: SportKey[];
  tier: Tier;
  graded: number;
  winRate: number;
  verifiedShare: number; // 0..1
  clvBias: number; // mean clv pts (market-beaters positive)
  hasStore: boolean;
  hasParlays: boolean;
  providerType: ProviderType;
  headline: string;
  bio: string;
};

const HEADLINES: Record<Tier, string> = {
  elite: "Documented edge. Every play posted pre-game and graded.",
  established: "Long-term, disciplined units across a tracked record.",
  developing: "Building a verified record one board-checked play at a time.",
  newly: "New here — high board-verified share, growing sample.",
  cold: "Just getting started. Follow the record as it fills in.",
};

const HANDLE_POOL: [string, string, SportKey[]][] = [
  // MLB-leaning
  ["linehawk", "Line Hawk", ["MLB", "WNBA"]],
  ["diamondedge", "Diamond Edge", ["MLB"]],
  ["firstpitchvalue", "First Pitch Value", ["MLB"]],
  ["runlinerick", "Run Line Rick", ["MLB"]],
  ["springtraining", "Spring Training", ["MLB"]],
  ["bigunitbets", "Big Unit Bets", ["MLB"]],
  ["earlybird", "Early Bird", ["MLB"]],
  ["bullpenbrain", "Bullpen Brain", ["MLB"]],
  ["moundmetrics", "Mound Metrics", ["MLB"]],
  ["rbimachine", "RBI Machine", ["MLB"]],
  ["firstfiveframes", "First Five Frames", ["MLB"]],
  ["baseknocks", "Base Knocks", ["MLB"]],
  // WNBA-leaning
  ["hoopathena", "Hoop Athena", ["WNBA"]],
  ["dubnation", "Dub Nation W", ["WNBA"]],
  ["acesangle", "Aces Angle", ["WNBA"]],
  ["libertylines", "Liberty Lines", ["WNBA"]],
  ["backcourtbets", "Backcourt Bets", ["WNBA"]],
  ["paintprops", "Paint Props", ["WNBA"]],
  ["transitiongame", "Transition Game", ["WNBA"]],
  ["leaguewsharp", "League W Sharp", ["WNBA"]],
  ["womenshoopsiq", "Women's Hoops IQ", ["WNBA"]],
  ["downtownthrees", "Downtown Threes", ["WNBA"]],
  // Both
  ["closingline", "Closing Line", ["MLB", "WNBA"]],
  ["sharpwire", "Sharp Wire", ["WNBA", "MLB"]],
  ["totalsguru", "Totals Guru", ["MLB", "WNBA"]],
  ["propshopper", "Prop Shopper", ["WNBA", "MLB"]],
  ["numberhunter", "Number Hunter", ["MLB", "WNBA"]],
  ["thehandle", "The Handle", ["MLB", "WNBA"]],
  ["fadethepublic", "Fade The Public", ["WNBA", "MLB"]],
  ["contrarian", "Contrarian", ["MLB", "WNBA"]],
];

function buildRoster(): Ghost[] {
  // Tier plan tuned to populate every Discover lane + a realistic ranked board.
  const plan: { tier: Tier; count: number }[] = [
    { tier: "elite", count: 6 }, // ≥50 graded, high verified, +CLV → proven / market-beaters / verified-30d
    { tier: "established", count: 6 }, // ≥50 graded, decent verified
    { tier: "newly", count: 7 }, // <50 graded, ≥70% verified → newly-credible
    { tier: "developing", count: 6 }, // mixed, some losers → realistic spread
    { tier: "cold", count: 5 }, // <10 graded → building / unranked
  ];
  const roster: Ghost[] = [];
  let i = 0;
  for (const { tier, count } of plan) {
    for (let n = 0; n < count; n++) {
      const [username, displayName, poolSports] =
        HANDLE_POOL[i % HANDLE_POOL.length];
      const sports: SportKey[] = [...poolSports];
      i++;
      const cfg = ((): Omit<
        Ghost,
        "username" | "displayName" | "sports" | "tier" | "headline" | "bio"
      > => {
        switch (tier) {
          case "elite":
            return {
              graded: randInt(55, 120),
              winRate: 0.54 + rand() * 0.08,
              verifiedShare: 0.8 + rand() * 0.15,
              clvBias: 2.5 + rand() * 3,
              hasStore: true,
              hasParlays: chance(0.5),
              providerType: "PREMIUM",
            };
          case "established":
            return {
              graded: randInt(50, 85),
              winRate: 0.5 + rand() * 0.06,
              verifiedShare: 0.6 + rand() * 0.25,
              clvBias: 0.5 + rand() * 2.5,
              hasStore: chance(0.6),
              hasParlays: chance(0.35),
              providerType: chance(0.5) ? "PREMIUM" : "HYBRID",
            };
          case "newly":
            return {
              graded: randInt(12, 40),
              winRate: 0.49 + rand() * 0.08,
              verifiedShare: 0.72 + rand() * 0.2,
              clvBias: 0.5 + rand() * 2,
              hasStore: chance(0.4),
              hasParlays: chance(0.25),
              providerType: chance(0.5) ? "HYBRID" : "FREE",
            };
          case "developing":
            return {
              graded: randInt(15, 48),
              winRate: 0.42 + rand() * 0.12,
              verifiedShare: 0.4 + rand() * 0.3,
              clvBias: -1 + rand() * 2.5,
              hasStore: chance(0.3),
              hasParlays: chance(0.3),
              providerType: "FREE",
            };
          case "cold":
          default:
            return {
              graded: randInt(2, 8),
              winRate: 0.4 + rand() * 0.25,
              verifiedShare: 0.3 + rand() * 0.5,
              clvBias: -1 + rand() * 2,
              hasStore: false,
              hasParlays: false,
              providerType: "FREE",
            };
        }
      })();
      roster.push({
        username,
        displayName,
        sports,
        tier,
        headline: HEADLINES[tier],
        bio: `${displayName} — ${sports.join("/")} record on SCL. Every play is posted before the game and graded honestly; verified plays were board-checked at submission.`,
        ...cfg,
      });
    }
  }
  return roster;
}

// ── play generation ──────────────────────────────────────────────────────────
type PlayCreate = {
  capperId: string;
  sport: string;
  league: string;
  market: string;
  selection: string;
  side: string;
  line: number | null;
  oddsAmerican: number;
  units: number;
  book: string;
  outcome: Outcome;
  profitUnits: number | null;
  createdAt: Date;
  gradedAt: Date | null;
  eventStartsAt: Date;
  loggedPreGame: boolean;
  oddsVerified: boolean;
  verificationTier: VerificationTier;
  closingOddsAmerican: number | null;
  clvPts: number | null;
  closingCapturedAt: Date | null;
  notes: string | null;
};

function outcomeFrom(winRate: number): Outcome {
  const r = rand();
  if (r < 0.04) return "PUSH";
  return r < 0.04 + winRate * 0.96 ? "WIN" : "LOSS";
}

function buildPlays(
  capperId: string,
  g: Ghost,
): { straights: PlayCreate[]; parlayPool: PlayCreate[] } {
  const now = Date.now();
  // Spread history over a window proportional to sample (established → months).
  const spanDays = Math.min(160, Math.max(14, Math.round(g.graded * 2.4)));
  const straights: PlayCreate[] = [];
  const parlayPool: PlayCreate[] = [];

  const total = g.graded + randInt(0, 3); // a few pending on top of graded
  for (let k = 0; k < total; k++) {
    const isPending = k >= g.graded;
    const sport = pick(g.sports);
    const cfg = SPORTS[sport];
    const { market, selection, side, line } = makeSelection(sport);
    const odds = oddsFor(market);
    const units = round2(
      Math.min(5, Math.max(0.5, gauss(g.tier === "elite" ? 2 : 1.4, 0.7))),
    );
    // newest plays most recent; ensure a chunk lands inside the 30-day window
    const daysAgo = isPending
      ? 0
      : round2((1 - k / Math.max(1, g.graded)) * spanDays);
    const eventStartsAt = new Date(now - daysAgo * DAY);
    const createdAt = new Date(eventStartsAt.getTime() - randInt(2, 30) * HOUR);
    const verified = !isPending && rand() < g.verifiedShare;
    const tier: VerificationTier = verified
      ? chance(0.4)
        ? "AUTO_VERIFIED"
        : "VERIFIED"
      : "SELF_REPORTED";

    let outcome: Outcome = "PENDING";
    let profitUnits: number | null = null;
    let gradedAt: Date | null = null;
    if (!isPending) {
      outcome = outcomeFrom(g.winRate);
      profitUnits =
        outcome === "WIN"
          ? round2(payout(units, odds))
          : outcome === "LOSS"
            ? -units
            : 0;
      gradedAt = new Date(eventStartsAt.getTime() + randInt(2, 5) * HOUR);
    }

    // CLV snapshot only on verified, graded plays (matches the CLV read path).
    let closingOddsAmerican: number | null = null;
    let clvPts: number | null = null;
    let closingCapturedAt: Date | null = null;
    if (verified && !isPending && chance(0.85)) {
      const clv = round4(gauss(g.clvBias, 2.2));
      clvPts = clv;
      // Nudge the closing price to be consistent with CLV sign.
      const drift = Math.round(clv * (odds > 0 ? 3 : -3));
      closingOddsAmerican = odds + drift;
      closingCapturedAt = eventStartsAt;
    }

    const play: PlayCreate = {
      capperId,
      sport,
      league: cfg.league,
      market,
      selection,
      side,
      line,
      oddsAmerican: odds,
      units,
      book: pick(BOOKS),
      outcome,
      profitUnits,
      createdAt,
      gradedAt,
      eventStartsAt,
      loggedPreGame: true,
      oddsVerified: verified,
      verificationTier: tier,
      closingOddsAmerican,
      clvPts,
      closingCapturedAt,
      notes:
        g.providerType !== "FREE" && chance(0.35)
          ? `${side} — model edge; board-checked at ${odds > 0 ? "+" : ""}${odds}.`
          : null,
    };
    // Use a few verified graded plays as parlay legs instead of straight bets.
    if (
      g.hasParlays &&
      verified &&
      !isPending &&
      parlayPool.length < 9 &&
      chance(0.3)
    )
      parlayPool.push(play);
    else straights.push(play);
  }
  // A parlay needs at least two legs; keep a lone candidate as a straight.
  if (parlayPool.length === 1) straights.push(parlayPool.pop()!);
  return { straights, parlayPool };
}

type ParlayCreate = {
  combinedOddsAmerican: number;
  units: number;
  outcome: Outcome;
  profitUnits: number | null;
  createdAt: Date;
  gradedAt: Date | null;
  legs: PlayCreate[];
};

function buildParlays(parlayPool: PlayCreate[]): ParlayCreate[] {
  const parlays: ParlayCreate[] = [];
  let idx = 0;
  while (parlayPool.length - idx >= 2) {
    const remaining = parlayPool.length - idx;
    const legCount = remaining <= 4 ? (remaining === 3 ? 3 : 2) : randInt(2, 3);
    const legs = parlayPool.slice(idx, idx + legCount);
    idx += legCount;
    const combined = legs.reduce(
      (acc, l) =>
        acc *
        (l.oddsAmerican > 0
          ? 1 + l.oddsAmerican / 100
          : 1 + 100 / Math.abs(l.oddsAmerican)),
      1,
    );
    const combinedOddsAmerican =
      combined >= 2
        ? Math.round((combined - 1) * 100)
        : Math.round(-100 / (combined - 1));
    const units = round2(Math.min(5, Math.max(0.5, gauss(1.2, 0.5))));
    const settlement = settleParlay(legs, units);
    const gradedAt = legs.reduce<Date | null>(
      (a, l) => (l.gradedAt && (!a || l.gradedAt > a) ? l.gradedAt : a),
      null,
    );
    const createdAt = legs.reduce(
      (a, l) => (l.createdAt < a ? l.createdAt : a),
      legs[0].createdAt,
    );
    parlays.push({
      combinedOddsAmerican,
      units,
      outcome: settlement.outcome,
      profitUnits: settlement.profitUnits,
      createdAt,
      gradedAt: settlement.outcome === "PENDING" ? null : gradedAt,
      legs,
    });
  }
  return parlays;
}

// ── persistence ──────────────────────────────────────────────────────────────
async function seedGhost(passwordHash: string, g: Ghost) {
  const email = `${g.username}${GHOST_DOMAIN}`;
  const user = await prisma.user.create({
    data: {
      email,
      username: g.username,
      displayName: g.displayName,
      role: "CAPPER",
      accountStatus: "ACTIVE",
      emailVerified: g.tier === "cold" && chance(0.5) ? null : new Date(),
      isTest: true,
      passwordHash,
      capperProfile: {
        create: {
          headline: g.headline,
          bio: g.bio,
          sports: g.sports,
          specialties: g.sports.slice(0, 1),
          books: [pick(BOOKS), pick(BOOKS)],
          providerType: g.providerType,
          writtenAnalysis: g.providerType !== "FREE",
          storefrontEnabled: g.hasStore,
          storefrontTitle: g.hasStore ? `${g.displayName}` : null,
          storefrontDescription: g.hasStore
            ? "Board-tracked packages — inspect the record before you buy."
            : null,
        },
      },
    },
    include: { capperProfile: true },
  });
  const capperId = user.capperProfile!.id;

  const { straights, parlayPool } = buildPlays(capperId, g);
  if (straights.length) {
    await prisma.play.createMany({ data: straights });
  }

  // Parlays: group the selected verified plays into 2–3 leg positions.
  for (const parlay of buildParlays(parlayPool)) {
    await prisma.parlay.create({
      data: {
        capperId,
        combinedOddsAmerican: parlay.combinedOddsAmerican,
        units: parlay.units,
        outcome: parlay.outcome,
        profitUnits: parlay.profitUnits,
        createdAt: parlay.createdAt,
        gradedAt: parlay.gradedAt,
        legs: {
          create: parlay.legs.map((l) => ({
            capperId,
            sport: l.sport,
            league: l.league,
            market: l.market,
            selection: l.selection,
            side: l.side,
            line: l.line,
            oddsAmerican: l.oddsAmerican,
            units: 0, // the parlay carries the stake; legs are components
            book: l.book,
            outcome: l.outcome,
            profitUnits: null, // legs don't carry standalone P/L inside a parlay
            createdAt: l.createdAt,
            gradedAt: l.gradedAt,
            eventStartsAt: l.eventStartsAt,
            loggedPreGame: true,
            oddsVerified: l.oddsVerified,
            verificationTier: l.verificationTier,
          })),
        },
      },
    });
  }

  // Packages via a LIVE store connection.
  if (g.hasStore) {
    // Pin ghosts to WINIBLE: their checkout links land on SCL's Winible referral,
    // so a "Subscribe on Whop" button resolving to winible.com would be a lie.
    const provider: StoreProvider = "WINIBLE";
    const conn = await prisma.storeConnection.create({
      data: {
        capperId,
        provider,
        status: "LIVE",
        packageImportStatus: "LIVE",
        submittedAt: new Date(Date.now() - randInt(20, 90) * DAY),
        acknowledgmentAt: new Date(Date.now() - randInt(5, 19) * DAY),
      },
    });
    const sport = g.sports[0];
    const period: BillingPeriod = pick(["WEEK", "MONTH", "MONTH"]);
    const priceCents = pick([1999, 2999, 3999, 4900, 7900]);
    const pkgs = [
      {
        title: `${sport} Full Card`,
        promo: "First 3 days free",
        priceCents,
        period,
        sort: 0,
      },
      chance(0.55)
        ? {
            title: `${sport} Premium Plays`,
            promo: null,
            priceCents: priceCents + 2000,
            period: "MONTH" as BillingPeriod,
            sort: 1,
          }
        : null,
    ].filter(Boolean) as {
      title: string;
      promo: string | null;
      priceCents: number;
      period: BillingPeriod;
      sort: number;
    }[];
    for (const p of pkgs) {
      const pkg = await prisma.package.create({
        data: {
          capperId,
          storeConnectionId: conn.id,
          title: p.title,
          description: `${sport} plays, posted pre-game and graded on SCL. Delivered via Winible.`,
          promoOffer: p.promo,
          priceCents: p.priceCents,
          billingPeriod: p.period,
          // Demo checkouts land on SCL's real Winible referral page — never a
          // fabricated per-capper storefront that 404s.
          checkoutUrl: WINIBLE_CAPPER_REFERRAL_URL,
          affiliateProvider: provider,
          providerType: g.providerType === "FREE" ? "PREMIUM" : g.providerType,
          sortOrder: p.sort,
          isActive: true,
        },
      });
      // Public marketplace requires a TrackingUrl slug (/go/[slug]) — without it
      // listActiveMarketplacePackages filters the package out.
      const slugBase = `${g.username}-${p.title}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48);
      await prisma.trackingUrl.create({
        data: {
          packageId: pkg.id,
          slug: `${slugBase}-${randInt(1000, 9999)}`,
          targetUrl: WINIBLE_CAPPER_REFERRAL_URL,
        },
      });
    }
  }
}

// ── dry run: prove the roster fills every surface, no DB needed ───────────────
const SIGNAL = 10; // MIN_GRADED_FOR_SIGNAL / MATURITY.DEVELOPING
function dryRun() {
  const roster = buildRoster();
  const lanes = {
    proven: 0,
    verified_month: 0,
    specialists: 0,
    newly_credible: 0,
    market_beaters: 0,
  };
  const inputs: DiscoverCapperInput[] = [];
  let ranked = 0,
    building = 0,
    stores = 0,
    parlayCappers = 0,
    totalPlays = 0,
    clvPlays = 0;
  for (const g of roster) {
    const { straights, parlayPool } = buildPlays("dry", g);
    const parlays = buildParlays(parlayPool);
    const plays: DiscoverPlayRow[] = straights.map((p) => ({
      outcome: p.outcome,
      units: p.units,
      profitUnits: p.profitUnits,
      sport: p.sport,
      market: p.market,
      createdAt: p.createdAt,
      gradedAt: p.gradedAt,
      verificationTier: p.verificationTier,
      clvPts: p.clvPts,
    }));
    const stats = computeCapperStats([
      ...plays,
      ...parlays.map((p) => ({
        outcome: p.outcome,
        units: p.units,
        profitUnits: p.profitUnits,
      })),
    ]);
    const clv = plays
      .map((p) => p.clvPts)
      .filter((v): v is number => v != null && Number.isFinite(v));
    totalPlays +=
      straights.length + parlays.reduce((n, p) => n + p.legs.length, 0);
    clvPlays += clv.length;
    inputs.push({
      summary: {
        id: g.username,
        name: g.username,
        handle: g.username,
        verified: true,
        topSport: g.sports[0],
        rank: 0,
        rankDelta: 0,
        record: { w: stats.wins, l: stats.losses, p: stats.pushes },
        winPct: stats.winPct,
        units: stats.units,
        roi: stats.roi,
        streak: 0,
        recentForm: [],
        trophies: [],
        settledPicks: stats.settled,
        verifiedShare: computeVerifiedShare(
          plays.map((p) => p.verificationTier),
        ),
        avgClv: clv.length
          ? clv.reduce((total, value) => total + value, 0) / clv.length
          : null,
      },
      plays,
    });

    if (stats.settled >= SIGNAL) ranked++;
    else building++;
    if (g.hasStore) stores++;
    if (parlays.length) parlayCappers++;
  }
  for (const lane of buildAllDiscoverLanes(inputs)) {
    lanes[lane.id] = lane.entries.length;
  }
  console.log(
    `DRY RUN — ${roster.length} ghost cappers, ${totalPlays} plays\n`,
  );
  console.log(
    `  Leaderboard:  ${ranked} ranked (≥${SIGNAL} graded) · ${building} building`,
  );
  console.log(`  Packages:     ${stores} cappers with a live storefront`);
  console.log(`  Parlays:      ${parlayCappers} cappers with parlays`);
  console.log(
    `  CLV plays:    ${clvPlays} verified plays carry closing snapshots\n`,
  );
  console.log(`  Discover lanes (cappers qualifying — each must be ≥1):`);
  console.log(`    Proven over time (≥50 graded):        ${lanes.proven}`);
  console.log(
    `    Best verified ROI 30d (≥10 verified): ${lanes.verified_month}`,
  );
  console.log(`    Consistent specialists (≥50% 1 sport):${lanes.specialists}`);
  console.log(
    `    Newly credible (<50, ≥70% verified):  ${lanes.newly_credible}`,
  );
  console.log(
    `    Market beaters (favorable CLV):        ${lanes.market_beaters}`,
  );
  const gaps = Object.entries(lanes)
    .filter(([, v]) => v === 0)
    .map(([k]) => k);
  console.log(
    gaps.length
      ? `\n  ⚠ EMPTY LANES: ${gaps.join(", ")}`
      : `\n  ✓ every lane qualifies`,
  );
}

export type GhostSeedResult = {
  wiped: number;
  seeded: number;
  usernames: string[];
  remaining: number;
  total: number;
  done: boolean;
};

/**
 * Wipe and/or seed ghost cappers. Supports chunked runs for serverless timeouts.
 * Set GHOST_SEED=1 (and GHOST_SEED_FORCE=1 for production) before calling.
 */
export async function runGhostSeed(opts?: {
  force?: boolean;
  /** When true, only wipe prior ghosts. */
  wipeOnly?: boolean;
  /** Skip wipe (for subsequent chunks). */
  skipWipe?: boolean;
  /** Roster offset for chunked seeding. */
  offset?: number;
  /** Max ghosts to seed in this call (default: all remaining). */
  limit?: number;
}): Promise<GhostSeedResult> {
  assertNonProd(opts?.force === true);

  let wiped = 0;
  if (!opts?.skipWipe) {
    const result = await prisma.user.deleteMany({
      where: { email: { endsWith: GHOST_DOMAIN } },
    });
    wiped = result.count;
    if (wiped) console.log(`Cleared ${wiped} prior ghost cappers.`);
  }

  if (opts?.wipeOnly) {
    return {
      wiped,
      seeded: 0,
      usernames: [],
      remaining: 0,
      total: buildRoster().length,
      done: false,
    };
  }

  const passwordHash = await bcrypt.hash("ghost1234", 12);
  const roster = buildRoster();
  const offset = Math.max(0, opts?.offset ?? 0);
  const limit =
    opts?.limit == null
      ? roster.length - offset
      : Math.max(0, Math.min(opts.limit, roster.length - offset));
  const slice = roster.slice(offset, offset + limit);
  const usernames: string[] = [];

  for (const g of slice) {
    await seedGhost(passwordHash, g);
    usernames.push(g.username);
    process.stdout.write(
      `  seeded @${g.username} (${g.tier}, ${g.graded} graded)\n`,
    );
  }

  const nextOffset = offset + slice.length;
  const remaining = Math.max(0, roster.length - nextOffset);
  return {
    wiped,
    seeded: slice.length,
    usernames,
    remaining,
    total: roster.length,
    done: remaining === 0,
  };
}

async function main() {
  if (process.env.GHOST_SEED_DRYRUN === "1") {
    dryRun();
    return;
  }

  const result = await runGhostSeed({
    force: process.env.GHOST_SEED_FORCE === "1",
  });
  const users = await prisma.user.count({
    where: { email: { endsWith: GHOST_DOMAIN } },
  });
  const plays = await prisma.play.count();
  console.log(
    `\nDone. ${users} ghost cappers · ${plays} total plays in this database.` +
      ` (seeded ${result.seeded} this run)`,
  );
  console.log("Login (any ghost): <username>" + GHOST_DOMAIN + " / ghost1234");
}

// Only auto-run when executed as a CLI script (not when imported by the API).
const invokedAsCli = process.argv[1]?.includes("seed-ghosts");
if (invokedAsCli) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
