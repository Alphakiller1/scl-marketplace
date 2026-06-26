/**
 * Mock data for the Phase 1 design system + Command Center.
 * Lets the UI render premium and complete before live data is wired.
 * NOT for production use — replace with Prisma-backed queries per feature.
 */

export type FormResult = "W" | "L" | "P";
export type PickStatus = "pending" | "live" | "win" | "loss" | "push" | "void";

export type CapperSummary = {
  id: string;
  name: string;
  handle: string;
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
};

export type TodayPick = {
  id: string;
  capper: Pick<CapperSummary, "id" | "name" | "handle" | "verified">;
  capperRecord: { w: number; l: number; p: number };
  sport: string;
  event: string;
  selection: string;
  oddsAmerican: number;
  units: number;
  status: PickStatus;
  postedAt: Date;
  gameTime: string;
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
    postedAt: ago(38),
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
    postedAt: ago(95),
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
    postedAt: ago(220),
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
    postedAt: ago(12),
    gameTime: "9:00 PM ET",
  },
];

export const MOCK_PLATFORM_STATS = {
  bettors: 4900,
  verifiedCappers: 118,
  picksGradedThisWeek: 2840,
};
