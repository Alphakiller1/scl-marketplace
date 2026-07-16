import { RESULTS_LOOKBACK_DAYS } from "@/lib/results/lookback";
import {
  findGame,
  isDeferredProp,
  type GradablePlay,
} from "@/lib/results/match";
import type { SettledGame } from "@/lib/results/settled-game";

export type { SettledGame };
export { RESULTS_LOOKBACK_DAYS };

/** Why a pending play was not auto-graded this run. */
export type SkipReason =
  | "props_deferred"
  | "event_not_found"
  | "aged_out"
  | "market_unhandled";

export type SkipReasonCounts = Record<SkipReason, number>;

export function emptySkipCounts(): SkipReasonCounts {
  return {
    props_deferred: 0,
    event_not_found: 0,
    aged_out: 0,
    market_unhandled: 0,
  };
}

export function lookbackCutoff(
  now: Date,
  lookbackDays = RESULTS_LOOKBACK_DAYS,
): Date {
  return new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
}

/** True when event start is older than the scores provider lookback window. */
export function isAgedOut(
  eventStartsAt: Date | null | undefined,
  now: Date,
  lookbackDays = RESULTS_LOOKBACK_DAYS,
): boolean {
  if (eventStartsAt == null) return false;
  return eventStartsAt.getTime() < lookbackCutoff(now, lookbackDays).getTime();
}

/**
 * Classify a failed resolve (outcome null) or deferred prop.
 * `gameFound` must reflect whether a settled game was matched in the batch.
 */
export function classifySkipReason(opts: {
  play: GradablePlay & { eventStartsAt?: Date | null };
  gameFound: boolean;
  now: Date;
  lookbackDays?: number;
}): SkipReason {
  if (isDeferredProp(opts.play)) return "props_deferred";
  if (
    isAgedOut(opts.play.eventStartsAt, opts.now, opts.lookbackDays) &&
    !opts.gameFound
  ) {
    return "aged_out";
  }
  if (!opts.gameFound) return "event_not_found";
  return "market_unhandled";
}

export function findSettledGame(
  play: GradablePlay,
  games: SettledGame[],
): SettledGame | null {
  return findGame(play, games);
}
