import {
  ODDS_CONTROL_SPORTS,
  type OddsControlSport,
  type OddsStrategyForecastInput,
} from "@/lib/odds-control";

export type OddsControlPresetId = "safety" | "balanced" | "coverage";

type ForecastSport = OddsStrategyForecastInput["sports"][number];
type SportPreset = Omit<
  ForecastSport,
  "surfaceMarkets" | "expandedMarkets" | "leagues"
> & {
  surfaceMarkets: string[];
  expandedMarkets: string[];
  leagues: string[];
};

export type OddsControlPreset = {
  id: OddsControlPresetId;
  name: string;
  description: string;
  monthlyCeiling: number;
  minimumBalance: number;
  config: Omit<OddsStrategyForecastInput, "sports"> & {
    managedSchedulingEnabled: boolean;
    paused: boolean;
    warningPercent: number;
    verificationDailyRequestLimit: number;
    verificationMaxCreditsPerRequest: number;
    verificationCacheMinutes: number;
    timezone: "America/New_York";
  };
  sports: SportPreset[];
};

const STANDARD = ["h2h", "spreads", "totals"];
const TENNIS_STANDARD = ["spreads", "totals"];
const ALTERNATES = ["alternate_spreads", "alternate_totals"];
const NFL_PROPS = [
  "player_pass_yds",
  "player_pass_yds_alternate",
  "player_rush_yds",
  "player_rush_yds_alternate",
  "player_receptions",
  "player_receptions_alternate",
  "player_reception_yds",
  "player_reception_yds_alternate",
];
const NBA_PROPS = [
  "player_points",
  "player_points_alternate",
  "player_rebounds",
  "player_rebounds_alternate",
  "player_assists",
  "player_assists_alternate",
  "player_threes",
  "player_threes_alternate",
];
const SOCCER_LEAGUES = [
  "EPL",
  "LA_LIGA",
  "SERIE_A",
  "BUNDESLIGA",
  "LIGUE_1",
  "MLS",
  "UCL",
  "EUROPA",
];

type Coverage = {
  surfaceCadenceMinutes: number;
  expandedCadenceMinutes: number;
  maxEventsPerRun: number;
};

type PresetCoverage = Record<
  "NFL" | "NCAAF" | "NBA" | "NCAAB" | "NHL" | "SOCCER" | "TENNIS",
  Coverage
>;

function sportPreset(
  sport: OddsControlSport,
  coverage: PresetCoverage,
  soccerLeagueCount: number,
): SportPreset {
  const active = sport in coverage;
  const row = active
    ? coverage[sport as keyof PresetCoverage]
    : {
        surfaceCadenceMinutes: 1440,
        expandedCadenceMinutes: 1440,
        maxEventsPerRun: 1,
      };
  const expandedMarkets =
    sport === "NFL"
      ? [...ALTERNATES, ...NFL_PROPS]
      : sport === "NBA"
        ? [...ALTERNATES, ...NBA_PROPS]
        : ["NCAAF", "NCAAB"].includes(sport)
          ? ALTERNATES
          : sport === "SOCCER"
            ? ["double_chance"]
            : [];

  return {
    sport,
    enabled: active,
    surfaceEnabled: active,
    expandedEnabled: active && expandedMarkets.length > 0,
    surfaceMarkets: sport === "TENNIS" ? TENNIS_STANDARD : STANDARD,
    expandedMarkets,
    leagues:
      sport === "SOCCER" ? SOCCER_LEAGUES.slice(0, soccerLeagueCount) : [],
    ...row,
  };
}

function makePreset(input: {
  id: OddsControlPresetId;
  name: string;
  description: string;
  monthlyCeiling: number;
  minimumBalance: number;
  dailyCreditLimit: number;
  weeklyCreditLimit: number;
  monthlyCreditLimit: number;
  verificationDailyCreditLimit: number;
  verificationDailyRequestLimit: number;
  verificationCacheMinutes: number;
  soccerLeagueCount: number;
  coverage: PresetCoverage;
}): OddsControlPreset {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    monthlyCeiling: input.monthlyCeiling,
    minimumBalance: input.minimumBalance,
    config: {
      managedSchedulingEnabled: false,
      paused: false,
      dailyCreditLimit: input.dailyCreditLimit,
      weeklyCreditLimit: input.weeklyCreditLimit,
      monthlyCreditLimit: input.monthlyCreditLimit,
      perRunCreditLimit: 250,
      reserveCredits: 5_000,
      warningPercent: 80,
      verificationEnabled: true,
      verificationDailyRequestLimit: input.verificationDailyRequestLimit,
      verificationDailyCreditLimit: input.verificationDailyCreditLimit,
      verificationMaxCreditsPerRequest: 12,
      verificationCacheMinutes: input.verificationCacheMinutes,
      timezone: "America/New_York",
    },
    sports: ODDS_CONTROL_SPORTS.map((sport) =>
      sportPreset(sport, input.coverage, input.soccerLeagueCount),
    ),
  };
}

