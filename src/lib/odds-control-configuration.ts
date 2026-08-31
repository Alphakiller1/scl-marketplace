import {
  allowedExpandedMarkets,
  CADENCE_OPTIONS,
  defaultSportControl,
  estimatedRunCredits,
  LEGACY_SCHEDULED_SPORTS,
  type OddsControlSport,
} from "@/lib/odds-control";
import { SOCCER_LEAGUES } from "@/lib/soccer-leagues";

/**
 * The active-configuration registry behind Admin → API Credits.
 *
 * Two kinds of setting decide what SCL spends, and they are not
 * interchangeable — which is exactly what the dashboard has to make legible:
 *
 *  - **Universal** settings live on the single `OddsControlConfig` row. They
 *    apply to every league at once. The credit windows are a SHARED POOL, so a
 *    league cannot be given its own daily limit — the first league to reach the
 *    daily cap stops every other league too.
 *  - **League** settings live on one `OddsSportControl` row per sport and
 *    decide coverage, cadence and scope for that league alone.
 *
 * The per-league settings still have a universal baseline —
 * {@link defaultSportControl} — and a league that has been given its own value
 * OVERRIDES that baseline for itself and nothing else. That is the precedence
 * rule this module computes and the UI displays: universal applies everywhere
 * it is not replaced; a league override replaces it for that league only.
 */

export type OddsConfigScope = "universal" | "league";

/**
 * Where a setting is changed. `dashboard` is editable on this screen;
 * `code` is a constant a deploy has to change, shown so a league's cost is
 * explainable without reading the source.
 */
export type OddsConfigSource = "dashboard" | "code";

export type OddsConfigEntry = {
  id: string;
  label: string;
  value: string;
  /** One line on what the setting does, in the owner's language. */
  description: string;
  scope: OddsConfigScope;
  source: OddsConfigSource;
  /** Present on league entries: the universal value this league replaces. */
  universalValue?: string;
  /** True when this league's value differs from the universal baseline. */
  overridesUniversal: boolean;
  /** Universal entries only: whether a league is allowed to replace this. */
  overridable?: boolean;
  /** Universal entries only: leagues that currently replace this value. */
  overriddenBy?: string[];
};

export type LeagueConfiguration = {
  sport: OddsControlSport;
  enabled: boolean;
  /** Coverage tiers this league is currently scheduled for. */
  tiers: string[];
  entries: OddsConfigEntry[];
  overrideCount: number;
  inheritedCount: number;
  /** Worst-case credits for one run of each enabled tier. */
  estimatedCreditsPerCycle: number;
};

export type ActiveConfiguration = {
  universal: OddsConfigEntry[];
  leagues: LeagueConfiguration[];
  counts: {
    universal: number;
    overrides: number;
    leaguesEnabled: number;
    leaguesTotal: number;
  };
};

/**
 * One league's saved strategy.
 *
 * Declared structurally rather than as `ReturnType<typeof defaultSportControl>`
 * because that narrows the market arrays to the literal keys of the shipped
 * defaults, and a stored row is plain `string[]`.
 */
