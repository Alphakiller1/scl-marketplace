import type { Outcome } from "@prisma/client";

import { overUnderOutcome } from "@/lib/results/prop-resolve";
import { espnIdOf, type SettledGame } from "@/lib/results/settled-game";

/**
 * Settle player props from an ESPN box score.
 *
 * This is the last class of play that could not auto-grade. Everything here is
 * pure so the parsing — the part that actually breaks — is unit-testable; the
 * network call lives in stats-provider.ts.
 *
 * See docs/GRADING_PROPS_STATS_FEED_SPEC.md.
 */

/** One athlete's stat line, already normalised to numbers. */
export type PlayerStatLine = {
  name: string;
  team: string;
  /** Whether the athlete actually appeared. A DNP row carries no stats. */
  played: boolean;
  stats: Record<string, number>;
  /** ESPN athlete id, when the feed carries one. */
  espnId?: string;
};

export type PlayerBoxScore = {
  players: PlayerStatLine[];
  /** ESPN team ids of both clubs, used to read the game-day roster. */
  espnTeamIds?: string[];
};

const PLAYER_PROP_FIXTURE_WINDOW_MS = 90 * 60 * 1_000;

/**
 * ESPN event ids close enough to a legacy prop's scheduled start to inspect.
 *
 * A short-lived picker bug saved an Odds API event id but omitted both clubs,
 * so the normal fixture matcher cannot bind those props to results. Time alone
 * is never enough to grade one; the caller must additionally find the named
 * athlete in exactly one candidate box score. This helper only narrows the
 * safe candidate pool and de-duplicates provider copies of the same fixture.
 *
 * A play that names its clubs is never a candidate search: its own game is
 * known, so if that game has not settled the prop waits for it. Searching the
 * neighbours instead graded "Jabari Smith Jr Over 4.5 rebounds" (Rockets @
 * Hawks, still in the fourth quarter) on Jalen Smith's 3 rebounds in Wizards
 * @ Bulls, which had just finished: the surname-and-initial match found one
 * "J. Smith" among the finished games and published a LOSS. Jabari had 5.
 */
export function playerPropCandidateEventIds(
  play: Pick<
    GradablePlayerProp,
    "sport" | "eventStartsAt" | "homeTeam" | "awayTeam"
  >,
  games: readonly SettledGame[],
): string[] {
  if (play.homeTeam?.trim() || play.awayTeam?.trim()) return [];
  const startsAt = play.eventStartsAt;
  if (!startsAt) return [];

  const ids = new Set<string>();
  for (const game of games) {
    if (
      !game.completed ||
      game.sport.toUpperCase() !== play.sport.toUpperCase() ||
      !game.startsAt ||
      Math.abs(game.startsAt.getTime() - startsAt.getTime()) >
        PLAYER_PROP_FIXTURE_WINDOW_MS
    ) {
      continue;
    }
    const id = espnIdOf(game);
    if (id) ids.add(id);
  }
  return [...ids];
}

type GradablePlayerProp = {
  sport: string;
  eventStartsAt?: Date | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
};

/**
 * SCL market label → the canonical stat key produced by the ESPN mappers.
 *
 * Keys are the labels `PROP_MARKET_LABEL` puts on a play's `market`, because
 * that is what the board writes and therefore what grading reads back.
 */
