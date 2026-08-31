import { expandedBoardMarkets, marketKeysForMarket } from "@/lib/odds-verify";
import type { OddsSelection } from "@/lib/odds-board";
import { SOCCER_LEAGUES } from "@/lib/soccer-leagues";

export const ODDS_CONTROL_SPORTS = [
  "NFL",
  "NBA",
  "NCAAF",
  "NCAAB",
  "MLB",
  "NHL",
  "WNBA",
  "CFL",
  "SOCCER",
  "TENNIS",
  "MMA",
] as const;

export type OddsControlSport = (typeof ODDS_CONTROL_SPORTS)[number];
export type OddsControlTier = "surface" | "expanded";

/**
 * Preserve the paid coverage that exists before owner-managed scheduling is
 * enabled. New sports stay visible in the control plane, but opt in only.
 */
export const LEGACY_SCHEDULED_SPORTS: ReadonlySet<OddsControlSport> = new Set([
  "MLB",
  "WNBA",
  "TENNIS",
  "SOCCER",
  "NFL",
]);

/** Expanded tiers that were already paid before owner presets existed. */
const LEGACY_EXPANDED_SPORTS: ReadonlySet<OddsControlSport> = new Set([
  "MLB",
  "WNBA",
  "TENNIS",
  "SOCCER",
]);

export const SURFACE_MARKETS = [
  { key: "h2h", label: "Moneyline" },
  { key: "spreads", label: "Spreads" },
  { key: "totals", label: "Totals" },
] as const;

export type OddsMarketGroup = {
  id: string;
  label: string;
  description: string;
  markets: string[];
};

function take(markets: readonly string[], predicate: (key: string) => boolean) {
  return markets.filter(predicate);
}

export function expandedMarketGroups(sport: string): OddsMarketGroup[] {
  const markets = expandedBoardMarkets(sport);
  const normalizedSport = sport.trim().toUpperCase();
  const groups: OddsMarketGroup[] = [
    {
      id: "alternate-game-lines",
      label: "Alternate game lines",
      description: "Alternate spreads and totals for the full game.",
      markets:
        normalizedSport === "TENNIS"
          ? []
          : take(markets, (key) =>
              ["alternate_spreads", "alternate_totals"].includes(key),
            ),
    },
    {
      id: "team-totals",
      label: "Team totals",
      description: "Featured and alternate team-total ladders.",
      markets: take(markets, (key) => key.includes("team_totals")),
    },
    {
      id: "period-lines",
      label: "Period and half lines",
      description: "First innings, first half, and other supported segments.",
      markets: take(
        markets,
        (key) =>
          /_(1st|3rd|5th|7th)_innings$/.test(key) ||
          /_(1st|2nd)_half$/.test(key),
      ),
    },
    {
      id: "pitcher-props",
      label: "Pitcher props",
      description: "Supported pitcher statistics and alternate ladders.",
      markets: take(markets, (key) => key.startsWith("pitcher_")),
    },
    {
      id: "batter-props",
      label: "Batter props",
      description: "Supported hitter statistics and milestone ladders.",
      markets: take(markets, (key) => key.startsWith("batter_")),
    },
    {
      id: "player-props",
      label: "Player props",
      description:
        "Supported football and basketball player markets and alternates.",
      markets: take(markets, (key) => key.startsWith("player_")),
    },
    {
      id: "tennis-game-lines",
      label: "Tennis game lines",
      description: "Featured and alternate full-match game spreads and totals.",
      markets:
        normalizedSport === "TENNIS"
          ? take(markets, (key) =>
              [
                "spreads",
                "totals",
                "alternate_spreads",
                "alternate_totals",
              ].includes(key),
            )
          : [],
    },
    {
      id: "double-chance",
      label: "Double chance",
      description: "Home/draw, away/draw, and home/away soccer combinations.",
      markets: take(markets, (key) => key === "double_chance"),
    },
  ];

  const used = new Set(groups.flatMap((group) => group.markets));
  const other = markets.filter((market) => !used.has(market));
  if (other.length) {
    groups.push({
      id: "other-supported",
      label: "Other supported markets",
      description: "Remaining markets already supported by SCL grading.",
      markets: other,
    });
  }
  return groups.filter((group) => group.markets.length > 0);
}

export function allowedExpandedMarkets(sport: string): string[] {
  return expandedMarketGroups(sport).flatMap((group) => group.markets);
}

