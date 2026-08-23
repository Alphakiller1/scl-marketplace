import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findGame,
  isAutoGradeBlocked,
  isDeferredProp,
  resolveOutcome,
  type GradablePlay,
} from "@/lib/results/match";
import type { SettledGame } from "@/lib/results/settled-game";

/**
 * Regression cover for a live mis-grade: board-entered player props were being
 * settled against the game's combined final score.
 */

test("board-entered player props defer instead of grading as a game total", () => {
  // The exact rows that lost in production while winning in reality: the board
  // stores the display label ("Points"), and its selection text names no stat.
  const ionescu: GradablePlay = {
    id: "p1",
    sport: "WNBA",
    market: "Points",
    selection: "Sabrina Ionescu Under 19.5",
    oddsAmerican: -114,
    units: 2,
    side: "Under",
    line: 19.5,
  };
  assert.equal(isDeferredProp(ionescu), true);

  const keller: GradablePlay = {
    id: "p2",
    sport: "MLB",
    market: "Outs",
    selection: "Mitch Keller Over 15.5",
    oddsAmerican: 123,
    units: 1,
    side: "Over",
    line: 15.5,
  };
  assert.equal(isDeferredProp(keller), true);

  // Nothing may settle them off a final score, whatever the scoreline.
  const game: SettledGame = {
    sport: "WNBA",
    eventId: "e1",
    home: "New York Liberty",
    away: "Seattle Storm",
    homeScore: 92,
    awayScore: 86,
    startsAt: undefined,
    completed: true,
  };
  assert.equal(resolveOutcome(ionescu, [game]), null);
});

test("team totals are not graded as game totals", () => {
  const teamTotal: GradablePlay = {
    id: "p3",
    sport: "MLB",
    market: "Total",
    selection: "Nationals TT O4.5",
    oddsAmerican: -110,
    units: 1,
  };
  assert.equal(isDeferredProp(teamTotal), true);
});

test("real game totals still grade", () => {
  const gameTotal: GradablePlay = {
    id: "p4",
    sport: "MLB",
    market: "Total",
    selection: "Under 8.5",
    oddsAmerican: 105,
    units: 1,
    eventId: "e2",
  };
  assert.equal(isDeferredProp(gameTotal), false);
  const game: SettledGame = {
    sport: "MLB",
    eventId: "e2",
    home: "Reds",
    away: "Athletics",
    homeScore: 3,
    awayScore: 2,
    startsAt: undefined,
    completed: true,
  };
  assert.equal(resolveOutcome(gameTotal, [game]), "WIN"); // 5 < 8.5
});

test("a bare total binds to its game through the stored fixture", () => {
  // "Over 7 total" names no team, so nothing in the selection can find a game.
  // The legacy source rows carry Home/Away; carrying them through is the only
  // thing that makes such a play gradable.
  const play: GradablePlay = {
    id: "p1",
    sport: "MLB",
    market: "Custom",
    selection: "Over 7 total (-117)",
    oddsAmerican: -117,
    units: 2.34,
    homeTeam: "Milwaukee Brewers",
    awayTeam: "Pittsburgh Pirates",
    createdAt: new Date("2026-08-05T23:40:00Z"),
  };
  const games: SettledGame[] = [
    {
      sport: "MLB",
      eventId: "other",
      home: "Cincinnati Reds",
      away: "Athletics",
      homeScore: 3,
      awayScore: 2,
      completed: true,
      startsAt: new Date("2026-08-05T22:40:00Z"),
    },
    {
      sport: "MLB",
      eventId: "brewers",
      home: "Milwaukee Brewers",
      away: "Pittsburgh Pirates",
      homeScore: 5,
      awayScore: 3,
      completed: true,
      startsAt: new Date("2026-08-05T23:40:00Z"),
    },
  ];
  assert.equal(findGame(play, games)?.eventId, "brewers");
  assert.equal(resolveOutcome(play, games), "WIN"); // 8 runs > 7
});