const MARKET_STAT_KEY: Record<string, string> = {
  points: "points",
  rebounds: "rebounds",
  assists: "assists",
  "3-pointers": "threes",
  strikeouts: "strikeouts",
  outs: "outs",
  "earned runs": "earnedRuns",
  hits: "hits",
  "total bases": "totalBases",
  "home runs": "homeRuns",
  rbis: "rbis",
  "runs scored": "runs",
  "hits+runs+rbis": "hitsRunsRbis",
  // NOT "hits": that key is the BATTING line. A pitcher's hits allowed comes
  // from the pitching group under its own key — see STATS_BY_GROUP.
  "hits allowed": "hitsAllowed",
  // Same split as hits: the hitter's walks and strikeouts come from the batting
  // group, the pitcher's from the pitching group, and the two are different
  // numbers in the same box score.
  walks: "walks",
  "walks allowed": "walksAllowed",
  "batter strikeouts": "batterStrikeouts",
  // Mapped even though the ESPN summary does not report them today: an unmapped
  // label is a silent pass-through, while a mapped one with no column defers
  // honestly through `statValue` and starts grading itself the day a feed
  // carries the column.
  singles: "singles",
  doubles: "doubles",
  triples: "triples",
  "stolen bases": "stolenBases",
  blocks: "blocks",
  steals: "steals",
  turnovers: "turnovers",
  "pts+reb+ast": "pointsReboundsAssists",
  "pts+reb": "pointsRebounds",
  "pts+ast": "pointsAssists",
  "reb+ast": "reboundsAssists",
  // Football. Without these four the labels the board writes have no stat key,
  // so every NFL prop deferred as a prop (isDeferredProp reads the label) and
  // then sat PENDING forever, because the resolver had nothing to compare the
  // line against.
  "passing yds": "passingYards",
  "rushing yds": "rushingYards",
  "receiving yds": "receivingYards",
  receptions: "receptions",
  "pass attempts": "passAttempts",
  "passing tds": "passingTds",
  "rush attempts": "rushAttempts",
  "rush+rec yds": "rushReceivingYards",
  "fg made": "fieldGoalsMade",
  // Lineless Yes/No market. `resolvePlayerProp` handles its boolean threshold
  // explicitly because the board correctly stores no fabricated numeric line.
  "anytime touchdown": "touchdownsScored",
  // Hockey, mapped for the same reason and already parsed out of the box score
  // as `shotsOnGoal`.
  "shots on goal": "shotsOnGoal",
};

/**
 * Stat keys no feed reports directly — settled by summing components.
 *
 * A combined prop has no column of its own in a box score; it is the sum of
 * three that do. Summing here rather than in the mappers keeps the derivation in
 * one place and out of every provider.
 */
const DERIVED_STATS: Record<string, readonly string[]> = {
  pointsReboundsAssists: ["points", "rebounds", "assists"],
  pointsRebounds: ["points", "rebounds"],
  pointsAssists: ["points", "assists"],
  reboundsAssists: ["rebounds", "assists"],
  hitsRunsRbis: ["hits", "runs", "rbis"],
  rushReceivingYards: ["rushingYards", "receivingYards"],
};

/**
 * Components a box score omits for a player who simply did not do that thing.
 *
 * Basketball reports one row per player, so a missing rebounds column means the
 * feed is incomplete and the honest answer is to defer. Football reports a row
 * per GROUP: a running back with no catches has no receiving row at all, and a
 * receiver who never took a handoff has no rushing row. Deferring there would
 * leave every Rush+Rec prop pending for exactly the players the market is
 * written about.
 *
 * Absent therefore means zero for these, but only for a player the box score
 * says appeared — `resolvePlayerProp` voids a player who did not.
 */
const ZERO_WHEN_ABSENT = new Set(["rushingYards", "receivingYards"]);

/**
 * The athlete's number for a stat key, or null to defer.
 *
 * A derived stat requires EVERY component: a missing rebounds column would
 * otherwise settle a Pts+Reb+Ast play against points and assists alone, which
 * is a wrong result written confidently rather than an honest deferral.
 */
function statValue(
  stats: Record<string, number>,
  statKey: string,
): number | null {
  const components = DERIVED_STATS[statKey];
  if (!components) {
    const direct = stats[statKey];
    return typeof direct === "number" && Number.isFinite(direct)
      ? direct
      : null;
  }
  let sum = 0;
  for (const component of components) {
    const value = stats[component];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      if (ZERO_WHEN_ABSENT.has(component)) continue;
      return null;
    }
    sum += value;
  }
  return sum;
}

export function statKeyForMarket(market: string | null): string | null {
  if (!market) return null;
  return MARKET_STAT_KEY[market.trim().toLowerCase()] ?? null;
}

/** Combining diacritical marks, written as escapes so the source stays ASCII. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Strip accents, punctuation and suffixes so "Cristopher Sanchez" matches
 * ESPN's spelling, and "Michael Wacha Jr." matches "Michael Wacha".
 */
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pull the athlete's name off the front of a selection.
 *
 * Board-written selections read "Michael Wacha Over 4.5" / "Sabrina Ionescu
 * Under 19.5" — the name is everything before the Over/Under. Returns null when
 * there is no such marker, because then we cannot tell a name from a team and
 * must not guess.
 */
