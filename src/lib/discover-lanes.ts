/**
 * Discover curated lanes — pure selection + copy.
 * Eligibility mirrors public-listed leaderboard profiles; sample gates use
 * MIN_GRADED_FOR_SIGNAL / MATURITY. Never fabricate rows to fill a lane.
 */

import type { CapperSummary } from "@/lib/mock";
import { hasQaNoteMarker } from "@/lib/public-eligibility";
import { MATURITY, MIN_GRADED_FOR_SIGNAL, hasSignal } from "@/lib/sample";
import { computeCapperStats, type PlayForStats } from "@/lib/stats";
import { isVerifiedTier, type VerificationTier } from "@/lib/verification";

/** Curated preview size. The full public directory remains on /leaderboard. */
export const DISCOVER_LANE_LIMIT = 4;

/** High verified-share bar for “Newly credible”. */
export const NEWLY_CREDIBLE_MIN_VERIFIED_SHARE = 70;

/** Specialty must be a meaningful share of the graded book. */
export const SPECIALTY_MIN_SHARE = 0.5;

/** Keep QA-marked analysis out of every public Discover aggregation. */
export function filterDiscoverPublicPlays<T extends { notes?: string | null }>(
  plays: T[],
): T[] {
  return plays.filter((play) => !hasQaNoteMarker(play.notes));
}

export type DiscoverLaneId =
  | "proven"
  | "verified_month"
  | "specialists"
  | "newly_credible"
  | "market_beaters";

/**
 * No "verifiedShare": no lane leads with that number any more. It survives as
 * an eligibility gate on Newly Credible, not as something a card renders.
 */
export type DiscoverPrimaryKind = "roi" | "clv";

export type DiscoverLaneMeta = {
  id: DiscoverLaneId;
  title: string;
  explainer: string;
  primaryLabel: string;
  empty: string;
};

/**
 * Supporting empty-state body for a lane — honest cold-start / CLV copy.
 * Kept in one place so mobile accordion + desktop EmptyState stay in sync.
 */
export function discoverLaneEmptyDescription(laneId: DiscoverLaneId): string {
  if (laneId === "market_beaters") {
    return "Avg CLV Compares Submitted Prices With Market Closing Prices. It Does Not Predict Results.";
  }
  return "This Lane Remains Empty Until A Capper Meets Its Published Criteria.";
}

export const DISCOVER_LANE_LOAD_FAILED_TITLE = "Couldn't Load This Lane";
export const DISCOVER_LANE_LOAD_FAILED_BODY =
  "Public Records Are Temporarily Unavailable. Please Try Again Shortly.";

export const DISCOVER_LANES: readonly DiscoverLaneMeta[] = [
  {
    id: "proven",
    title: "Proven Over Time",
    explainer:
      "Cappers With Long-Window Records And Enough Graded Picks For Stronger Context.",
    primaryLabel: "Long-Term ROI",
    empty: "No Capper Currently Meets The Long-Window Sample Requirement.",
  },
  {
    id: "verified_month",
    title: "Best Verified ROI Over 30 Days",
    explainer:
      "Recent ROI From Graded Picks That Were Odds-Verified At Submission.",
    primaryLabel: "30-Day ROI",
    empty:
      "No Capper Has Enough Verified, Graded Picks In The Current 30-Day Window.",
  },
  {
    id: "specialists",
    title: "Consistent Specialists",
    explainer:
      "Cappers With A Qualifying Record Concentrated In One Sport Or Market.",
    primaryLabel: "Specialty ROI",
    empty: "No Capper Has A Large Enough Sport Or Market Sample To Qualify.",
  },
  {
    id: "newly_credible",
    title: "Newly Credible",
    explainer:
      "Newer Cappers Whose Growing Record Was Captured From The Board At Submission.",
    primaryLabel: "Early ROI",
    empty:
      "No Newer Capper Currently Meets Both The Verification And Sample Requirements.",
  },
  {
    id: "market_beaters",
    title: "Market Beaters",
    explainer:
      "Cappers Whose Submitted Prices Have Compared Favorably With Market Closing Prices.",
    primaryLabel: "Avg CLV",
    empty: "No Capper Has Enough Closing-Line Snapshots To Qualify.",
  },
] as const;

export type DiscoverPlayRow = PlayForStats & {
  sport: string;
  market: string;
  createdAt: Date;
  gradedAt: Date | null;
  verificationTier: VerificationTier;
  clvPts: number | null;
};

export type DiscoverCapperInput = {
  summary: CapperSummary;
  plays: DiscoverPlayRow[];
};