test("Red Sox and White Sox are told apart", () => {
  // Both clubs end in "Sox", so the last-token fallback matched BOTH sides of
  // the same game and the matcher refused to pick one.
  const game: SettledGame = {
    sport: "MLB",
    eventId: "bos",
    home: "Boston Red Sox",
    away: "Chicago White Sox",
    homeScore: 6,
    awayScore: 1,
    completed: true,
    startsAt: new Date("2026-08-04T23:10:00Z"),
  };
  const play: GradablePlay = {
    id: "p2",
    sport: "MLB",
    market: "Custom",
    selection: "Red sox moneyline (-125)",
    oddsAmerican: -125,
    units: 2.5,
    createdAt: new Date("2026-08-04T23:10:00Z"),
  };
  assert.equal(resolveOutcome(play, [game]), "WIN");
  assert.equal(
    resolveOutcome({ ...play, selection: "White sox moneyline" }, [game]),
    "LOSS",
  );
});

// ── team totals ──────────────────────────────────────────────────────────────
//
// A team total prices ONE club's runs. The game-total resolver keys off
// `market.includes("total")`, and "Team Total" contains it — so the danger is
// not that these fail to grade, it is that they grade against the combined
// score and win almost every time.

const TT_GAME: SettledGame = {
  sport: "MLB",
  home: "Washington Nationals",
  away: "Atlanta Braves",
  homeScore: 3,
  awayScore: 2,
  completed: true,
  eventId: "tt-evt",
};

function teamTotal(selection: string): GradablePlay {
  return {
    id: "tt",
    sport: "MLB",
    market: "Team Total",
    selection,
    oddsAmerican: -110,
    units: 1,
    eventId: "tt-evt",
  };
}

test("a team total settles against that club's own score, not the game's", () => {
  // Nationals scored 3. Combined is 5 — the number that would make this a WIN
  // if it ever reached the game-total branch.
  assert.equal(
    resolveOutcome(teamTotal("Washington Nationals Over 4.5"), [TT_GAME]),
    "LOSS",
  );
  assert.equal(
    resolveOutcome(teamTotal("Washington Nationals Under 4.5"), [TT_GAME]),
    "WIN",
  );
});

test("a team total reads the away club independently", () => {
  // Braves scored 2.
  assert.equal(
    resolveOutcome(teamTotal("Atlanta Braves Over 1.5"), [TT_GAME]),
    "WIN",
  );
  assert.equal(
    resolveOutcome(teamTotal("Atlanta Braves Over 2.5"), [TT_GAME]),
    "LOSS",
  );
});

test("a team total on the exact number pushes", () => {
  assert.equal(
    resolveOutcome(teamTotal("Washington Nationals Over 3"), [TT_GAME]),
    "PUSH",
  );
});

test("canonical team totals grade; free-text ones still defer", () => {
  assert.equal(
    isDeferredProp(teamTotal("Washington Nationals Over 4.5")),
    false,
  );
  // Cannot be resolved to a club without guessing — stays PENDING.
  assert.equal(isDeferredProp(teamTotal("Nats TT O4.5")), true);
  assert.equal(resolveOutcome(teamTotal("Nats TT O4.5"), [TT_GAME]), null);
});

test("a team total naming neither club refuses to grade", () => {
  assert.equal(
    resolveOutcome(teamTotal("Chicago Cubs Over 4.5"), [TT_GAME]),
    null,
  );
});

test("the game total is unaffected by team-total handling", () => {
  const gameTotal: GradablePlay = {
    id: "gt",
    sport: "MLB",
    market: "Total",
    selection: "Over 4.5",
    oddsAmerican: -110,
    units: 1,
    eventId: "tt-evt",
  };
  // 3 + 2 = 5 combined.
  assert.equal(resolveOutcome(gameTotal, [TT_GAME]), "WIN");
});

