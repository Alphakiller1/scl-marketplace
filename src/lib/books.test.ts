import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BOOK_KEYS,
  bookLabel,
  bookShort,
  bookmakersQueryParam,
  formatOddsCaptureSourceLine,
  isBookKey,
  oddsSourceBoardLabel,
} from "@/lib/books";

describe("books", () => {
  it("exposes Odds API keys for curated US books", () => {
    assert.ok(BOOK_KEYS.includes("draftkings"));
    assert.ok(BOOK_KEYS.includes("fanduel"));
    assert.ok(BOOK_KEYS.includes("williamhill_us"));
    assert.equal(isBookKey("draftkings"), true);
    assert.equal(isBookKey("unknownbook"), false);
  });

  it("maps labels and shorts", () => {
    assert.equal(bookLabel("draftkings"), "DraftKings");
    assert.equal(bookShort("fanduel"), "FD");
    assert.equal(bookShort("not-a-book"), "not-a-book");
  });

  it("builds bookmakers= query or null when empty", () => {
    assert.equal(bookmakersQueryParam([]), null);
    assert.equal(bookmakersQueryParam(["nope"]), null);
    assert.equal(
      bookmakersQueryParam(["draftkings", "fanduel", "nope"]),
      "draftkings,fanduel",
    );
  });

  it("oddsSourceBoardLabel: book set vs LIVE BOARD", () => {
    assert.equal(oddsSourceBoardLabel(null), "LIVE BOARD");
    assert.equal(oddsSourceBoardLabel(undefined), "LIVE BOARD");
    assert.equal(oddsSourceBoardLabel(""), "LIVE BOARD");
    assert.equal(oddsSourceBoardLabel("draftkings"), "DraftKings BOARD");
    assert.equal(oddsSourceBoardLabel("fanduel"), "FanDuel BOARD");
  });

  it("formatOddsCaptureSourceLine includes source without exposing capture time", () => {
    const withBook = formatOddsCaptureSourceLine({
      capturedAt: "2026-07-14T16:00:00.000Z",
      book: "draftkings",
    });
    assert.equal(
      withBook,
      "ODDS CAPTURED · SOURCE: DraftKings BOARD · GRADES AUTOMATICALLY",
    );
    assert.doesNotMatch(withBook, /2026|16:00|ET/);
    assert.match(withBook, /SOURCE: DraftKings BOARD/);
    assert.match(withBook, /GRADES AUTOMATICALLY$/);

    const noBook = formatOddsCaptureSourceLine({
      capturedAt: "2026-07-14T16:00:00.000Z",
      book: null,
    });
    assert.match(noBook, /SOURCE: LIVE BOARD/);
    assert.match(noBook, /GRADES AUTOMATICALLY$/);

    assert.equal(
      formatOddsCaptureSourceLine({ book: "fanduel", gradingHealthy: false }),
      "ODDS CAPTURED · SOURCE: FanDuel BOARD · GRADING DELAYED — CHECK BACK SOON",
    );
  });
});
