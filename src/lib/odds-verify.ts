/**
 * Pick odds/line verification for pick integrity (see docs/SCL_PICK_INTEGRITY.md §C3).
 *
 * Pure logic only — no network, no `server-only` — so it is unit-testable. The server-side fetch
 * (`fetchEventOddsForVerification` / `verifyPick`) lives in `odds-api.ts` and consumes this.
 *
 * The trust question is one-sided: fraud is *always* claiming a price BETTER than was obtainable
 * (to inflate ROI); a capper has no incentive to claim a worse price. So we don't match a
 * "correct" price — we bound how good the claimed price could plausibly be:
 *
 *   accept iff  claimedImplied >= bestAvailableImplied - tolerance
 *
 * Comparison is in IMPLIED-PROBABILITY space because American odds are non-linear (+100→+110 and
 * −110→−120 are unequal moves). "Best available" = the most bettor-favorable price across all
 * covered US books for the exact { market, side, line }. Unverifiable (uncovered book/market) is
 * never a rejection — the caller marks it SELF-REPORTED.
 */

import {
  periodMarketKeysForLabel,
  periodMarketKeysForSport,
} from "@/lib/period-markets";
import {
  isTeamTotalMarket,
  TEAM_TOTAL_MARKET_KEYS,
} from "@/lib/team-total-markets";

/** Verification region — US cappers bet US books; keeps per-event cost at 1× regions. */
export const VERIFY_REGIONS = "us";
/** Fetch-cache TTL (seconds). A fresh-ish snapshot near submission is enough for a bound. */
export const VERIFY_TTL_SECONDS = 600;
/** Default accept band, in implied-probability points (0.02 = 2 pts). Widen for volatile props. */
export const DEFAULT_TOLERANCE_PROB = 0.02;

/** Featured + alternate markets requested for every event (game-line verification). */
export const CORE_MARKETS = [
  "h2h",
  "spreads",
  "totals",
  "alternate_spreads",
  "alternate_totals",
  // Team totals price one club's runs, not the game's, and cappers post them
  // routinely. Both keys, for the same reason spreads and totals take both: the
  // featured key carries the main line per club and the alternate carries the
  // ladder around it.
  ...TEAM_TOTAL_MARKET_KEYS,
] as const;

/**
 * Curated player-prop market keys per SCL sport. Kept intentionally small — verify the props
 * cappers actually post, not every market The Odds API sells (each extra market is credits).
 *
 * Listed as FEATURED keys only; {@link propMarketKeysWithAlternates} appends the `_alternate`
 * variant of each when the board and verification request them.
 */
export const PROP_MARKETS_BY_SPORT: Record<string, readonly string[]> = {
  MLB: [
    "pitcher_strikeouts",
    "pitcher_outs",
    "pitcher_earned_runs",
    "batter_hits",
  ],
  NBA: ["player_points", "player_rebounds", "player_assists", "player_threes"],
  WNBA: ["player_points", "player_rebounds", "player_assists"],
  NCAAB: ["player_points"],
  NFL: [
    "player_pass_yds",
    "player_rush_yds",
    "player_receptions",
    "player_reception_yds",
  ],
  NCAAF: ["player_pass_yds", "player_rush_yds"],
  NHL: ["player_points", "player_shots_on_goal"],
};

/**
 * A curated prop key plus its alternate variant.
 *
 * The Odds API exposes milestone "X+" lines (6+ strikeouts, 2+ hits) ONLY under the
 * `_alternate` key — the featured key carries just the single main line. Requesting
 * only the featured key is why alternate lines that are visible at the book never
 * appeared on the board. Game lines already did this via `alternate_spreads` /
 * `alternate_totals`; props were the gap.
 */
export function propMarketKeysWithAlternates(propKey: string): string[] {
  return [propKey, `${propKey}_alternate`];
}

/**
 * All markets requested in the single bundled per-event call for a sport.
 *
 * Period (first-N-innings) markets ride along here rather than on the bulk board
 * call: the Odds API serves non-featured markets only from the per-event
 * endpoint, which is also where per-book attribution comes from — so asking here
 * is what gives every capper F3/F5/F7 prices broken out by book.
 */
export function verificationMarkets(sclSport: string): string[] {
  const props = PROP_MARKETS_BY_SPORT[sclSport] ?? [];
  return [
    ...CORE_MARKETS,
    ...periodMarketKeysForSport(sclSport),
    ...props.flatMap(propMarketKeysWithAlternates),
  ];
}

