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
    name: "Efficient 80K",
    description:
      "Broad coverage near 81K with deliberate refreshes and about 19K left in the provider allocation.",
    monthlyCeiling: 80_972,
    minimumBalance: 19_028,
    dailyCreditLimit: 2_700,
    weeklyCreditLimit: 18_500,
    monthlyCreditLimit: 100_000,
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
  makePreset({
    id: "balanced",
    name: "Demand-balanced 88K",
    description:
      "Recommended: spend more on college football, soccer, and hockey freshness while retaining about 12K.",
    monthlyCeiling: 88_040,
    minimumBalance: 11_960,
    dailyCreditLimit: 2_900,
    weeklyCreditLimit: 20_500,
    monthlyCreditLimit: 100_000,
    verificationDailyCreditLimit: 550,
    verificationDailyRequestLimit: 450,
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
        expandedCadenceMinutes: 240,
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
        surfaceCadenceMinutes: 120,
        expandedCadenceMinutes: 1440,
        maxEventsPerRun: 1,
      },
      SOCCER: {
        surfaceCadenceMinutes: 240,
        expandedCadenceMinutes: 240,
        maxEventsPerRun: 30,
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
    name: "Maximum coverage 95K",
    description:
      "Highest safe coverage: roughly 94.7K modeled usage while preserving the required 5K reserve.",
    monthlyCeiling: 94_736,
    minimumBalance: 5_264,
    dailyCreditLimit: 3_100,
    weeklyCreditLimit: 21_500,
    monthlyCreditLimit: 100_000,
    verificationDailyCreditLimit: 640,
    verificationDailyRequestLimit: 500,
    verificationCacheMinutes: 30,
    soccerLeagueCount: 8,
    coverage: {
      NFL: {
        surfaceCadenceMinutes: 60,
        expandedCadenceMinutes: 360,
        maxEventsPerRun: 16,
      },
      NCAAF: {
        surfaceCadenceMinutes: 120,
        expandedCadenceMinutes: 240,
        maxEventsPerRun: 25,
      },
      NBA: {
        surfaceCadenceMinutes: 120,
        expandedCadenceMinutes: 360,
        maxEventsPerRun: 14,
      },
      NCAAB: {
        surfaceCadenceMinutes: 120,
        expandedCadenceMinutes: 720,
        maxEventsPerRun: 25,
      },
      NHL: {
        surfaceCadenceMinutes: 120,
        expandedCadenceMinutes: 1440,
        maxEventsPerRun: 1,
      },
      SOCCER: {
        surfaceCadenceMinutes: 240,
        expandedCadenceMinutes: 240,
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
