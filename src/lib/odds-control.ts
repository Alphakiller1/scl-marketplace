import { DEFAULT_EVENT_BUYS_PER_DAY } from "@/lib/odds-event-buy-budget";
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
        normalizedSport === "NFL"
          ? "Passing, rushing and receiving lines, with alternate ladders."
          : "Supported basketball player markets and alternates.",
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
    expandedEnabled: enabled && expanded.length > 0,
    surfaceMarkets: SURFACE_MARKETS.map((market) => market.key),
    expandedMarkets: expanded,
    leagues: [] as string[],
    surfaceCadenceMinutes: 240,
    expandedCadenceMinutes: 360,
    maxEventsPerRun: sport === "SOCCER" ? 80 : 20,
    dailyVerificationLimit: DEFAULT_EVENT_BUYS_PER_DAY,
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

/**
 * The two rolling credit windows, in days.
 *
 * Both are ROLLING, and the longer one used to be a calendar month. A calendar
 * window makes the guardrail weakest exactly when it matters: spend the whole
 * budget on the 28th and the limit resets three days later, so a run rate that
 * cannot be afforded is refused for three days and then waved through. A
 * trailing window carries the overspend with it until it ages out.
 *
 * Every caller — the dashboard readout AND the reservation check that blocks a
 * run — must derive its window from here. When display and enforcement compute
 * their own windows they disagree, and the screen reports headroom that the
 * blocker does not believe in.
 */
export const CREDIT_WINDOW_DAYS = {
  day: 1,
  week: 7,
  month: 30,
} as const;

/** Midnight UTC on the day `date` falls in. */
export function utcDayStart(date: Date): Date {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

/**
 * First UTC day inside a rolling window of `days` that ends today.
 *
 * Inclusive of today, so a 7-day window is today plus the six days before it.
 */
export function creditWindowStart(now: Date, days: number): Date {
  return utcDayStart(new Date(now.getTime() - (days - 1) * 86_400_000));
}

/**
 * The day the 100,000-credit provider plan started.
 *
 * Everything before it was spent on a different, smaller plan that ran to
 * exhaustion — the board went dark, the scheduled refresh was switched off by
 * hand, and the usage that survives from those weeks is a record of an outage,
 * not of how the platform spends now. Mixed into a thirty-day window it drags
 * every average, every per-sport share and the month-end projection toward a
 * plan that no longer exists.
 *
 * So the dashboard floors every usage window here. Reads never reach behind it,
 * and the screen says which date it is counting from rather than implying a
 * full thirty days it does not have.
 */
export const ODDS_PLAN_START_ISO = "2026-08-25";

/** Midnight UTC on the first day of the current provider plan. */
export function oddsPlanStart(): Date {
  return new Date(`${ODDS_PLAN_START_ISO}T00:00:00.000Z`);
}

/** A window start, never earlier than the plan it is reporting on. */
export function clampToPlanStart(start: Date): Date {
  const planStart = oddsPlanStart();
  return start < planStart ? planStart : start;
}

/**
 * Credits the provider does not report on the key that served a response.
 *
 * Was 10,000, to stand in for a top-up sitting on another key in the
 * `ODDS_API_KEYS` rollover list. That constant then outlived the top-up and
 * became pure inflation: with the active key reading 1, the dashboard printed
 * "10,001 remaining" while the account actually held ~84,000 on another key —
 * wrong in both directions at once, and the number owners were making spend
 * decisions from.
 *
 * The rollover balance is now summed from observed usage instead (see
 * `accountRemainingCredits`), so nothing needs to be guessed here. Keep at 0
 * unless the provider starts hiding real credits again.
 */
export const ODDS_CREDIT_BALANCE_ADJUSTMENT = 0;

/**
 * The account's spendable balance across every rollover key.
 *
 * `x-requests-remaining` describes ONE key, and the usage table records no key
 * identity, so the account total has to be reconstructed from the readings.
 *
 * Two faults produced the "10k" the dashboard showed against a real ~84,000:
 *
 *  - a flat +10,000 was added to stand in for credits on another key, and
 *    outlived the top-up it represented;
 *  - the balance was read from the LATEST row. `fetchWithOddsKeyRollover`
 *    starts every serverless isolate at `ODDS_API_KEYS[0]` and only advances
 *    once a key refuses, so a spent key at the head of the list is probed by
 *    each cold isolate — its near-zero reading is therefore the most recent
 *    one, over and over, whatever the key actually serving traffic holds.
 *
 * So: split the latest day's readings into keys, take each key's CURRENT
 * balance, and sum. A key is a run of readings of similar magnitude — a
 * healthy key burns down gradually, while a different key is a step change.
 * Two readings belong to different keys when they differ by more than half the
 * larger AND by more than {@link KEY_SPLIT_FLOOR} credits; the floor stops a
 * nearly-dead key's 12 -> 1 from reading as two keys.
 *
 * Heuristic, and deliberately so: the exact fix is to record which key served
 * each response (`fetchWithOddsKeyRollover` already returns `keyIndex`), which
 * needs a column on `OddsUsageDaily`.
 */
const KEY_SPLIT_FLOOR = 100;

export function accountRemainingCredits(
  usage: readonly {
    date: Date;
    updatedAt: Date;
    remaining: number | null;
  }[],
): number | null {
  const seen = usage.filter(
    (row): row is { date: Date; updatedAt: Date; remaining: number } =>
      row.remaining != null,
  );
  if (seen.length === 0) return null;

  const latestDay = seen.reduce(
    (latest, row) => Math.max(latest, row.date.getTime()),
    0,
  );
  const today = [...seen]
    .filter((row) => row.date.getTime() === latestDay)
    .sort((a, b) => b.remaining - a.remaining);

  const keys: { min: number; current: (typeof today)[number] }[] = [];
  for (const row of today) {
    const open = keys[keys.length - 1];
    const isNewKey =
      !open ||
      open.min - row.remaining > Math.max(KEY_SPLIT_FLOOR, open.min * 0.5);
    if (isNewKey) {
      keys.push({ min: row.remaining, current: row });
      continue;
    }
    open.min = Math.min(open.min, row.remaining);
    // A key's balance is its most recent reading, not its high-water mark.
    if (row.updatedAt.getTime() >= open.current.updatedAt.getTime()) {
      open.current = row;
    }
  }

  return keys.reduce((total, key) => total + key.current.remaining, 0);
}

/** The account's spendable balance: the observed key figure plus any top-up. */
export function adjustedOddsRemaining(
  keyRemaining: number | null | undefined,
): number | null {
  if (keyRemaining == null) return null;
  return keyRemaining + ODDS_CREDIT_BALANCE_ADJUSTMENT;
}

export const DEFAULT_ODDS_CONTROL_CONFIG = {
  managedSchedulingEnabled: false,
  paused: false,
  dailyCreditLimit: 2_000,
  weeklyCreditLimit: 25_000,
  monthlyCreditLimit: 100_000,
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
    return "Overall 7-day credit limit reached.";
  }
  if (
    state.allCreditsMonth + state.reservedCredits + state.estimatedCredits >
    policy.overallMonthlyLimit
  ) {
    return "Overall 30-day credit limit reached.";
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
    return "7-day limit exceeded.";
  }
  if (
    input.monthCredits + reservedCredits + estimatedCredits >
    input.monthlyLimit
  ) {
    return "30-day limit exceeded.";
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
