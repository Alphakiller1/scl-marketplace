/**
 * Alternate game-line ladders for the expanded-event board.
 *
 * A ladder is collapsed to the rungs nearest the main line, which is the right
 * default for spreads and totals and was silently wrong for team totals: the
 * feed flags only full-game lines as featured, so a team-total ladder has no
 * main line to sort around, the fallback is plain ascending order, and 0.5 plus
 * 1.5 for both clubs fill all eight collapsed slots. The 2.5 rung sat first in
 * the hidden tail on every event.
 *
 * So pinned rungs lead the ladder and the cap is applied after them — the
 * collapsed board cannot drop a rung the owner requires, and a book that does
 * not price one still shows nothing extra.
 *
 * Pure, and deliberately here rather than inside `odds-assist.tsx`: the
 * ordering it replaces was un-exported inside that component, where nothing
 * could cover it. That is the same shape of bug this fixes (see
 * `market-kind.ts`).
 */

import { isPinnedTeamTotalLine } from "@/lib/team-total-markets";

/** Alternate ladders are long — show the nearest rungs, expand for the rest. */
export const ALT_LINE_CAP = 8;

export type AltLadderSelection = {
  market: string;
  line?: number;
};

/**
 * Ladder order: pinned rungs first, then proximity to the main line (or plain
 * ascending when the market has no featured line of its own).
 */
export function sortAltLadder<T extends AltLadderSelection>(
  market: string,
  options: readonly T[],
  mainLine?: number,
): T[] {
  const refAbs = typeof mainLine === "number" ? Math.abs(mainLine) : null;
  return [...options].sort((a, b) => {
    // Leading the sort is what survives the collapsed slice below.
    const pinned =
      Number(isPinnedTeamTotalLine(market, b.line)) -
      Number(isPinnedTeamTotalLine(market, a.line));
    if (pinned !== 0) return pinned;
    const la = Math.abs(a.line ?? 0);
    const lb = Math.abs(b.line ?? 0);
    if (refAbs !== null) return Math.abs(la - refAbs) - Math.abs(lb - refAbs);
    return la - lb;
  });
}

/**
 * The rungs to render now, plus the totals the "Show all / Show fewer" control
 * reads. `hidden` is what the collapsed view is holding back.
 */
export function splitAltLadder<T extends AltLadderSelection>(
  market: string,
  options: readonly T[],
  opts: { mainLine?: number; expanded?: boolean; cap?: number } = {},
): { visible: T[]; total: number; hidden: number } {
  const cap = opts.cap ?? ALT_LINE_CAP;
  const sorted = sortAltLadder(market, options, opts.mainLine);
  const visible = opts.expanded ? sorted : sorted.slice(0, cap);
  return {
    visible,
    total: sorted.length,
    hidden: sorted.length - visible.length,
  };
}