// ── tennis ───────────────────────────────────────────────────────────────────
// Tennis reached the grader for the first time when the scores fetch learned to
// request per-tournament keys. The feed gives two numbers per match; only their
// ORDER is safe to read, because whether they count sets or games is not stated.
const TENNIS_MATCH: SettledGame = {
  sport: "TENNIS",
  home: "Iga Swiatek",
  away: "Emiliana Arango",
  homeScore: 2,
  awayScore: 0,
  completed: true,
  eventId: "tennis-evt",
};

function tennisPlay(market: string, selection: string): GradablePlay {
  return {
    id: `tennis-${market}`,
    sport: "TENNIS",
    market,
    selection,
    oddsAmerican: -200,
    units: 1,
    eventId: "tennis-evt",
  };
}

test("a tennis moneyline grades from the winner", () => {
  assert.equal(
    resolveOutcome(tennisPlay("Moneyline", "Iga Swiatek"), [TENNIS_MATCH]),
    "WIN",
  );
  assert.equal(
    resolveOutcome(tennisPlay("Moneyline", "Emiliana Arango"), [TENNIS_MATCH]),
    "LOSS",
  );
});

// The whole reason for the guard: -7.5 is a GAMES handicap. Against a 2-0 set
// score it reads as a 2-game margin and books a confident LOSS on a bet that
// cleared by nine. Deferring leaves it PENDING for a human instead.
test("a tennis games spread defers rather than settling against set scores", () => {
  assert.equal(
    resolveOutcome(tennisPlay("Spread", "Iga Swiatek -7.5"), [TENNIS_MATCH]),
    null,
  );
  assert.equal(
    isAutoGradeBlocked(tennisPlay("Spread", "Iga Swiatek -7.5")),
    true,
  );
  assert.equal(
    isAutoGradeBlocked(tennisPlay("Moneyline", "Iga Swiatek")),
    false,
  );
  assert.equal(isAutoGradeBlocked({ sport: "CFL", market: "Spread" }), false);
});

test("a tennis total defers for the same reason", () => {
  assert.equal(
    resolveOutcome(tennisPlay("Total", "Over 20.5"), [TENNIS_MATCH]),
    null,
  );
});

// The guard is scoped to tennis — it must not touch the sports that grade today.
test("the tennis guard does not affect other sports' spreads", () => {
  const mlbSpread: GradablePlay = {
    id: "mlb-spread",
    sport: "MLB",
    market: "Spread",
    // Nationals won 3-2, so -1.5 does not cover: a real LOSS, not a defer.
    selection: "Washington Nationals -1.5",
    eventId: "tt-evt",
    oddsAmerican: -110,
    units: 1,
  };
  assert.equal(resolveOutcome(mlbSpread, [TT_GAME]), "LOSS");
});

test("draw/tie selections grade on soccer 3-way moneylines", () => {
  const drawGame: SettledGame[] = [
    {
      sport: "SOCCER",
      home: "Arsenal",
      away: "Chelsea",
      homeScore: 1,
      awayScore: 1,
      completed: true,
      eventId: "soc-1",
    },
  ];
  const drawPick: GradablePlay = {
    id: "draw",
    sport: "SOCCER",
    market: "Moneyline",
    selection: "Draw",
    oddsAmerican: 240,
    units: 1,
    eventId: "soc-1",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
  };
  const homePick: GradablePlay = {
    id: "home",
    sport: "SOCCER",
    market: "Moneyline",
    selection: "Arsenal",
    oddsAmerican: -120,
    units: 1,
    eventId: "soc-1",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
  };

  assert.equal(resolveOutcome(drawPick, drawGame), "WIN");
  assert.equal(resolveOutcome(homePick, drawGame), "LOSS");
});

test("an MMA moneyline grades from the winner flag scores", () => {
  const fight: SettledGame = {
    sport: "MMA",
    home: "Islam Makhachev",
    away: "Ian Machado Garry",
    homeScore: 1,
    awayScore: 0,
    completed: true,
    eventId: "espn:401905000",
  };
  assert.equal(
    resolveOutcome(
      {
        id: "mma-ml",
        sport: "MMA",
        market: "Moneyline",
        selection: "Islam Makhachev",
        oddsAmerican: -180,
        units: 1,
        eventId: "espn:401905000",
      },
      [fight],
    ),
    "WIN",
  );
  assert.equal(
    resolveOutcome(
      {
        id: "mma-ml-dog",
        sport: "MMA",
        market: "Moneyline",
        selection: "Ian Machado Garry",
        oddsAmerican: 150,
        units: 1,
        eventId: "espn:401905000",
      },
      [fight],
    ),
    "LOSS",
  );
});

