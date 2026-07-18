/**
 * Discover curated lanes — pure selection + copy.
 * Eligibility mirrors public-listed leaderboard profiles; sample gates use
 * MIN_GRADED_FOR_SIGNAL / MATURITY. Never fabricate rows to fill a lane.
 */

import type { CapperSummary } from "@/lib/mock";
import { MATURITY, MIN_GRADED_FOR_SIGNAL, hasSignal } from "@/lib/sample";
import { computeCapperStats, type PlayForStats } from "@/lib/stats";
import { isVerifiedTier, type VerificationTier } from "@/lib/verification";

export const DISCOVER_LANE_LIMIT = 8;

/** High verified-share bar for “Newly credible”. */
export const NEWLY_CREDIBLE_MIN_VERIFIED_SHARE = 70;

/** Specialty must be a meaningful share of the graded book. */
export const SPECIALTY_MIN_SHARE = 0.5;

export type DiscoverLaneId =
  | "proven"
  | "verified_month"
  | "specialists"
  | "newly_credible"
  | "market_beaters";

export type DiscoverPrimaryKind = "roi" | "clv" | "verifiedShare";

export type DiscoverLaneMeta = {
  id: DiscoverLaneId;
  title: string;
  explainer: string;
  primaryLabel: string;
  empty: string;
};

export const DISCOVER_LANES: readonly DiscoverLaneMeta[] = [
  {
    id: "proven",
    title: "Proven over time",
    explainer:
      "Cappers with long-window records and enough graded picks for stronger context.",
    primaryLabel: "Long-term ROI",
    empty: "No capper currently meets the long-window sample requirement.",
  },
  {
    id: "verified_month",
    title: "Best verified ROI this month",
    explainer:
      "Recent ROI from graded picks that were board-verified at submission.",
    primaryLabel: "30-day ROI",
    empty:
      "No capper has enough verified, graded picks in the current 30-day window.",
  },
  {
    id: "specialists",
    title: "Consistent specialists",
    explainer:
      "Cappers with a qualifying record concentrated in one sport or market.",
    primaryLabel: "Specialty ROI",
    empty: "No capper has a large enough sport or market sample to qualify.",
  },
  {
    id: "newly_credible",
    title: "Newly credible",
    explainer:
      "Newer cappers with high submission verification and a growing graded record.",
    primaryLabel: "Verified share",
    empty:
      "No newer capper currently meets both the verification and sample requirements.",
  },
  {
    id: "market_beaters",
    title: "Market beaters",
    explainer:
      "Cappers whose submitted prices have compared favorably with market closing prices.",
    primaryLabel: "Avg CLV",
    empty: "No capper has enough closing-line snapshots to qualify.",
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
): { label: string; roi: number; settled: number } | null {
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
  return { label: best.label, roi: best.roi, settled: best.settled };
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
      capper: summary,
      primaryKind: "roi",
      primaryValue: specialty.roi,
      primaryLabel: meta.primaryLabel,
      gradedSample: specialty.settled,
      contextLabel: specialty.label,
    });
  }
  return entries.sort(byRoiDesc).slice(0, limit);
}

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
      primaryKind: "verifiedShare",
      primaryValue: share,
      primaryLabel: meta.primaryLabel,
      gradedSample: graded,
    });
  }
  entries.sort(
    (a, b) =>
      (b.primaryValue ?? 0) - (a.primaryValue ?? 0) ||
      b.gradedSample - a.gradedSample ||
      a.capper.handle.localeCompare(b.capper.handle),
  );
  return entries.slice(0, limit);
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
