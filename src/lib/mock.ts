/**
 * Mock data for the Phase 1 design system + Command Center.
 * Lets the UI render premium and complete before live data is wired.
 * NOT for production use — replace with Prisma-backed queries per feature.
 */

import type { VerificationTier } from "@/lib/verification";

export type FormResult = "W" | "L" | "P";
export type PickStatus = "pending" | "live" | "win" | "loss" | "push" | "void";

export type StorefrontSummary = {
  title: string;
  description: string;
  enabled: boolean;
  customized: boolean;
};

export type CapperSummary = {
  id: string;
  name: string;
  handle: string;
  /** Raw display name from the user profile; null when unset (name may fall back to handle). */
  displayName?: string | null;
  avatarUrl?: string;
  verified: boolean;
  topSport: string;
  rank: number;
  rankDelta: number; // +up / -down / 0
  record: { w: number; l: number; p: number };
  winPct: number;
  units: number;
  roi: number;
  streak: number; // + win streak, - loss streak
  recentForm: FormResult[]; // most recent last
  trophies: string[];
  settledPicks?: number;
  verifiedShare?: number; // 0–100: share of tracked picks that are market-verified
  stakedUnits?: number;
  performanceTrend?: number[];
  lastPlayAt?: Date;
  // Profile-page fields (optional on the lighter list/leaderboard surfaces).
  headline?: string;
  bio?: string;
  bannerUrl?: string;
  specialties?: string[];
  sports?: string[]; // full coverage list shown on the profile
  joinedAt?: Date;
  socials?: {
    twitter?: string;
    instagram?: string;
    tiktok?: string;
    website?: string;
  };
  storefront?: StorefrontSummary;
  isLegacy?: boolean; // record imported from the previous SCL platform
};

export type TodayPick = {
  id: string;
  capper: Pick<
    CapperSummary,
    "id" | "name" | "handle" | "displayName" | "verified" | "avatarUrl"
  >;
  capperRecord: { w: number; l: number; p: number };
  /**
   * Leaderboard partition place (`0` = Building a record). When set, public
   * feed cards use the same unranked badge as the leaderboard.
   */
  capperRank?: number;
  /** Graded-sample count for the same min-sample gate as the leaderboard. */
  capperSettledPicks?: number;
  sport: string;
  event: string;
  selection: string;
  oddsAmerican: number;
  units: number;
  status: PickStatus;
  postedAt: Date;
  gameTime: string;
  verificationTier?: VerificationTier;
  /** Board-structured side (team / Over / Under) — safe team identity only. */
  side?: string | null;
  market?: string;
  profitUnits?: number | null;
};

const ago = (mins: number) => new Date(Date.now() - mins * 60_000);