test("a tennis moneyline still binds when ESPN starts 105 minutes late", () => {
  // Production: @vision_vulture7 Coco Gauff −375, Odds API commence
  // 2026-08-22T23:30Z. ESPN Cincinnati SF stamped 2026-08-23T01:15Z (105 min
  // later). The 90-minute bound window used for baseball nightcaps dropped
  // the final, so findGame returned null after Fils/Pegula had already graded.
  const scheduled = new Date("2026-08-22T23:30:00.000Z");
  const espnStart = new Date("2026-08-23T01:15:00.000Z");
  const espnMatch: SettledGame = {
    sport: "TENNIS",
    home: "Sara Bejlek",
    away: "Coco Gauff",
    homeScore: 0,
    awayScore: 1,
    completed: true,
    eventId: "espn:182418",
    startsAt: espnStart,
  };
  const play: GradablePlay = {
    id: "cmt4ihz2c0005lb04qenw7l24",
    sport: "TENNIS",
    market: "Moneyline",
    selection: "Coco Gauff",
    oddsAmerican: -375,
    units: 5,
    eventId: "f4cffdce3d1effa9d1e21997f18c98f7",
    eventStartsAt: scheduled,
    homeTeam: "Sara Bejlek",
    awayTeam: "Coco Gauff",
  };

  assert.equal(findGame(play, [espnMatch])?.eventId, "espn:182418");
  assert.equal(resolveOutcome(play, [espnMatch]), "WIN");
});

test("DFB-Pokal moneylines bind ESPN cup names to the board clubs", () => {
  const kickoff = new Date("2026-08-23T16:00:00.000Z");
  const essen: SettledGame = {
    sport: "SOCCER",
    home: "Rot-Weiss Essen",
    away: "St. Pauli",
    homeScore: 2,
    awayScore: 0,
    completed: true,
    eventId: "espn:pokal-essen",
    startsAt: kickoff,
  };
  const freiburg: SettledGame = {
    sport: "SOCCER",
    home: "Fortuna Düsseldorf",
    away: "SC Freiburg",
    homeScore: 1,
    awayScore: 5,
    completed: true,
    eventId: "espn:pokal-freiburg",
    startsAt: kickoff,
  };
  const pauli: GradablePlay = {
    id: "cmt5yjr0p0003jo048mdka2j2",
    sport: "SOCCER",
    market: "Moneyline",
    selection: "FC St. Pauli",
    oddsAmerican: 115,
    units: 1,
    eventId: "8bbdec0bd34dfd96a2b49e39f714dfec",
    eventStartsAt: kickoff,
    homeTeam: "Rot-Weiss Essen",
    awayTeam: "FC St. Pauli",
  };
  const sc: GradablePlay = {
    id: "cmt5yjrc60005jo04c8ahhq26",
    sport: "SOCCER",
    market: "Moneyline",
    selection: "SC Freiburg",
    oddsAmerican: -200,
    units: 1,
    eventId: "a4f34d64d2ec584dfae40bda70ec8002",
    eventStartsAt: kickoff,
    homeTeam: "Fortuna Dusseldorf",
    awayTeam: "SC Freiburg",
  };

  assert.equal(findGame(pauli, [essen, freiburg])?.eventId, "espn:pokal-essen");
  assert.equal(resolveOutcome(pauli, [essen, freiburg]), "LOSS");
  assert.equal(findGame(sc, [essen, freiburg])?.eventId, "espn:pokal-freiburg");
  assert.equal(resolveOutcome(sc, [essen, freiburg]), "WIN");
});

