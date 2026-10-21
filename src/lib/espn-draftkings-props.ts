/**
 * DraftKings player props as ESPN publishes them, for players the Odds API
 * does not carry.
 *
 * On 2026-10-21 the Odds API priced fourteen players on Mavericks–Rockets at
 * all five pick-form books, DraftKings included. DraftKings itself priced
 * fifteen: Marcus Smart's points, assists, combo and milestone lines were on
 * ESPN's DraftKings feed (casino 100) all day and never in the provider's
 * response, so no amount of re-buying could put him on the board.
 *
 * This source fills that gap and nothing else. It only supplies rows for a
 * player with no row on the board at all — a player the provider does carry is
 * never repriced or extended from here — and it costs no Odds API credits.
 *
 * Sides: ESPN lists each over/under as two rows with no side marker. The first
 * row is the Over. Measured 2026-10-21 against the Odds API's own DraftKings
 * prices on the same lines, 9 of 9 pairs matched in that order, including the
 * lopsided ones (Durant rebounds 5.5 at +120 / -158, Sengun assists 4.5 at
 * -140 / +106). A pair that is not exactly two rows is dropped, never guessed.
 * Milestones ("6+") are one-sided, and read as the Over on the half-point
 * below (Over 5.5), the same rung the Odds API's `_alternate` keys carry.
 */

import type { OddsSelection } from "@/lib/odds-board";
import { propMarketLabel } from "@/lib/odds-verify";
import { normalizeName } from "@/lib/results/player-props";

/** Leagues this source fills, keyed to ESPN's league slug. */
export const ESPN_PROP_FILL_LEAGUES: Readonly<Record<string, string>> = {
  NBA: "nba",
  WNBA: "wnba",
};

/** ESPN's id for DraftKings. */
export const ESPN_DRAFTKINGS_CASINO_ID = 100;

const DRAFTKINGS_BOOK = "draftkings";

/** ESPN over/under prop types → the Odds API key the board labels them by. */
const TOTAL_TYPES: Readonly<Record<string, string>> = {
  "Total Points": "player_points",
  "Total Rebounds": "player_rebounds",
  "Total Assists": "player_assists",
  "Total 3-Point Field Goals": "player_threes",
  "Total Blocks": "player_blocks",
  "Total Steals": "player_steals",
  "Total Turnovers": "player_turnovers",
  "Total Points, Rebounds, and Assists": "player_points_rebounds_assists",
  "Total Points and Rebounds": "player_points_rebounds",
  "Total Points and Assists": "player_points_assists",
  "Total Assists and Rebounds": "player_rebounds_assists",
};

/** ESPN one-sided "N+" ladders → the same keys. Period ladders are absent. */
const MILESTONE_TYPES: Readonly<Record<string, string>> = {
  "Points Milestones": "player_points",
  "Rebounds Milestones": "player_rebounds",
  "Assists Milestones": "player_assists",
  "3-Point Field Goals Milestones": "player_threes",
  "Blocks Milestones": "player_blocks",
  "Steals Milestones": "player_steals",
  "Points + Assists + Rebounds Milestones": "player_points_rebounds_assists",
  "Points + Rebounds Milestones": "player_points_rebounds",
  "Points + Assists Milestones": "player_points_assists",
  "Rebounds + Assists Milestones": "player_rebounds_assists",
  "Assists + Rebounds Milestones": "player_rebounds_assists",
};

/** The fields of one ESPN `propBets` item this source reads. */
export type EspnPropItem = {
  athlete?: { $ref?: string };
  type?: { name?: string };
  odds?: { american?: { value?: string } };
  current?: { target?: { value?: number; displayValue?: string } };
  lastUpdated?: string;
};

function athleteId(item: EspnPropItem): string | null {
  return item.athlete?.$ref?.match(/athletes\/(\d+)/)?.[1] ?? null;
}

function americanPrice(item: EspnPropItem): number | null {
  const raw = item.odds?.american?.value?.trim();
  if (!raw) return null;
  const price = Number(raw.replace(/^\+/, ""));
  return Number.isInteger(price) && Math.abs(price) >= 100 ? price : null;
}

function capturedAt(item: EspnPropItem): string | undefined {
  const at = item.lastUpdated ? Date.parse(item.lastUpdated) : Number.NaN;
  return Number.isFinite(at) ? new Date(at).toISOString() : undefined;
}