export function defaultSportControl(sport: OddsControlSport) {
  const expanded = allowedExpandedMarkets(sport);
  const enabled = LEGACY_SCHEDULED_SPORTS.has(sport);
  return {
    sport,
    enabled,
    surfaceEnabled: enabled,
    expandedEnabled:
      enabled && LEGACY_EXPANDED_SPORTS.has(sport) && expanded.length > 0,
    surfaceMarkets: SURFACE_MARKETS.map((market) => market.key),
    expandedMarkets: expanded,
    leagues: [] as string[],
    surfaceCadenceMinutes: 240,
    expandedCadenceMinutes: 360,
    maxEventsPerRun: sport === "SOCCER" ? 80 : 20,
    nextSurfaceRunAt: null as string | null,
    nextExpandedRunAt: null as string | null,
    lastSurfaceRunAt: null as string | null,
    lastExpandedRunAt: null as string | null,
  };
}

export function isMissingOddsControlStorageError(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2021"
  ) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    /Odds(ControlConfig|SportControl|ApiRun|ControlAuditEvent)/.test(message) &&
    /(does not exist|unknown table|relation .* does not exist)/i.test(message)
  );
}

export const DEFAULT_ODDS_CONTROL_CONFIG = {
  managedSchedulingEnabled: false,
  paused: false,
  dailyCreditLimit: 2_000,
  weeklyCreditLimit: 10_000,
  monthlyCreditLimit: 20_000,
  perRunCreditLimit: 2_000,
  warningPercent: 70,
  reserveCredits: 1_000,
  verificationEnabled: true,
  verificationDailyRequestLimit: 250,
  verificationDailyCreditLimit: 500,
  verificationMaxCreditsPerRequest: 20,
  verificationCacheMinutes: 30,
  timezone: "America/New_York",
} as const;

export const CADENCE_OPTIONS = [
  { minutes: 15, label: "Every 15 minutes" },
  { minutes: 30, label: "Every 30 minutes" },
  { minutes: 60, label: "Hourly" },
  { minutes: 120, label: "Every 2 hours" },
  { minutes: 240, label: "Every 4 hours" },
  { minutes: 360, label: "Every 6 hours" },
  { minutes: 720, label: "Every 12 hours" },
  { minutes: 1440, label: "Daily" },
] as const;

export function estimatedRunCredits(input: {
  sport: string;
  tier: OddsControlTier;
  markets: readonly string[];
  leagues: readonly string[];
  maxEventsPerRun: number;
}): number {
  if (input.tier === "expanded") {
    const catalogCredit = input.markets.length > 8 ? 1 : 0;
    return (input.markets.length + catalogCredit) * input.maxEventsPerRun;
  }
  const competitionCount =
    input.sport === "SOCCER"
      ? input.leagues.length || Math.min(10, SOCCER_LEAGUES.length)
      : input.sport === "TENNIS"
        ? input.leagues.length || 4
        : ["NFL", "NBA"].includes(input.sport) && input.leagues.length === 0
          ? 2
          : 1;
  return input.markets.length * competitionCount;
}

export type OddsStrategyForecastSport = {
  sport: OddsControlSport;
  enabled: boolean;
  surfaceEnabled: boolean;
  expandedEnabled: boolean;
  surfaceMarkets: readonly string[];
  expandedMarkets: readonly string[];
  leagues: readonly string[];
  surfaceCadenceMinutes: number;
  expandedCadenceMinutes: number;
  maxEventsPerRun: number;
};

export type OddsStrategyForecastInput = {
  dailyCreditLimit: number;
  weeklyCreditLimit: number;
  monthlyCreditLimit: number;
  perRunCreditLimit: number;
  reserveCredits: number;
  verificationEnabled: boolean;
  verificationDailyCreditLimit: number;
  sports: readonly OddsStrategyForecastSport[];
};

export type OddsStrategyForecast = {
  boardCreditsPerDay: number;
  verificationCreditsPerDay: number;
  totalCreditsPerDay: number;
  boardCreditsPerMonth: number;
  verificationCreditsPerMonth: number;
  totalCreditsPerMonth: number;
  operatingBudget: number;
  budgetRemaining: number;
  largestRunCredits: number;
  blockingReasons: string[];
};

