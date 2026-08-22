import assert from "node:assert/strict";
import { test } from "node:test";

import { RESULTS_LOOKBACK_DAYS } from "@/lib/results/lookback";
import {
  classifySkipReason,
  isAgedOut,
  lookbackCutoff,
  type SkipReason,
} from "@/lib/results/skip-reason";
import type { GradablePlay } from "@/lib/results/match";

function play(p: Partial<GradablePlay> = {}): GradablePlay {
  return {
    id: "p1",
    sport: "MLB",
    market: "Moneyline",
    selection: "Yankees",
    oddsAmerican: -110,
    units: 1,
    eventId: "evt-1",
    ...p,
  };
}

const NOW = new Date("2026-07-16T12:00:00.000Z");

test("RESULTS_LOOKBACK_DAYS is the Odds API scores max (3)", () => {
  assert.equal(RESULTS_LOOKBACK_DAYS, 3);
});

test("isAgedOut: boundary — exactly at cutoff is not aged out", () => {
  const cutoff = lookbackCutoff(NOW);
  assert.equal(isAgedOut(cutoff, NOW), false);
  assert.equal(isAgedOut(new Date(cutoff.getTime() - 1), NOW), true);
});

test("classifySkipReason: a prop without a settled fixture is event_not_found", () => {
  const reason = classifySkipReason({
    play: play({ market: "Player Prop", selection: "Player Points 25.5" }),
    gameFound: false,
    now: NOW,
  });
  assert.equal(reason, "event_not_found");
});

test("classifySkipReason: props_deferred only after its fixture is found", () => {
  const reason = classifySkipReason({
    play: play({ market: "Player Prop", selection: "Player Points 25.5" }),
    gameFound: true,
    now: NOW,
  });
  assert.equal(reason, "props_deferred");
});

test("classifySkipReason: aged_out when outside lookback and no game", () => {
  const starts = new Date(NOW.getTime() - 4 * 24 * 60 * 60 * 1000);
  const reason = classifySkipReason({
    play: { ...play(), eventStartsAt: starts },
    gameFound: false,
    now: NOW,
  });
  assert.equal(reason, "aged_out" as SkipReason);
});

test("classifySkipReason: event_not_found inside lookback window", () => {
  const starts = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000);
  const reason = classifySkipReason({
    play: { ...play(), eventStartsAt: starts },
    gameFound: false,
    now: NOW,
  });
  assert.equal(reason, "event_not_found");
});

test("classifySkipReason: a recently started game is awaiting_final, not failed", () => {
  const starts = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);
  const reason = classifySkipReason({
    play: { ...play(), eventStartsAt: starts },
    gameFound: false,
    now: NOW,
  });
  assert.equal(reason, "awaiting_final");
});

test("classifySkipReason: market_unhandled when game found but unresolved", () => {
  const starts = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000);
  const reason = classifySkipReason({
    play: { ...play(), eventStartsAt: starts },
    gameFound: true,
    now: NOW,
  });
  assert.equal(reason, "market_unhandled");
});

test("classifySkipReason: aged_out does not win when game is found", () => {
  const starts = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000);
  const reason = classifySkipReason({
    play: { ...play(), eventStartsAt: starts },
    gameFound: true,
    now: NOW,
  });
  assert.equal(reason, "market_unhandled");
});

test("classifySkipReason: a tennis spread is market_unhandled even after lookback", () => {
  const starts = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000);
  const reason = classifySkipReason({
    play: play({
      sport: "TENNIS",
      market: "Spread",
      selection: "Alexander Zverev -4.5",
      eventStartsAt: starts,
    }),
    gameFound: false,
    now: NOW,
  });
  assert.equal(reason, "market_unhandled");
});

test("classifySkipReason: a tennis moneyline still ages out when the scores window is gone", () => {
  const starts = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000);
  const reason = classifySkipReason({
    play: play({
      sport: "TENNIS",
      market: "Moneyline",
      selection: "Alexander Zverev",
      eventStartsAt: starts,
    }),
    gameFound: false,
    now: NOW,
  });
  assert.equal(reason, "aged_out");
});