/**
 * Human labels for the curated prop markets (Odds API key → display). The board stores the label
 * as the Play's `market` (so it reads "Strikeouts", not `pitcher_strikeouts`) and verification maps
 * it back via {@link marketKeysForMarket}.
 */
export const PROP_MARKET_LABEL: Record<string, string> = {
  pitcher_strikeouts: "Strikeouts",
  pitcher_outs: "Outs",
  pitcher_earned_runs: "Earned Runs",
  batter_hits: "Hits",
  player_points: "Points",
  player_rebounds: "Rebounds",
  player_assists: "Assists",
  player_threes: "3-Pointers",
  player_pass_yds: "Passing Yds",
  player_rush_yds: "Rushing Yds",
  player_receptions: "Receptions",
  player_reception_yds: "Receiving Yds",
  player_shots_on_goal: "Shots On Goal",
};

/**
 * Display label for a prop market key, alternate variants included.
 *
 * The `_alternate` markets carry the milestone ladder ("6+ strikeouts", "2+
 * hits") that the featured key does not — which is exactly why
 * `propMarketKeysWithAlternates` requests both. But normalization looked the
 * raw key up in PROP_MARKET_LABEL, which holds featured keys only, so every
 * alternate market was fetched, BILLED, and then silently dropped: cappers saw
 * only the single main line and the ladder never reached the board.
 *
 * Game lines never had this problem because BOARD_MARKETS lists
 * `alternate_spreads` / `alternate_totals` explicitly. Props now fold the same
 * way, by suffix rather than by restating all thirteen labels.
 */
export function propMarketLabel(marketKey: string): string | undefined {
  const key = marketKey.trim();
  return (
    PROP_MARKET_LABEL[key] ?? PROP_MARKET_LABEL[key.replace(/_alternate$/, "")]
  );
}

/** Reverse of PROP_MARKET_LABEL (display label → Odds API key). Labels are unique. */
const PROP_LABEL_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(PROP_MARKET_LABEL).map(([key, label]) => [label, key]),
);

/**
 * Map a Play's `market` to the Odds API market keys to verify against. The board writes
 * "Moneyline"/"Spread"/"Total" for game lines (each bundling its featured + alternate key so a pick
 * at any line matches) and a prop label like "Strikeouts" for props (resolved back to its key).
 * An unrecognized value is passed through as-is (already a market key).
 */
export const GAME_MARKET_KEYS: Record<string, string[]> = {
  Moneyline: ["h2h"],
  Spread: ["spreads", "alternate_spreads"],
  Total: ["totals", "alternate_totals"],
};

export function marketKeysForMarket(market: string): string[] {
  const m = market.trim();
  if (GAME_MARKET_KEYS[m]) return GAME_MARKET_KEYS[m];
  // Checked before the prop table: a period label is a game line, not a prop,
  // and it has no `_alternate` variant to bundle.
  const periodKeys = periodMarketKeysForLabel(m);
  if (periodKeys) return periodKeys;
  // Also a game line, not a prop. A pick taken off the alternate ladder has to
  // be priced against both keys or verification cannot find the line it was
  // logged at.
  if (isTeamTotalMarket(m)) return [...TEAM_TOTAL_MARKET_KEYS];
  // A pick logged at a milestone line (6+ strikeouts) lives in the alternate
  // market, so verification has to look in both or it would fail to price it.
  const propKey = PROP_LABEL_TO_KEY[m];
  if (propKey) return propMarketKeysWithAlternates(propKey);
  return [m];
}

// ── implied-probability + best-available math ────────────────────────────────

/** American odds → implied probability (with vig), in [0,1]. */
export function impliedProbFromAmerican(american: number): number {
  if (american === 0) return 1;
  return american > 0 ? 100 / (american + 100) : -american / (-american + 100);
}

/** The most bettor-favorable American price (lowest implied prob) in a list, or null if empty. */
export function bestAvailableAmerican(prices: number[]): number | null {
  let best: number | null = null;
  let bestImplied = Infinity;
  for (const p of prices) {
    const implied = impliedProbFromAmerican(p);
    if (implied < bestImplied) {
      bestImplied = implied;
      best = p;
    }
  }
  return best;
}