test("UFC Sergey Spivak matches ESPN Serghei Spivac across providers", () => {
  // Production: @vision_vulture7 Petrino and @cashtheticket365 Spivak,
  // Odds API event id, start 2026-08-23T00:00Z. ESPN already had
  // Vitor Petrino def. Serghei Spivac FINAL. Last names share no token,
  // so findGame returned null → event_not_found and the cron 503'd.
  const start = new Date("2026-08-23T00:00:00.000Z");
  const espnFight: SettledGame = {
    sport: "MMA",
    home: "Vitor Petrino",
    away: "Serghei Spivac",
    homeScore: 1,
    awayScore: 0,
    completed: true,
    eventId: "espn:401905285",
    startsAt: start,
  };
  const petrino: GradablePlay = {
    id: "cmt4y0mhl0001in04ujy72iod",
    sport: "MMA",
    market: "Moneyline",
    selection: "Vitor Petrino",
    oddsAmerican: -170,
    units: 1,
    eventId: "97b2100edfd0274e695646adcdbaeb21",
    eventStartsAt: start,
    homeTeam: "Vitor Petrino",
    awayTeam: "Sergey Spivak",
  };
  const spivak: GradablePlay = {
    id: "cmt4ehdgd0003ic04p5h1au4g",
    sport: "MMA",
    market: "Moneyline",
    selection: "Sergey Spivak",
    oddsAmerican: 142,
    units: 1,
    eventId: "97b2100edfd0274e695646adcdbaeb21",
    eventStartsAt: start,
    homeTeam: "Vitor Petrino",
    awayTeam: "Sergey Spivak",
  };

  assert.equal(findGame(petrino, [espnFight])?.eventId, "espn:401905285");
  assert.equal(resolveOutcome(petrino, [espnFight]), "WIN");
  assert.equal(findGame(spivak, [espnFight])?.eventId, "espn:401905285");
  assert.equal(resolveOutcome(spivak, [espnFight]), "LOSS");
});

test("soccer Inter Milan matches ESPN Internazionale across providers", () => {
  // Production: two @betitsimple parlay legs, Odds API event id, kickoff
  // 2026-08-22T16:30Z. ESPN already had Internazionale 4-1 Monza FT. The
  // names share no token, so findGame returned null → event_not_found.
  const start = new Date("2026-08-22T16:30:00.000Z");
  const espnGame: SettledGame = {
    sport: "SOCCER",
    home: "Internazionale",
    away: "Monza",
    homeScore: 4,
    awayScore: 1,
    completed: true,
    eventId: "espn:401874931",
    startsAt: start,
  };
  const play: GradablePlay = {
    id: "cmt2gf3420005jo046lwskqww",
    sport: "SOCCER",
    market: "Moneyline",
    selection: "Inter Milan",
    oddsAmerican: -600,
    units: 0,
    eventId: "ef8a47c3c8c0f71a251e2efcbf84854a",
    eventStartsAt: start,
    homeTeam: "Inter Milan",
    awayTeam: "Monza",
  };

  assert.equal(findGame(play, [espnGame])?.eventId, "espn:401874931");
  assert.equal(resolveOutcome(play, [espnGame]), "WIN");
});

test("Inter Miami is not graded from an Internazionale final", () => {
  const start = new Date("2026-08-22T16:30:00.000Z");
  const espnGame: SettledGame = {
    sport: "SOCCER",
    home: "Internazionale",
    away: "Monza",
    homeScore: 4,
    awayScore: 1,
    completed: true,
    eventId: "espn:401874931",
    startsAt: start,
  };

  assert.equal(
    findGame(
      {
        id: "miami",
        sport: "SOCCER",
        market: "Moneyline",
        selection: "Inter Miami",
        oddsAmerican: -110,
        units: 1,
        eventId: "odds-miami",
        eventStartsAt: start,
        homeTeam: "Inter Miami",
        awayTeam: "Atlanta United",
      },
      [espnGame],
    ),
    null,
  );
});