/**
 * Conservative 31-day ceiling for an owner strategy.
 *
 * It assumes every cadence slot runs and every expanded run reaches its event
 * cap. Actual spend should be lower because fresh/populated boards and empty
 * slates are skipped, but activation safety must not depend on those savings.
 */
export function oddsStrategyForecast(
  input: OddsStrategyForecastInput,
): OddsStrategyForecast {
  let boardCreditsPerDay = 0;
  let largestRunCredits = 0;

  for (const sport of input.sports) {
    if (!sport.enabled) continue;
    for (const tier of ["surface", "expanded"] as const) {
      const enabled =
        tier === "surface" ? sport.surfaceEnabled : sport.expandedEnabled;
      if (!enabled) continue;
      const cadenceMinutes =
        tier === "surface"
          ? sport.surfaceCadenceMinutes
          : sport.expandedCadenceMinutes;
      const runCredits = estimatedRunCredits({
        sport: sport.sport,
        tier,
        markets:
          tier === "surface" ? sport.surfaceMarkets : sport.expandedMarkets,
        leagues: sport.leagues,
        maxEventsPerRun: sport.maxEventsPerRun,
      });
      largestRunCredits = Math.max(largestRunCredits, runCredits);
      boardCreditsPerDay += runCredits * (1440 / cadenceMinutes);
    }
  }

  boardCreditsPerDay = Math.ceil(boardCreditsPerDay);
  const verificationCreditsPerDay = input.verificationEnabled
    ? input.verificationDailyCreditLimit
    : 0;
  const totalCreditsPerDay = boardCreditsPerDay + verificationCreditsPerDay;
  const boardCreditsPerMonth = boardCreditsPerDay * 31;
  const verificationCreditsPerMonth = verificationCreditsPerDay * 31;
  const totalCreditsPerMonth =
    boardCreditsPerMonth + verificationCreditsPerMonth;
  const operatingBudget = Math.max(
    0,
    input.monthlyCreditLimit - input.reserveCredits,
  );
  const blockingReasons: string[] = [];

  if (input.reserveCredits <= 0) {
    blockingReasons.push("Set a protected provider reserve.");
  }
  if (largestRunCredits > input.perRunCreditLimit) {
    blockingReasons.push(
      `Largest run (${largestRunCredits.toLocaleString()}) exceeds the per-run limit.`,
    );
  }
  if (totalCreditsPerDay > input.dailyCreditLimit) {
    blockingReasons.push(
      `Daily maximum (${totalCreditsPerDay.toLocaleString()}) exceeds the daily limit.`,
    );
  }
  const weeklyMaximum = totalCreditsPerDay * 7;
  if (weeklyMaximum > input.weeklyCreditLimit) {
    blockingReasons.push(
      `Weekly maximum (${weeklyMaximum.toLocaleString()}) exceeds the weekly limit.`,
    );
  }
  if (totalCreditsPerMonth > operatingBudget) {
    blockingReasons.push(
      `Monthly maximum (${totalCreditsPerMonth.toLocaleString()}) exceeds the spendable budget after reserve.`,
    );
  }

  return {
    boardCreditsPerDay,
    verificationCreditsPerDay,
    totalCreditsPerDay,
    boardCreditsPerMonth,
    verificationCreditsPerMonth,
    totalCreditsPerMonth,
    operatingBudget,
    budgetRemaining: operatingBudget - totalCreditsPerMonth,
    largestRunCredits,
    blockingReasons,
  };
}

export function creditLimitState(
  used: number,
  limit: number,
  warningPercent: number,
): "ok" | "warning" | "blocked" {
  if (limit <= 0 || used >= limit) return "blocked";
  return used / limit >= warningPercent / 100 ? "warning" : "ok";
}

export const PROVIDER_BALANCE_FRESH_MS = 24 * 60 * 60_000;

export type VerificationPolicy = {
  enabled: boolean;
  dailyRequestLimit: number;
  dailyCreditLimit: number;
  maxCreditsPerRequest: number;
  cacheMinutes: number;
  overallDailyLimit: number;
  overallWeeklyLimit: number;
  overallMonthlyLimit: number;
};

export type VerificationPolicyState = {
  requestsToday: number;
  creditsToday: number;
  allCreditsToday: number;
  allCreditsWeek: number;
  allCreditsMonth: number;
  reservedCredits: number;
  estimatedCredits: number;
  providerRemaining: number | null;
  providerBalanceUpdatedAt: Date | null;
  now: Date;
};