/** Median American price (a robust central reference for ranking), or null if empty. */
export function medianAmerican(prices: number[]): number | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export type VerifyResult =
  | {
      status: "verified";
      bestAvailable: number;
      reference: number | null;
      claimedImplied: number;
      bestImplied: number;
    }
  | {
      status: "rejected";
      bestAvailable: number;
      reference: number | null;
      reason: string;
      claimedImplied: number;
      bestImplied: number;
    }
  | { status: "unverifiable"; reason: string };

/**
 * One-sided bound in implied-probability space. Pure.
 * `availableAmerican` = every price offered for the exact { market, side, line } across books.
 */
export function verifyOdds(params: {
  claimedAmerican: number;
  availableAmerican: number[];
  toleranceProb?: number;
}): VerifyResult {
  const { claimedAmerican, availableAmerican } = params;
  const tolerance = params.toleranceProb ?? DEFAULT_TOLERANCE_PROB;
  const best = bestAvailableAmerican(availableAmerican);
  if (best === null) {
    return {
      status: "unverifiable",
      reason: "No covered book offered this market/side/line at capture time.",
    };
  }
  const claimedImplied = impliedProbFromAmerican(claimedAmerican);
  const bestImplied = impliedProbFromAmerican(best);
  const reference = medianAmerican(availableAmerican);
  // Claimed price is "better than obtainable" when its implied prob is meaningfully BELOW the
  // best book's implied prob (a longer price than anyone offered).
  if (claimedImplied < bestImplied - tolerance) {
    const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
    return {
      status: "rejected",
      bestAvailable: best,
      reference,
      claimedImplied,
      bestImplied,
      reason: `Claimed ${sign(claimedAmerican)} is better than the best available (${sign(best)}) beyond tolerance.`,
    };
  }
  return {
    status: "verified",
    bestAvailable: best,
    reference,
    claimedImplied,
    bestImplied,
  };
}

// ── per-event odds payload extraction ────────────────────────────────────────

export type RawOutcome = {
  name: string;
  price: number;
  point?: number;
  description?: string;
};
export type RawMarket = { key: string; outcomes: RawOutcome[] };
export type RawBookmaker = {
  /** Odds API bookmaker key (e.g. draftkings). Required for per-book attribution. */
  key?: string;
  title?: string;
  /** Odds API ISO timestamp for when this bookmaker's lines were last updated. */
  last_update?: string;
  markets?: RawMarket[];
};
export type RawEventOdds = {
  id: string;
  bookmakers?: RawBookmaker[];
};

export type PriceFilter = {
  marketKeys: string[];
  side: string;
  line?: number;
  player?: string;
};

/**
 * Collect every American price offered for a specific { marketKeys, side, line, player } across
 * books on a per-event odds payload. `marketKeys` groups a featured market with its alternate
 * (e.g. ["spreads","alternate_spreads"]). When `bookKeys` is non-empty, only those bookmakers
 * count (capper verified against the books they bet). Empty/omitted = all books on the payload
 * (today's regions=us behavior). Pure — no network.
 */
export function collectAvailablePrices(
  event: RawEventOdds,
  filter: PriceFilter,
  opts?: { bookKeys?: readonly string[] },
): number[] {
  const wantSide = filter.side.trim().toLowerCase();
  const wantPlayer = filter.player?.trim().toLowerCase();
  const allowed =
    opts?.bookKeys && opts.bookKeys.length > 0
      ? new Set(opts.bookKeys.map((k) => k.toLowerCase()))
      : null;
  const prices: number[] = [];
  for (const bm of event.bookmakers ?? []) {
    if (allowed) {
      const key = bm.key?.trim().toLowerCase();
      if (!key || !allowed.has(key)) continue;
    }
    for (const market of bm.markets ?? []) {
      if (!filter.marketKeys.includes(market.key)) continue;
      for (const o of market.outcomes ?? []) {
        if (typeof o.price !== "number") continue;
        if (o.name.trim().toLowerCase() !== wantSide) continue;
        if (
          filter.line !== undefined &&
          (typeof o.point !== "number" ||
            Math.abs(o.point - filter.line) > 1e-6)
        ) {
          continue;
        }
        if (
          wantPlayer &&
          (o.description ?? "").trim().toLowerCase() !== wantPlayer
        ) {
          continue;
        }
        prices.push(Math.round(o.price));
      }
    }
  }
  return prices;
}

/**
 * Honest American price for one book on a market identity, or null when that book has no line
 * (UI renders "—"; never substitutes another book's price). Pure.
 */