export function playerNameFromSelection(selection: string): string | null {
  const lined = selection.match(/^(.*?)\s+(over|under|o|u)\b/i);
  const lineless = selection.match(/^(.*?)\s+anytime touchdown\s*$/i);
  const name = (lined?.[1] ?? lineless?.[1])?.trim();
  if (!name) return null;
  // A single token is not a player name ("Team Total Over 4.5").
  if (normalizeName(name).split(" ").filter(Boolean).length < 2) return null;
  return name;
}

/**
 * Find one athlete by name. Requires a unique match: two players sharing a
 * surname must never be settled by picking the first one found.
 */
export function findPlayer(
  box: PlayerBoxScore,
  name: string,
): PlayerStatLine | null | "AMBIGUOUS" {
  const target = normalizeName(name);
  if (!target) return null;

  const exact = box.players.filter((p) => normalizeName(p.name) === target);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return "AMBIGUOUS";

  // Fall back to surname, which is how books and cappers usually shorten it
  // ("Josh" for "Joshua", "D.J." for "DJ") - but only when the first names
  // could be the same person. A surname alone graded "Joshua Palmer", who
  // played without a touch and so is absent from the box score, on whichever
  // other Palmer caught a pass; a shared initial alone took Jalen Smith's
  // rebounds for Jabari Smith Jr's. A first name that is neither a shortening
  // nor a known nickname of the other is a different player: defer.
  const tokens = target.split(" ");
  const surname = tokens.slice(-1)[0];
  // A bare surname carries no first name to check against.
  const given = tokens.length > 1 ? tokens.slice(0, -1).join("") : null;
  const bySurname = box.players.filter((p) => {
    const candidate = normalizeName(p.name).split(" ");
    return (
      candidate.slice(-1)[0] === surname &&
      (given == null || sameGivenName(given, candidate.slice(0, -1).join("")))
    );
  });
  if (bySurname.length === 1) return bySurname[0];
  return bySurname.length > 1 ? "AMBIGUOUS" : null;
}

/**
 * Common given-name forms that are not a shortening of the full name, so the
 * prefix rule below cannot see them. Missing an entry costs a manual grade;
 * a wrong one costs a wrong public result, so only unambiguous pairs belong.
 */
const GIVEN_NAME_FORMS: Record<string, string> = {
  mike: "michael",
  jake: "jacob",
  tony: "anthony",
  dave: "david",
  bob: "robert",
  bobby: "robert",
  rob: "robert",
  robbie: "robert",
  bill: "william",
  billy: "william",
  jim: "james",
  jimmy: "james",
  joe: "joseph",
  joey: "joseph",
  andy: "andrew",
  drew: "andrew",
  danny: "daniel",
  kenny: "kenneth",
  rick: "richard",
  ricky: "richard",
  tom: "thomas",
  tommy: "thomas",
  nate: "nathan",
  gabe: "gabriel",
  hank: "henry",
  ted: "theodore",
  teddy: "theodore",
};

/**
 * Could these two given names (normalised, spaces removed) be one person?
 * True for the same name, an initial ("J" / "Jabari"), a shortening ("Josh" /
 * "Joshua", "Cam" / "Cameron") or a listed nickname ("Mike" / "Michael").
 */
export function sameGivenName(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a.length === 1 || b.length === 1) return a[0] === b[0];
  const formal = (n: string) => GIVEN_NAME_FORMS[n] ?? n;
  const x = formal(a);
  const y = formal(b);
  return x.startsWith(y) || y.startsWith(x);
}

/** A club's last word ("Rockets", "Clippers"), accent-folded. */
function clubNickname(club: string): string {
  return normalizeName(club).split(" ").slice(-1)[0] ?? "";
}

/**
 * Does this stat line belong to one of the play's clubs?
 *
 * Only a full club name can be checked: a line with no team, or a bare
 * abbreviation ("HOU"), is not evidence either way and passes.
 */