export type DiscoverLaneEntry = {
  capper: CapperSummary;
  primaryKind: DiscoverPrimaryKind;
  primaryValue: number | null;
  primaryLabel: string;
  /** Graded sample behind the primary (lane-specific). */
  gradedSample: number;
  /** Specialty sport/market label when relevant. */
  contextLabel?: string;
};

export type DiscoverLaneResult = DiscoverLaneMeta & {
  entries: DiscoverLaneEntry[];
};

function byRoiDesc(a: DiscoverLaneEntry, b: DiscoverLaneEntry): number {
  const av = a.primaryValue ?? Number.NEGATIVE_INFINITY;
  const bv = b.primaryValue ?? Number.NEGATIVE_INFINITY;
  return (
    bv - av ||
    b.gradedSample - a.gradedSample ||
    a.capper.handle.localeCompare(b.capper.handle)
  );
}

function groupStats(
  plays: DiscoverPlayRow[],
  keyOf: (p: DiscoverPlayRow) => string,
): { key: string; settled: number; roi: number; units: number }[] {
  const grouped = new Map<string, DiscoverPlayRow[]>();
  for (const p of plays) {
    const key = keyOf(p).trim();
    if (!key) continue;
    const arr = grouped.get(key);
    if (arr) arr.push(p);
    else grouped.set(key, [p]);
  }
  return [...grouped.entries()]
    .map(([key, rows]) => {
      const stats = computeCapperStats(rows);
      return {
        key,
        settled: stats.settled,
        roi: stats.roi,
        units: stats.units,
      };
    })
    .filter((g) => g.settled > 0);
}

/**
 * Best sport or market specialty that clears signal + concentration.
 * Prefers the denser qualifying specialty by graded sample.
 */
export function pickSpecialty(
  plays: DiscoverPlayRow[],
): { label: string; roi: number; settled: number; units: number } | null {
  const gradedAll = plays.filter(
    (p) => p.outcome === "WIN" || p.outcome === "LOSS" || p.outcome === "PUSH",
  ).length;
  if (!hasSignal(gradedAll)) return null;

  const candidates = [
    ...groupStats(plays, (p) => p.sport).map((g) => ({
      ...g,
      label: g.key,
    })),
    ...groupStats(plays, (p) => p.market).map((g) => ({
      ...g,
      label: g.key,
    })),
  ].filter(
    (g) => hasSignal(g.settled) && g.settled / gradedAll >= SPECIALTY_MIN_SHARE,
  );

  if (!candidates.length) return null;
  candidates.sort(
    (a, b) =>
      b.settled - a.settled || b.roi - a.roi || a.label.localeCompare(b.label),
  );
  const best = candidates[0];
  return {
    label: best.label,
    roi: best.roi,
    settled: best.settled,
    units: best.units,
  };
}

export function buildProvenLane(
  inputs: DiscoverCapperInput[],
  limit = DISCOVER_LANE_LIMIT,
): DiscoverLaneEntry[] {
  const meta = DISCOVER_LANES[0];
  const entries: DiscoverLaneEntry[] = [];
  for (const { summary } of inputs) {
    const graded = summary.settledPicks ?? 0;
    if (graded < MATURITY.ESTABLISHED) continue;
    entries.push({
      capper: summary,
      primaryKind: "roi",
      primaryValue: summary.roi,
      primaryLabel: meta.primaryLabel,
      gradedSample: graded,
    });
  }
  return entries.sort(byRoiDesc).slice(0, limit);
}

export function buildVerifiedMonthLane(
  inputs: DiscoverCapperInput[],
  since: Date,
  limit = DISCOVER_LANE_LIMIT,
): DiscoverLaneEntry[] {
  const meta = DISCOVER_LANES[1];
  const entries: DiscoverLaneEntry[] = [];
  for (const { summary, plays } of inputs) {
    const windowed = plays.filter(
      (p) => p.createdAt >= since && isVerifiedTier(p.verificationTier),
    );
    const stats = computeCapperStats(windowed);
    if (!hasSignal(stats.settled)) continue;
    entries.push({
      capper: {
        ...summary,
        units: stats.units,
        settledPicks: stats.settled,
        roi: stats.roi,
      },
      primaryKind: "roi",
      primaryValue: stats.roi,
      primaryLabel: meta.primaryLabel,
      gradedSample: stats.settled,
    });
  }
  return entries.sort(byRoiDesc).slice(0, limit);
}