export function getOddsForBook(
  event: RawEventOdds,
  marketKey: string,
  bookKey: string,
  outcome: { side: string; line?: number; player?: string },
): number | null {
  const prices = collectAvailablePrices(
    event,
    {
      marketKeys: [marketKey],
      side: outcome.side,
      line: outcome.line,
      player: outcome.player,
    },
    { bookKeys: [bookKey] },
  );
  return bestAvailableAmerican(prices);
}

/**
 * Live American price for a board line identity. When `bookKey` is set, only that
 * book counts (honest null if suspended). Otherwise best across `bookKeys` or all
 * books on the payload. Pure — used by the M5 odds-movement guard.
 */
export function liveLineAmerican(
  event: RawEventOdds,
  params: {
    marketKeys: string[];
    side: string;
    line?: number;
    player?: string;
    /** Capture book on the pick — preferred single-book live price. */
    bookKey?: string | null;
    /** Capper profile books when no capture book (empty = all on payload). */
    bookKeys?: readonly string[];
  },
): number | null {
  if (params.bookKey) {
    for (const mk of params.marketKeys) {
      const price = getOddsForBook(event, mk, params.bookKey, {
        side: params.side,
        line: params.line,
        player: params.player,
      });
      if (price != null) return price;
    }
    return null;
  }
  const filterKeys =
    params.bookKeys && params.bookKeys.length > 0 ? params.bookKeys : undefined;
  const prices = collectAvailablePrices(
    event,
    {
      marketKeys: params.marketKeys,
      side: params.side,
      line: params.line,
      player: params.player,
    },
    filterKeys ? { bookKeys: filterKeys } : undefined,
  );
  return bestAvailableAmerican(prices);
}

// ── pick-integrity decision (C1 pre-game lock + C3 odds + trust tier) ─────────

/** Provenance of a pick — mirrors the Prisma `PickSource` enum. */
export type PickSourceKind =
  | "MANUAL"
  | "IMPORTED_X"
  | "IMPORTED_DISCORD"
  | "IMPORTED_TELEGRAM"
  | "SCREENSHOT_OCR";

/** Public trust tier — mirrors the Prisma `VerificationTier` enum. */
export type VerificationTierValue =
  | "AUTO_VERIFIED"
  | "VERIFIED"
  | "SELF_REPORTED";

export type PickIntegrityInput = {
  now: Date;
  /** Scheduled start; null when the pick isn't bound to a known event (legacy free-text). */
  eventStartsAt: Date | null;
  /** True once the pick carries an event id + a structured side (C2). */
  eventBound: boolean;
  /** Result of the C3 odds check, or null when verification wasn't attempted. */
  verify: VerifyResult | null;
  source: PickSourceKind;
};

export type PickIntegrityDecision =
  | {
      accept: true;
      loggedPreGame: boolean;
      oddsVerified: boolean;
      tier: VerificationTierValue;
    }
  | { accept: false; reason: string };

/**
 * The single trust gate for a newly submitted pick. Pure — the server action supplies `now`, the
 * event start, and an optional verify result. Pick availability must not depend on an external
 * odds service, so only the first two checks gate submission:
 *
 *   C1 — a known start time that has already passed (no post-game logging, ever).
 *   C2 — the pick is bound to a known event and structured selection.
 *   C3 — when available, the submitted odds can be authenticated and labeled VERIFIED.
 *
 * Missing, moved, unavailable, or rejected odds never block a pre-game board selection; those
 * records are honestly labeled SELF_REPORTED. The same verified bar reached through an authorized
 * connector is AUTO_VERIFIED.
 */
export function decidePickIntegrity(
  input: PickIntegrityInput,
): PickIntegrityDecision {
  const { now, eventStartsAt, eventBound, verify, source } = input;

  if (eventStartsAt !== null && now.getTime() >= eventStartsAt.getTime()) {
    return {
      accept: false,
      reason:
        "This event has already started — picks lock at the scheduled start time.",
    };
  }
  const loggedPreGame =
    eventStartsAt !== null && now.getTime() < eventStartsAt.getTime();

  if (!eventBound || !loggedPreGame) {
    return {
      accept: false,
      reason: "Select a pre-game line from the SCL odds board.",
    };
  }
  if (!verify || verify.status !== "verified") {
    return {
      accept: true,
      loggedPreGame,
      oddsVerified: false,
      tier: "SELF_REPORTED",
    };
  }

  const tier = source === "MANUAL" ? "VERIFIED" : "AUTO_VERIFIED";

  return { accept: true, loggedPreGame, oddsVerified: true, tier };
}