export type SportControlInput = {
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

type OddsControlConfigInput = {
  managedSchedulingEnabled: boolean;
  paused: boolean;
  dailyCreditLimit: number;
  weeklyCreditLimit: number;
  monthlyCreditLimit: number;
  perRunCreditLimit: number;
  warningPercent: number;
  reserveCredits: number;
  verificationEnabled: boolean;
  verificationDailyRequestLimit: number;
  verificationDailyCreditLimit: number;
  verificationMaxCreditsPerRequest: number;
  verificationCacheMinutes: number;
  timezone: string;
};

/**
 * The universal baseline every league starts from.
 *
 * Read off {@link defaultSportControl} rather than restated, so a change to the
 * defaults can never leave the dashboard claiming an override that is really
 * the baseline. NFL is an arbitrary sport with no code-level exceptions of its
 * own — see {@link CODE_LEVEL_LEAGUE_DEFAULTS} for the ones that do.
 */
const BASELINE = defaultSportControl("NFL");

/**
 * League baselines that differ from {@link BASELINE} in code, not in the
 * database. Soccer prices a whole board of cheap fixtures, so its event cap
 * ships higher than every other league's.
 */
const CODE_LEVEL_LEAGUE_DEFAULTS: Partial<
  Record<OddsControlSport, { maxEventsPerRun?: number }>
> = {
  SOCCER: { maxEventsPerRun: 80 },
};

export function cadenceText(minutes: number): string {
  return (
    CADENCE_OPTIONS.find((option) => option.minutes === minutes)?.label ??
    `Every ${minutes} min`
  );
}

function marketsText(markets: readonly string[]): string {
  if (!markets.length) return "None";
  return `${markets.length} market${markets.length === 1 ? "" : "s"}`;
}

function sameMarkets(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = new Set(a);
  return b.every((market) => left.has(market));
}

function onOff(value: boolean, on = "On", off = "Off"): string {
  return value ? on : off;
}

function credits(value: number): string {
  return `${Math.round(value).toLocaleString()} credits`;
}

/** The event cap a league inherits before anyone edits it. */
export function baselineMaxEventsPerRun(sport: OddsControlSport): number {
  return (
    CODE_LEVEL_LEAGUE_DEFAULTS[sport]?.maxEventsPerRun ??
    BASELINE.maxEventsPerRun
  );
}

/**
 * Settings that apply to every league at once.
 *
 * `overridable: false` is not a gap in the UI — it is the credit model. Every
 * league draws from one pool of credits and one provider balance, so these have
 * to be decided once for all of them.
 */
export function universalConfigEntries(
  config: OddsControlConfigInput,
  sports: readonly SportControlInput[] = [],
): OddsConfigEntry[] {
  const overriddenBy = (
    predicate: (sport: SportControlInput) => boolean,
  ): string[] => sports.filter(predicate).map((sport) => sport.sport);

  const universal = (
    entry: Omit<OddsConfigEntry, "scope" | "source" | "overridesUniversal">,
  ): OddsConfigEntry => ({
    ...entry,
    scope: "universal",
    source: "dashboard",
    overridesUniversal: false,
  });

  return [
    universal({
      id: "managed-scheduling",
      label: "Owner-managed scheduling",
      value: onOff(config.managedSchedulingEnabled, "Active", "Inactive"),
      description:
        "When inactive, nothing on this screen controls API calls and the deployed production cadence stays authoritative.",
      overridable: false,
    }),
    universal({
      id: "paused",
      label: "Optional pulls",
      value: onOff(config.paused, "Paused", "Running"),
      description:
        "Pausing stops scheduled board refreshes for every league. Results settlement and pick verification keep running.",
      overridable: false,
    }),
    universal({
      id: "daily-limit",
      label: "Daily credit limit",
      value: credits(config.dailyCreditLimit),
      description:
        "One shared pool per calendar day. The first league to reach it stops the rest of them too.",
      overridable: false,
    }),
    universal({
      id: "weekly-limit",
      label: "Weekly credit limit",
      value: credits(config.weeklyCreditLimit),
      description: "Shared across all leagues over a rolling seven days.",
      overridable: false,
    }),
    universal({
      id: "monthly-limit",
      label: "Monthly credit limit",
      value: credits(config.monthlyCreditLimit),
      description:
        "Shared across all leagues for the calendar month, and the number the projection is measured against.",
      overridable: false,
    }),
    universal({
      id: "per-run-limit",
      label: "Per-run credit limit",
      value: credits(config.perRunCreditLimit),
      description:
        "The most any single run may reserve. Each league's estimate below is checked against this before it spends.",
      overridable: false,
    }),
    universal({
      id: "reserve",
      label: "Protected reserve",
      value: credits(config.reserveCredits),
      description:
        "Held back for results and pick verification. Optional board pulls stop rather than spend into it.",
      overridable: false,
    }),
    universal({
      id: "warning-percent",
      label: "Warning threshold",
      value: `${config.warningPercent}% of each limit`,
      description:
        "Where the meters turn from healthy to warning, so a limit is visible before it blocks a run.",
      overridable: false,
    }),
    universal({
      id: "verification-enabled",
      label: "Live verification",
      value: onOff(config.verificationEnabled, "Allowed", "Blocked"),
      description:
        "Per-event price checks when a capper logs a pick. Blocking this never disables grading.",
      overridable: false,
    }),
    universal({
      id: "verification-daily-requests",
      label: "Daily verification attempts",
      value: config.verificationDailyRequestLimit.toLocaleString(),
      description: "Maximum per-event checks across all leagues in a day.",
      overridable: false,
    }),
    universal({
      id: "verification-daily-credits",
      label: "Daily verification credits",
      value: credits(config.verificationDailyCreditLimit),
      description:
        "A verification-only budget inside the daily limit, so board population cannot spend the credits picks need.",
      overridable: false,
    }),
    universal({
      id: "verification-per-request",
      label: "Credits per verification",
      value: credits(config.verificationMaxCreditsPerRequest),
      description:
        "Refuses one unusually wide check rather than letting it drain the verification budget.",
      overridable: false,
    }),
    universal({
      id: "verification-cache",
      label: "Verification reuse window",
      value: `${config.verificationCacheMinutes} min`,
      description:
        "How long one event's price is reused before it is bought again. The single largest lever on verification spend.",
      overridable: false,
    }),
    universal({
      id: "timezone",
      label: "Schedule timezone",
      value: config.timezone,
      description:
        "Every cadence and schedule on this screen is read in this zone and follows daylight-saving changes.",
      overridable: false,
    }),
    universal({
      id: "default-surface-markets",
      label: "Default standard markets",
      value: marketsText(BASELINE.surfaceMarkets),
      description:
        "Moneyline, spreads and totals — the game lines a league pulls unless it says otherwise.",
      overridable: true,
      overriddenBy: overriddenBy(
        (sport) => !sameMarkets(sport.surfaceMarkets, BASELINE.surfaceMarkets),
      ),
    }),
    universal({
      id: "default-surface-cadence",
      label: "Default standard cadence",
      value: cadenceText(BASELINE.surfaceCadenceMinutes),
      description: "How often a league refreshes its game lines by default.",
      overridable: true,
      overriddenBy: overriddenBy(
        (sport) =>
          sport.surfaceCadenceMinutes !== BASELINE.surfaceCadenceMinutes,
      ),
    }),
    universal({
      id: "default-expanded-cadence",
      label: "Default expanded cadence",
      value: cadenceText(BASELINE.expandedCadenceMinutes),
      description:
        "How often a league refreshes props, alternates and specialty markets by default.",
      overridable: true,
      overriddenBy: overriddenBy(
        (sport) =>
          sport.expandedCadenceMinutes !== BASELINE.expandedCadenceMinutes,
      ),
    }),
    universal({
      id: "default-max-events",
      label: "Default events per run",
      value: `${BASELINE.maxEventsPerRun} events`,
      description:
        "The most events one expanded run will price. Expanded cost is this number times the markets selected.",
      overridable: true,
      overriddenBy: overriddenBy(
        (sport) => sport.maxEventsPerRun !== BASELINE.maxEventsPerRun,
      ),
    }),
    universal({
      id: "default-enabled",
      label: "Default coverage on activation",
      value: `${LEGACY_SCHEDULED_SPORTS.size} leagues on`,
      description: `${[...LEGACY_SCHEDULED_SPORTS].join(", ")} carry the coverage that existed before this dashboard. Every other league is opt-in.`,
      overridable: true,
      overriddenBy: overriddenBy(
        (sport) =>
          sport.enabled !==
          LEGACY_SCHEDULED_SPORTS.has(sport.sport as OddsControlSport),
      ),
    }),
  ];
}

/** The scope line for a league that fetches one competition at a time. */
function leagueScopeValue(sport: SportControlInput): string {
  if (!sport.leagues.length) return "Automatic";
  if (sport.sport === "SOCCER") {
    const byKey = new Map(
      SOCCER_LEAGUES.map((league) => [league.key, league.label]),
    );
    return sport.leagues.map((key) => byKey.get(key) ?? key).join(", ");
  }
  return sport.leagues.join(", ");
}

/** Every setting in force for one league, with the baseline it replaces. */
export function leagueConfigEntries(
  sport: SportControlInput,
): OddsConfigEntry[] {
  const expandedAvailable = allowedExpandedMarkets(sport.sport);
  const baselineEvents = baselineMaxEventsPerRun(
    sport.sport as OddsControlSport,
  );
  const baselineEnabled = LEGACY_SCHEDULED_SPORTS.has(
    sport.sport as OddsControlSport,
  );

  const league = (
    entry: Omit<OddsConfigEntry, "scope" | "source"> & {
      source?: OddsConfigSource;
    },
  ): OddsConfigEntry => ({
    source: "dashboard",
    ...entry,
    scope: "league",
  });

  const entries: OddsConfigEntry[] = [
    league({
      id: "enabled",
      label: "League",
      value: onOff(sport.enabled, "Enabled", "Off"),
      description: sport.enabled
        ? "Scheduled pulls may run for this league."
        : "No scheduled pull runs for this league, whatever else is selected below.",
      universalValue: onOff(baselineEnabled, "Enabled", "Off"),
      overridesUniversal: sport.enabled !== baselineEnabled,
    }),
    league({
      id: "surface",
      label: "Standard board",
      value: onOff(sport.surfaceEnabled),
      description: "Shared events and primary game lines for this league.",
      universalValue: onOff(baselineEnabled),
      overridesUniversal: sport.surfaceEnabled !== baselineEnabled,
    }),
    league({
      id: "surface-markets",
      label: "Standard markets",
      value: marketsText(sport.surfaceMarkets),
      description: sport.surfaceMarkets.length
        ? sport.surfaceMarkets.join(", ")
        : "No game lines are pulled for this league.",
      universalValue: marketsText(BASELINE.surfaceMarkets),
      overridesUniversal: !sameMarkets(
        sport.surfaceMarkets,
        BASELINE.surfaceMarkets,
      ),
    }),
    league({
      id: "surface-cadence",
      label: "Standard cadence",
      value: cadenceText(sport.surfaceCadenceMinutes),
      description: "How often this league's game lines are refreshed.",
      universalValue: cadenceText(BASELINE.surfaceCadenceMinutes),
      overridesUniversal:
        sport.surfaceCadenceMinutes !== BASELINE.surfaceCadenceMinutes,
    }),
  ];

  if (expandedAvailable.length) {
    entries.push(
      league({
        id: "expanded",
        label: "Expanded markets",
        value: onOff(sport.expandedEnabled),
        description:
          "Props, alternate ladders and specialty markets, priced one event at a time.",
        universalValue: onOff(baselineEnabled),
        overridesUniversal: sport.expandedEnabled !== baselineEnabled,
      }),
      league({
        id: "expanded-markets",
        label: "Expanded market selection",
        value: `${sport.expandedMarkets.length} of ${expandedAvailable.length}`,
        description:
          "Only the market groups selected for this league are requested. Every key is billed whether or not a book prices it.",
        universalValue: `${expandedAvailable.length} supported`,
        overridesUniversal:
          sport.expandedMarkets.length !== expandedAvailable.length,
      }),
      league({
        id: "expanded-cadence",
        label: "Expanded cadence",
        value: cadenceText(sport.expandedCadenceMinutes),
        description: "How often this league re-prices its expanded markets.",
        universalValue: cadenceText(BASELINE.expandedCadenceMinutes),
        overridesUniversal:
          sport.expandedCadenceMinutes !== BASELINE.expandedCadenceMinutes,
      }),
      league({
        id: "max-events",
        label: "Events per run",
        value: `${sport.maxEventsPerRun} events`,
        description:
          "The expanded run stops here. Cost is this number times the selected markets.",
        universalValue: `${baselineEvents} events`,
        overridesUniversal: sport.maxEventsPerRun !== baselineEvents,
      }),
    );
  } else {
    entries.push(
      league({
        id: "expanded-unsupported",
        label: "Expanded markets",
        value: "Not supported",
        description:
          "SCL has no expanded market registered for this league, so it is standard game lines only.",
        source: "code",
        universalValue: "Supported where registered",
        // A missing market registry is a limit of the deployed build, not a
        // choice an owner made here — counting it as an override would inflate
        // every football and hockey league's override badge.
        overridesUniversal: false,
      }),
    );
  }

  if (sport.sport === "SOCCER" || sport.sport === "TENNIS") {
    entries.push(
      league({
        id: "competition-scope",
        label: "Competition scope",
        value: leagueScopeValue(sport),
        description:
          sport.leagues.length > 0
            ? "Only these competitions are priced. Each one is billed separately."
            : "Competitions with upcoming fixtures are selected automatically, and each one is billed separately.",
        universalValue: "Whole league",
        overridesUniversal: sport.leagues.length > 0,
      }),
    );
  }

  if (CODE_LEVEL_LEAGUE_DEFAULTS[sport.sport as OddsControlSport]) {
    entries.push(
      league({
        id: "code-event-baseline",
        label: "Event cap baseline",
        value: `${baselineEvents} events`,
        description:
          "This league ships with a higher cap than the universal default because one expanded fixture costs a single market.",
        source: "code",
        universalValue: `${BASELINE.maxEventsPerRun} events`,
        overridesUniversal: baselineEvents !== BASELINE.maxEventsPerRun,
      }),
    );
  }

  return entries;
}

function activeTiers(sport: SportControlInput, expandedSupported: boolean) {
  if (!sport.enabled) return [];
  return [
    sport.surfaceEnabled ? "Standard" : null,
    sport.expandedEnabled && expandedSupported ? "Expanded" : null,
  ].filter((tier): tier is string => tier != null);
}

/** Worst-case credits for one cycle of every tier this league has enabled. */
export function leagueCycleCredits(sport: SportControlInput): number {
  let total = 0;
  if (sport.enabled && sport.surfaceEnabled) {
    total += estimatedRunCredits({
      sport: sport.sport,
      tier: "surface",
      markets: sport.surfaceMarkets,
      leagues: sport.leagues,
      maxEventsPerRun: sport.maxEventsPerRun,
    });
  }
  if (sport.enabled && sport.expandedEnabled) {
    total += estimatedRunCredits({
      sport: sport.sport,
      tier: "expanded",
      markets: sport.expandedMarkets,
      leagues: sport.leagues,
      maxEventsPerRun: sport.maxEventsPerRun,
    });
  }
  return total;
}

/**
 * The whole registry: what is universal, what each league overrides, and how
 * much of the configuration is actually league-specific.
 *
 * Leagues are ordered by how much attention they need — enabled first, then by
 * the credits one cycle can spend — so the expensive ones are not buried
 * beneath leagues nobody has turned on.
 */
export function activeConfiguration(
  config: OddsControlConfigInput,
  sports: readonly SportControlInput[],
): ActiveConfiguration {
  const universal = universalConfigEntries(config, sports);

  const leagues: LeagueConfiguration[] = sports
    .map((sport) => {
      const entries = leagueConfigEntries(sport);
      const overrideCount = entries.filter(
        (entry) => entry.overridesUniversal,
      ).length;
      return {
        sport: sport.sport as OddsControlSport,
        enabled: sport.enabled,
        tiers: activeTiers(
          sport,
          allowedExpandedMarkets(sport.sport).length > 0,
        ),
        entries,
        overrideCount,
        inheritedCount: entries.length - overrideCount,
        estimatedCreditsPerCycle: leagueCycleCredits(sport),
      };
    })
    .sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      if (a.estimatedCreditsPerCycle !== b.estimatedCreditsPerCycle) {
        return b.estimatedCreditsPerCycle - a.estimatedCreditsPerCycle;
      }
      return a.sport.localeCompare(b.sport);
    });

  return {
    universal,
    leagues,
    counts: {
      universal: universal.length,
      overrides: leagues.reduce(
        (total, league) => total + league.overrideCount,
        0,
      ),
      leaguesEnabled: leagues.filter((league) => league.enabled).length,
      leaguesTotal: leagues.length,
    },
  };
}
