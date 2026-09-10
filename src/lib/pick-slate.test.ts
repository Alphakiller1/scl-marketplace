import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { slateDateForParlay, slateDateForPlay } from "@/lib/pick-slate";

const d = (iso: string) => new Date(iso);

describe("slateDateForPlay", () => {
  it("uses the event start when there is one", () => {
    assert.deepEqual(
      slateDateForPlay(d("2026-09-09T23:10:00Z"), d("2026-09-07T12:00:00Z")),
      d("2026-09-09T23:10:00Z"),
    );
  });

  // 51% of Play rows have no eventStartsAt (the legacy import). Treating those
  // as undated would bury half of every capper's history.
  it("falls back to log time for a pick with no event start", () => {
    assert.deepEqual(
      slateDateForPlay(null, d("2026-09-07T12:00:00Z")),
      d("2026-09-07T12:00:00Z"),
    );
    assert.deepEqual(
      slateDateForPlay(undefined, d("2026-09-07T12:00:00Z")),
      d("2026-09-07T12:00:00Z"),
    );
  });
});

describe("slateDateForParlay", () => {
  // The leaderboard's 1D rule: a ticket belongs to the day its final game was
  // played. Dating it by the earliest leg instead would put the history one day
  // out from the ranking — the very mismatch this exists to close.
  it("dates a ticket by its last leg, not its first", () => {
    assert.deepEqual(
      slateDateForParlay(
        [d("2026-09-09T17:00:00Z"), d("2026-09-10T23:00:00Z")],
        d("2026-09-08T09:00:00Z"),
      ),
      d("2026-09-10T23:00:00Z"),
    );
  });

  it("ignores unbound legs when some legs are bound", () => {
    assert.deepEqual(
      slateDateForParlay(
        [null, d("2026-09-09T17:00:00Z"), undefined],
        d("2026-09-01T09:00:00Z"),
      ),
      d("2026-09-09T17:00:00Z"),
    );
  });

  it("falls back to log time when no leg is bound", () => {
    assert.deepEqual(
      slateDateForParlay([null, undefined], d("2026-09-08T09:00:00Z")),
      d("2026-09-08T09:00:00Z"),
    );
    assert.deepEqual(
      slateDateForParlay([], d("2026-09-08T09:00:00Z")),
      d("2026-09-08T09:00:00Z"),
    );
  });
});

/**
 * The reported case, in miniature: a capper who logs days ahead sees his history
 * ordered by the slate, so it lines up with the 1D leaderboard line instead of
 * with whatever he happened to type yesterday.
 */
describe("the ordering an owner actually reads", () => {
  it("puts a pick logged early for a later game after that later game", () => {
    const loggedEarlyPlayedLate = slateDateForPlay(
      d("2026-09-13T20:00:00Z"),
      d("2026-09-09T10:00:00Z"),
    );
    const loggedAndPlayedYesterday = slateDateForPlay(
      d("2026-09-09T23:00:00Z"),
      d("2026-09-09T11:00:00Z"),
    );
    // Newest slate first: the 09-13 game outranks the 09-09 one even though it
    // was logged first.
    assert.ok(
      loggedEarlyPlayedLate.getTime() > loggedAndPlayedYesterday.getTime(),
    );
  });
});