function onPlayClub(
  line: PlayerStatLine,
  clubs: readonly (string | null | undefined)[],
): boolean {
  const named = clubs.map((c) => c?.trim()).filter((c): c is string => !!c);
  const team = line.team.trim();
  if (named.length === 0 || !team.includes(" ")) return true;
  const nickname = clubNickname(team);
  return named.some((club) => clubNickname(club) === nickname);
}

/** Game-day participation of a player the box score does not list. */
export type AbsentPlayerStatus = "did_not_play" | "played_no_stats";

/** Every counting stat a football prop settles on, at zero. */
const ZERO_STAT_LINE: Record<string, number> = {
  passingYards: 0,
  passAttempts: 0,
  passingTds: 0,
  rushingYards: 0,
  rushAttempts: 0,
  receptions: 0,
  receivingYards: 0,
  fieldGoalsMade: 0,
  touchdownsScored: 0,
};

/**
 * Settle a prop on a player who is missing from the box score.
 *
 * ESPN's football box score lists only players who recorded a stat, so a
 * receiver who played without a catch, and an inactive player, are both simply
 * absent - and a prop on either used to sit PENDING until a human graded it.
 * The game-day roster tells them apart (see `fetchNflParticipation`):
 *
 * - did not play (inactive, or dressed and never entered) -> VOID, the book rule;
 * - played with no stat line -> every counting stat is zero.
 */
export function resolveAbsentPlayerProp(
  play: PlayerPropPlay,
  status: AbsentPlayerStatus,
): Outcome | null {
  const statKey = statKeyForMarket(play.market);
  if (
    !statKey ||
    !(statKey in ZERO_STAT_LINE || statKey === "rushReceivingYards")
  ) {
    return null;
  }
  if (status === "did_not_play") return "VOID";
  const name = playerNameFromSelection(play.selection);
  if (!name) return null;
  return resolvePlayerProp(play, {
    players: [{ name, team: "", played: true, stats: ZERO_STAT_LINE }],
  });
}

export type PlayerPropPlay = {
  market: string | null;
  selection: string;
  side?: string | null;
  line?: number | null;
  /** The play's stored clubs; the settling stat line must be on one. */
  clubs?: readonly (string | null | undefined)[];
};

function sideFromSelection(selection: string): "over" | "under" | null {
  if (/\bunder\b|\bu\d/i.test(selection)) return "under";
  if (/\bover\b|\bo\d/i.test(selection)) return "over";
  return null;
}

/**
 * Settle one player prop, or return null to defer.
 *
 * Deferring is always preferred to guessing: an unknown market, an unfindable
 * or ambiguous player, or a missing stat all return null so the play stays
 * PENDING for a human rather than being settled wrongly.
 *
 * A player who did not appear returns VOID — the standard book rule, and
 * deterministic enough to automate. That is different from "we could not find
 * him", which defers.
 */
export function resolvePlayerProp(
  play: PlayerPropPlay,
  box: PlayerBoxScore,
): Outcome | null {
  const statKey = statKeyForMarket(play.market);
  if (!statKey) return null;

  const anytimeTouchdown = statKey === "touchdownsScored";
  const line = typeof play.line === "number" ? play.line : null;
  if (!anytimeTouchdown && line == null) return null;

  const rawSide = (play.side ?? "").trim().toLowerCase();
  const side =
    rawSide === "over" || rawSide === "o"
      ? "over"
      : rawSide === "under" || rawSide === "u"
        ? "under"
        : sideFromSelection(play.selection);
  if (!anytimeTouchdown && !side) return null;

  const name = playerNameFromSelection(play.selection);
  if (!name) return null;

  const found = findPlayer(box, name);
  if (found === "AMBIGUOUS" || !found) return null;
  // A player on neither of the play's clubs means the box score is another
  // game's, however it was reached: never settle on it.
  if (play.clubs && !onPlayClub(found, play.clubs)) return null;
  if (!found.played) return "VOID";

  const actual = statValue(found.stats, statKey);
  if (actual == null) return null;

  if (anytimeTouchdown) {
    const wantsNo = rawSide === "no";
    const scored = actual > 0;
    return scored === !wantsNo ? "WIN" : "LOSS";
  }

  return overUnderOutcome(actual, line!, side!);
}