export function buildSpecialistsLane(
  inputs: DiscoverCapperInput[],
  limit = DISCOVER_LANE_LIMIT,
): DiscoverLaneEntry[] {
  const meta = DISCOVER_LANES[2];
  const entries: DiscoverLaneEntry[] = [];
  for (const { summary, plays } of inputs) {
    const specialty = pickSpecialty(plays);
    if (!specialty) continue;
    entries.push({
      capper: {
        ...summary,
        units: specialty.units,
        settledPicks: specialty.settled,
        roi: specialty.roi,
      },
      primaryKind: "roi",
      primaryValue: specialty.roi,
      primaryLabel: meta.primaryLabel,
      gradedSample: specialty.settled,
      contextLabel: specialty.label,
    });
  }
  return entries.sort(byRoiDesc).slice(0, limit);
}

/**
 * Verified share stays the *gate* here and stops being the headline.
 *
 * As an eligibility test it still does real work: it is what separates a newer
 * capper genuinely building a board-captured record from one whose sample is
 * mostly carried-over self-reported history. As a displayed number it did not,
 * because the roster is overwhelmingly legacy — so the lane led with a figure
 * that mostly reported how recently someone joined. Cappers who clear the gate
 * are now ranked and shown on ROI over that young sample, which is the thing a
 * reader is actually trying to judge.
 */
export function buildNewlyCredibleLane(
  inputs: DiscoverCapperInput[],
  limit = DISCOVER_LANE_LIMIT,
): DiscoverLaneEntry[] {
  const meta = DISCOVER_LANES[3];
  const entries: DiscoverLaneEntry[] = [];
  for (const { summary } of inputs) {
    const graded = summary.settledPicks ?? 0;
    const share = summary.verifiedShare;
    if (!hasSignal(graded)) continue;
    if (graded >= MATURITY.ESTABLISHED) continue;
    if (share == null || !Number.isFinite(share)) continue;
    if (share < NEWLY_CREDIBLE_MIN_VERIFIED_SHARE) continue;
    entries.push({
      capper: summary,
      primaryKind: "roi",
      primaryValue: summary.roi,
      primaryLabel: meta.primaryLabel,
      gradedSample: graded,
    });
  }
  return entries.sort(byRoiDesc).slice(0, limit);
}

export function buildMarketBeatersLane(
  inputs: DiscoverCapperInput[],
  limit = DISCOVER_LANE_LIMIT,
): DiscoverLaneEntry[] {
  const meta = DISCOVER_LANES[4];
  const entries: DiscoverLaneEntry[] = [];
  for (const { summary, plays } of inputs) {
    const snapshots = plays
      .filter(
        (p) =>
          isVerifiedTier(p.verificationTier) &&
          (p.outcome === "WIN" ||
            p.outcome === "LOSS" ||
            p.outcome === "PUSH") &&
          p.clvPts != null &&
          Number.isFinite(p.clvPts),
      )
      .map((p) => p.clvPts as number);
    if (!hasSignal(snapshots.length)) continue;
    const avg = snapshots.reduce((a, b) => a + b, 0) / snapshots.length;
    // “Compared favorably” = beat the close on average (pricing, not prediction).
    if (!(avg > 0)) continue;
    entries.push({
      capper: { ...summary, avgClv: avg },
      primaryKind: "clv",
      primaryValue: avg,
      primaryLabel: meta.primaryLabel,
      gradedSample: snapshots.length,
    });
  }
  entries.sort(
    (a, b) =>
      (b.primaryValue ?? Number.NEGATIVE_INFINITY) -
        (a.primaryValue ?? Number.NEGATIVE_INFINITY) ||
      b.gradedSample - a.gradedSample ||
      a.capper.handle.localeCompare(b.capper.handle),
  );
  return entries.slice(0, limit);
}

export function buildAllDiscoverLanes(
  inputs: DiscoverCapperInput[],
  now = new Date(),
): DiscoverLaneResult[] {
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const builders: Record<DiscoverLaneId, () => DiscoverLaneEntry[]> = {
    proven: () => buildProvenLane(inputs),
    verified_month: () => buildVerifiedMonthLane(inputs, since30),
    specialists: () => buildSpecialistsLane(inputs),
    newly_credible: () => buildNewlyCredibleLane(inputs),
    market_beaters: () => buildMarketBeatersLane(inputs),
  };

  return DISCOVER_LANES.map((meta) => ({
    ...meta,
    entries: builders[meta.id](),
  }));
}

/** Exported for tests — documents the signal floor used across lanes. */
export const DISCOVER_SIGNAL_FLOOR = MIN_GRADED_FOR_SIGNAL;