export function verificationPolicyBlockReason(
  policy: VerificationPolicy,
  state: VerificationPolicyState,
): string | null {
  if (!policy.enabled) return "Owner-disabled verification.";
  if (state.estimatedCredits > policy.maxCreditsPerRequest) {
    return "Per-verification credit limit exceeded.";
  }
  if (state.requestsToday >= policy.dailyRequestLimit) {
    return "Daily verification request limit reached.";
  }
  if (
    state.creditsToday + state.reservedCredits + state.estimatedCredits >
    policy.dailyCreditLimit
  ) {
    return "Daily verification credit limit reached.";
  }
  if (
    state.allCreditsToday + state.reservedCredits + state.estimatedCredits >
    policy.overallDailyLimit
  ) {
    return "Overall daily credit limit reached.";
  }
  if (
    state.allCreditsWeek + state.reservedCredits + state.estimatedCredits >
    policy.overallWeeklyLimit
  ) {
    return "Overall weekly credit limit reached.";
  }
  if (
    state.allCreditsMonth + state.reservedCredits + state.estimatedCredits >
    policy.overallMonthlyLimit
  ) {
    return "Overall monthly credit limit reached.";
  }
  const balanceIsCurrent =
    state.providerBalanceUpdatedAt != null &&
    state.providerBalanceUpdatedAt >=
      new Date(state.now.getTime() - PROVIDER_BALANCE_FRESH_MS);
  if (
    balanceIsCurrent &&
    state.providerRemaining != null &&
    state.providerRemaining - state.reservedCredits - state.estimatedCredits < 0
  ) {
    return "Provider has insufficient remaining credits.";
  }
  return null;
}

export type OddsCreditReservationInput = {
  todayCredits: number;
  weekCredits: number;
  monthCredits: number;
  reservedCredits: number;
  estimatedCredits: number;
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  perRunLimit: number;
  providerRemaining: number | null;
  providerBalanceUpdatedAt: Date | null;
  providerReserve: number;
  now: Date;
};

export function oddsReservationBlockReason(
  input: OddsCreditReservationInput,
): string | null {
  const {
    reservedCredits,
    estimatedCredits,
    providerRemaining,
    providerBalanceUpdatedAt,
    now,
  } = input;
  const providerBalanceIsCurrent =
    providerBalanceUpdatedAt != null &&
    providerBalanceUpdatedAt >=
      new Date(now.getTime() - PROVIDER_BALANCE_FRESH_MS);
  const providerAllows =
    !providerBalanceIsCurrent ||
    providerRemaining == null ||
    providerRemaining - reservedCredits - estimatedCredits >=
      input.providerReserve;

  if (estimatedCredits > input.perRunLimit) return "Per-run limit exceeded.";
  if (
    input.todayCredits + reservedCredits + estimatedCredits >
    input.dailyLimit
  ) {
    return "Daily limit exceeded.";
  }
  if (
    input.weekCredits + reservedCredits + estimatedCredits >
    input.weeklyLimit
  ) {
    return "Weekly limit exceeded.";
  }
  if (
    input.monthCredits + reservedCredits + estimatedCredits >
    input.monthlyLimit
  ) {
    return "Monthly limit exceeded.";
  }
  if (!providerAllows) return "Protected provider reserve would be breached.";
  return null;
}

export function canReserveOddsCredits(
  input: OddsCreditReservationInput,
): boolean {
  return oddsReservationBlockReason(input) === null;
}

/** Whether a cached selection remains publishable under the active owner strategy. */
export function selectionAllowedForMarkets(
  selection: OddsSelection,
  markets: readonly string[],
): boolean {
  const allowed = new Set(markets);
  if (selection.market === "Spread") {
    return selection.featured === false
      ? allowed.has("alternate_spreads")
      : allowed.has("spreads");
  }
  if (selection.market === "Total") {
    return selection.featured === false
      ? allowed.has("alternate_totals")
      : allowed.has("totals");
  }
  return marketKeysForMarket(selection.market).some((market) =>
    allowed.has(market),
  );
}

export const SOCCER_CONTROL_LEAGUES = SOCCER_LEAGUES.map((league) => ({
  key: league.key,
  label: league.label,
}));
