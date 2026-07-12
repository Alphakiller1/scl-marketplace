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
] as const;

/**
 * Curated player-prop market keys per SCL sport. Kept intentionally small — verify the props
 * cappers actually post, not every market The Odds API sells (each extra market is credits).
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

/** All markets requested in the single bundled per-event call for a sport. */
export function verificationMarkets(sclSport: string): string[] {
  return [...CORE_MARKETS, ...(PROP_MARKETS_BY_SPORT[sclSport] ?? [])];
}

/**
 * Map a Play's `market` label to the Odds API market keys to verify against. The odds-assist
 * prefill writes "Moneyline"/"Spread"/"Total"; each game market bundles its featured + alternate
 * key so a pick at any line matches. Anything else is treated as a prop market key as-is.
 */
export const GAME_MARKET_KEYS: Record<string, string[]> = {
  Moneyline: ["h2h"],
  Spread: ["spreads", "alternate_spreads"],
  Total: ["totals", "alternate_totals"],
};

export function marketKeysForMarket(market: string): string[] {
  return GAME_MARKET_KEYS[market.trim()] ?? [market.trim()];
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
export type RawEventOdds = {
  id: string;
  bookmakers?: { markets?: RawMarket[] }[];
};

/**
 * Collect every American price offered for a specific { marketKeys, side, line, player } across
 * all books on a per-event odds payload. `marketKeys` groups a featured market with its alternate
 * (e.g. ["spreads","alternate_spreads"]). Pure — no network.
 */
export function collectAvailablePrices(
  event: RawEventOdds,
  filter: {
    marketKeys: string[];
    side: string;
    line?: number;
    player?: string;
  },
): number[] {
  const wantSide = filter.side.trim().toLowerCase();
  const wantPlayer = filter.player?.trim().toLowerCase();
  const prices: number[] = [];
  for (const bm of event.bookmakers ?? []) {
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
 * The single trust gate for a submitted pick. Pure — the server action supplies `now`, the event
 * start, and the fetched verify result. Two things hard-reject; everything else is accepted but
 * may land as SELF_REPORTED (which keeps it off the verified leaderboard):
 *
 *   C1 — a known start time that has already passed (no post-game logging, ever).
 *   C3 — a claimed price better than the market beyond tolerance (fabricated odds).
 *
 * VERIFIED requires the full strict path: event-bound + logged pre-game + odds verified. The same
 * bar reached through an authorized connector is AUTO_VERIFIED.
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

  if (verify && verify.status === "rejected") {
    return { accept: false, reason: verify.reason };
  }
  const oddsVerified = verify?.status === "verified";

  let tier: VerificationTierValue = "SELF_REPORTED";
  if (eventBound && loggedPreGame && oddsVerified) {
    tier = source === "MANUAL" ? "VERIFIED" : "AUTO_VERIFIED";
  }

  return { accept: true, loggedPreGame, oddsVerified, tier };
}