export const MOCK_CAPPERS: CapperSummary[] = [
  {
    id: "c1",
    name: "Sharp Signals",
    handle: "sharpsignals",
    verified: true,
    topSport: "NBA",
    rank: 1,
    rankDelta: 2,
    record: { w: 142, l: 98, p: 7 },
    winPct: 59.2,
    units: 84.3,
    roi: 14.8,
    streak: 6,
    recentForm: ["W", "W", "L", "W", "W", "W"],
    trophies: ["Top ROI", "Hot Streak"],
    headline: "Data-driven NBA sides, totals & player props.",
    bio: "Full-time handicapper focused on NBA sides, totals, and player props. Every play is modeled, posted before tip-off, and graded — no deleted losses, no fake records.",
    sports: ["NBA", "NCAAB"],
    joinedAt: new Date("2023-02-14"),
    socials: {
      twitter: "sharpsignals",
      instagram: "sharpsignals",
      website: "https://sharpsignals.example.com",
    },
  },
  {
    id: "c2",
    name: "Bankroll Builders",
    handle: "bankrollbuilders",
    verified: true,
    topSport: "MLB",
    rank: 2,
    rankDelta: 0,
    record: { w: 211, l: 178, p: 12 },
    winPct: 54.2,
    units: 71.6,
    roi: 9.1,
    streak: 3,
    recentForm: ["L", "W", "W", "W", "P", "W"],
    trophies: ["Top Units", "Long-Term Grinder"],
    headline: "Long-term MLB grinder. Slow money is real money.",
    bio: "Volume MLB bettor building bankrolls one disciplined unit at a time. Six seasons of tracked plays across sides, totals, and first-five innings.",
    sports: ["MLB"],
    joinedAt: new Date("2022-04-03"),
    socials: {
      twitter: "bankrollbuilders",
      website: "https://bankrollbuilders.example.com",
    },
  },
  {
    id: "c3",
    name: "Gridiron Edge",
    handle: "gridironedge",
    verified: true,
    topSport: "NFL",
    rank: 3,
    rankDelta: -1,
    record: { w: 64, l: 41, p: 3 },
    winPct: 60.9,
    units: 58.2,
    roi: 18.4,
    streak: -2,
    recentForm: ["W", "W", "W", "L", "L", "W"],
    trophies: ["Sport Specialist"],
    headline: "NFL sides & totals with a documented edge.",
    bio: "Former DFS grinder turned NFL handicapper. Specializing in number-shopping, key-number value, and situational spots most books are slow to adjust.",
    sports: ["NFL", "NCAAF"],
    joinedAt: new Date("2023-08-21"),
    socials: { twitter: "gridironedge", instagram: "gridironedge" },
  },
  {
    id: "c4",
    name: "Puck Line Pros",
    handle: "pucklinepros",
    verified: false,
    topSport: "NHL",
    rank: 4,
    rankDelta: 1,
    record: { w: 88, l: 79, p: 5 },
    winPct: 52.7,
    units: 33.4,
    roi: 6.7,
    streak: 4,
    recentForm: ["W", "P", "W", "W", "W", "L"],
    trophies: ["Underdog Hunter"],
    headline: "NHL puck lines and live-dog value.",
    bio: "Hockey-only capper hunting puck-line value and live underdogs. Verification in progress — record imported from a prior platform.",
    sports: ["NHL"],
    joinedAt: new Date("2024-01-09"),
    socials: { twitter: "pucklinepros" },
  },
  {
    id: "c5",
    name: "Court Vision",
    handle: "courtvision",
    verified: true,
    topSport: "NCAAB",
    rank: 5,
    rankDelta: 3,
    record: { w: 51, l: 38, p: 2 },
    winPct: 57.3,
    units: 29.9,
    roi: 11.2,
    streak: 2,
    recentForm: ["L", "W", "W", "P", "W", "W"],
    trophies: ["Best Weekly Capper"],
    headline: "College hoops mismatches before the market moves.",
    bio: "College basketball specialist focused on conference play, pace mismatches, and early-week line value across the full Division I board.",
    sports: ["NCAAB", "NBA"],
    joinedAt: new Date("2023-11-30"),
    socials: {
      instagram: "courtvision",
      website: "https://courtvision.example.com",
    },
  },
];

export const MOCK_TODAY_PICKS: TodayPick[] = [
  {
    id: "p1",
    capper: {
      id: "c1",
      name: "Sharp Signals",
      handle: "sharpsignals",
      verified: true,
    },
    capperRecord: { w: 142, l: 98, p: 7 },
    sport: "NBA",
    event: "Celtics @ Knicks",
    selection: "Knicks -3.5",
    oddsAmerican: -110,
    units: 2,
    status: "live",
    get postedAt() {
      return ago(38);
    },
    gameTime: "7:30 PM ET",
  },
  {
    id: "p2",
    capper: {
      id: "c3",
      name: "Gridiron Edge",
      handle: "gridironedge",
      verified: true,
    },
    capperRecord: { w: 64, l: 41, p: 3 },
    sport: "NFL",
    event: "Chiefs @ Bills",
    selection: "Over 48.5",
    oddsAmerican: -105,
    units: 3,
    status: "pending",
    get postedAt() {
      return ago(95);
    },
    gameTime: "8:20 PM ET",
  },
  {
    id: "p3",
    capper: {
      id: "c2",
      name: "Bankroll Builders",
      handle: "bankrollbuilders",
      verified: true,
    },
    capperRecord: { w: 211, l: 178, p: 12 },
    sport: "MLB",
    event: "Dodgers @ Padres",
    selection: "Dodgers ML",
    oddsAmerican: 135,
    units: 1.5,
    status: "win",
    get postedAt() {
      return ago(220);
    },
    gameTime: "Final",
  },
  {
    id: "p4",
    capper: {
      id: "c5",
      name: "Court Vision",
      handle: "courtvision",
      verified: true,
    },
    capperRecord: { w: 51, l: 38, p: 2 },
    sport: "NCAAB",
    event: "Duke @ UNC",
    selection: "UNC +6.5",
    oddsAmerican: -110,
    units: 2,
    status: "pending",
    get postedAt() {
      return ago(12);
    },
    gameTime: "9:00 PM ET",
  },
];

export const MOCK_PLATFORM_STATS = {
  bettors: 4900,
  verifiedCappers: 118,
  picksGradedThisWeek: 2840,
};

/** Look up a capper by their public handle (the /cappers/[handle] slug). */
export function getCapperByHandle(handle: string): CapperSummary | undefined {
  return MOCK_CAPPERS.find((c) => c.handle === handle);
}

/** A capper's recent picks, newest first. */
export function getCapperPicks(capperId: string): TodayPick[] {
  return MOCK_TODAY_PICKS.filter((p) => p.capper.id === capperId).sort(
    (a, b) => b.postedAt.getTime() - a.postedAt.getTime(),
  );
}