export const ODDS_CONTROL_PRESETS: readonly OddsControlPreset[] = [
  makePreset({
    id: "safety",
    name: "Safety-first",
    description: "Daily deep-board refreshes with the largest unused balance.",
    monthlyCeiling: 32_652,
    minimumBalance: 67_348,
    dailyCreditLimit: 1_400,
    weeklyCreditLimit: 9_000,
    monthlyCreditLimit: 40_000,
    verificationDailyCreditLimit: 300,
    verificationDailyRequestLimit: 150,
    verificationCacheMinutes: 60,
    soccerLeagueCount: 6,
    coverage: {
      NFL: {
        surfaceCadenceMinutes: 240,
        expandedCadenceMinutes: 1440,
        maxEventsPerRun: 16,
      },
      NCAAF: {
        surfaceCadenceMinutes: 240,
        expandedCadenceMinutes: 1440,
        maxEventsPerRun: 20,
      },
      NBA: {
        surfaceCadenceMinutes: 360,
        expandedCadenceMinutes: 1440,
        maxEventsPerRun: 10,
      },
      NCAAB: {
        surfaceCadenceMinutes: 360,
        expandedCadenceMinutes: 1440,
        maxEventsPerRun: 20,
      },
      NHL: {
        surfaceCadenceMinutes: 360,
        expandedCadenceMinutes: 1440,
        maxEventsPerRun: 1,
      },
      SOCCER: {
        surfaceCadenceMinutes: 360,
        expandedCadenceMinutes: 1440,
        maxEventsPerRun: 20,
      },
      TENNIS: {
        surfaceCadenceMinutes: 360,
        expandedCadenceMinutes: 1440,
        maxEventsPerRun: 1,
      },
    },
  }),
  makePreset({
    id: "balanced",
    name: "Balanced",
    description:
      "Recommended repricing cadence with substantial monthly headroom.",
    monthlyCeiling: 72_456,
    minimumBalance: 27_544,
    dailyCreditLimit: 2_700,
    weeklyCreditLimit: 18_000,
    monthlyCreditLimit: 80_000,
    verificationDailyCreditLimit: 400,
    verificationDailyRequestLimit: 250,
    verificationCacheMinutes: 45,
    soccerLeagueCount: 6,
    coverage: {
      NFL: {
        surfaceCadenceMinutes: 120,
        expandedCadenceMinutes: 360,
        maxEventsPerRun: 16,
      },
      NCAAF: {
        surfaceCadenceMinutes: 120,
        expandedCadenceMinutes: 720,
        maxEventsPerRun: 20,
      },
      NBA: {
        surfaceCadenceMinutes: 240,
        expandedCadenceMinutes: 360,
        maxEventsPerRun: 12,
      },
      NCAAB: {
        surfaceCadenceMinutes: 240,
        expandedCadenceMinutes: 720,
        maxEventsPerRun: 20,
      },
      NHL: {
        surfaceCadenceMinutes: 240,
        expandedCadenceMinutes: 1440,
        maxEventsPerRun: 1,
      },
      SOCCER: {
        surfaceCadenceMinutes: 240,
        expandedCadenceMinutes: 720,
        maxEventsPerRun: 24,
      },
      TENNIS: {
        surfaceCadenceMinutes: 240,
        expandedCadenceMinutes: 1440,
        maxEventsPerRun: 1,
      },
    },
  }),
  makePreset({
    id: "coverage",
    name: "High-coverage",
    description:
      "Faster expanded refreshes and more events with tighter monitoring.",
    monthlyCeiling: 85_972,
    minimumBalance: 14_028,
    dailyCreditLimit: 2_800,
    weeklyCreditLimit: 19_500,
    monthlyCreditLimit: 90_000,
    verificationDailyCreditLimit: 500,
    verificationDailyRequestLimit: 400,
    verificationCacheMinutes: 30,
    soccerLeagueCount: 8,
    coverage: {
      NFL: {
        surfaceCadenceMinutes: 120,
        expandedCadenceMinutes: 360,
        maxEventsPerRun: 16,
      },
      NCAAF: {
        surfaceCadenceMinutes: 120,
        expandedCadenceMinutes: 360,
        maxEventsPerRun: 25,
      },
      NBA: {
        surfaceCadenceMinutes: 240,
        expandedCadenceMinutes: 360,
        maxEventsPerRun: 14,
      },
      NCAAB: {
        surfaceCadenceMinutes: 240,
        expandedCadenceMinutes: 720,
        maxEventsPerRun: 25,
      },
      NHL: {
        surfaceCadenceMinutes: 240,
        expandedCadenceMinutes: 1440,
        maxEventsPerRun: 1,
      },
      SOCCER: {
        surfaceCadenceMinutes: 240,
        expandedCadenceMinutes: 360,
        maxEventsPerRun: 30,
      },
      TENNIS: {
        surfaceCadenceMinutes: 240,
        expandedCadenceMinutes: 1440,
        maxEventsPerRun: 1,
      },
    },
  }),
] as const;

export function oddsControlPreset(id: OddsControlPresetId): OddsControlPreset {
  return ODDS_CONTROL_PRESETS.find((preset) => preset.id === id)!;
}
