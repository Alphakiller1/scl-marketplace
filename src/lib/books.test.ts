import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BOOK_KEYS,
  bookLabel,
  bookShort,
  bookmakersQueryParam,
  isBookKey,
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
});