function row(
  player: string,
  market: string,
  side: "Over" | "Under",
  line: number,
  price: number,
  at: string | undefined,
): OddsSelection {
  const text = `${player} ${side} ${line}`;
  return {
    label: text,
    market,
    selection: text,
    side,
    line,
    player,
    featured: false,
    oddsAmerican: price,
    book: DRAFTKINGS_BOOK,
    bookPrices: { [DRAFTKINGS_BOOK]: price },
    ...(at
      ? { bookCapturedAt: { [DRAFTKINGS_BOOK]: at }, oddsCapturedAt: at }
      : {}),
  };
}

/**
 * Board rows for every player in `names`, built from ESPN's DraftKings items.
 *
 * `names` maps ESPN athlete id → display name; an athlete missing from it is
 * skipped rather than shown under an id. Where a milestone and an over/under
 * land on the same rung, the over/under's price wins.
 */
export function espnDraftKingsPropRows(
  items: readonly EspnPropItem[],
  names: ReadonlyMap<string, string>,
): OddsSelection[] {
  const totals = new Map<
    string,
    { player: string; market: string; line: number; prices: number[] }
  >();
  const totalsAt = new Map<string, string | undefined>();
  const milestones: OddsSelection[] = [];
  for (const item of items) {
    const id = athleteId(item);
    const player = id ? names.get(id) : undefined;
    const typeName = item.type?.name?.trim() ?? "";
    const value = item.current?.target?.value;
    const price = americanPrice(item);
    if (!player || value == null || !Number.isFinite(value) || price == null) {
      continue;
    }
    const totalKey = TOTAL_TYPES[typeName];
    if (totalKey) {
      const market = propMarketLabel(totalKey);
      if (!market) continue;
      const key = `${id}|${market}|${value}`;
      const pair = totals.get(key) ?? {
        player,
        market,
        line: value,
        prices: [],
      };
      pair.prices.push(price);
      totals.set(key, pair);
      if (!totalsAt.has(key)) totalsAt.set(key, capturedAt(item));
      continue;
    }
    const milestoneKey = MILESTONE_TYPES[typeName];
    if (milestoneKey) {
      const market = propMarketLabel(milestoneKey);
      const display = item.current?.target?.displayValue?.trim() ?? "";
      if (!market || !display.endsWith("+") || !Number.isInteger(value)) {
        continue;
      }
      milestones.push(
        row(player, market, "Over", value - 0.5, price, capturedAt(item)),
      );
    }
  }

  const rows: OddsSelection[] = [];
  const seen = new Set<string>();
  const add = (selection: OddsSelection) => {
    const key = `${normalizeName(selection.player ?? "")}|${selection.market}|${selection.side}|${selection.line}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(selection);
  };
  for (const [key, pair] of totals) {
    // Over first, Under second — see the module note. Anything else is not a
    // pair this source can read.
    if (pair.prices.length !== 2) continue;
    const at = totalsAt.get(key);
    add(row(pair.player, pair.market, "Over", pair.line, pair.prices[0]!, at));
    add(row(pair.player, pair.market, "Under", pair.line, pair.prices[1]!, at));
  }
  milestones.forEach(add);
  return rows;
}

/**
 * Only the rows for players the board has no row for at all.
 *
 * Names are compared the way grading compares them, so "Jabari Smith Jr."
 * from ESPN and "Jabari Smith Jr" from the Odds API are one player.
 */
export function rowsForPlayersMissingFromBoard(
  board: readonly OddsSelection[],
  rows: readonly OddsSelection[],
): OddsSelection[] {
  const onBoard = new Set(
    board
      .map((selection) => selection.player)
      .filter((player): player is string => Boolean(player))
      .map(normalizeName),
  );
  return rows.filter(
    (selection) =>
      selection.player != null && !onBoard.has(normalizeName(selection.player)),
  );
}

/** The ESPN club nickname ("Trail Blazers") a provider team name ends with. */
export function teamNameMatches(providerName: string, espnNickname: string) {
  const team = providerName.trim().toLowerCase();
  const nickname = espnNickname.trim().toLowerCase();
  return (
    nickname.length > 0 && (team === nickname || team.endsWith(` ${nickname}`))
  );
}
