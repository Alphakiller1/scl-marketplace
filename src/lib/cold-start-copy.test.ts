import assert from "node:assert/strict";
import { test } from "node:test";

import { hasSignal, MIN_GRADED_FOR_SIGNAL } from "@/lib/sample";
import {
  BOARD_VERIFIED_PICK_HELP,
  HOW_RANKING_VERIFIED_NOTE,
  HOW_RANKING_WORKS_BULLETS,
  PROVISIONAL_RECORD_HELP,
  STOREFRONT_EMPTY_TITLE,
} from "@/lib/cold-start-copy";

test("hasSignal gates at MIN_GRADED_FOR_SIGNAL", () => {
  assert.equal(hasSignal(MIN_GRADED_FOR_SIGNAL - 1), false);
  assert.equal(hasSignal(MIN_GRADED_FOR_SIGNAL), true);
});

test("cold-start copy stays free of hype promises", () => {
  const blobs = [
    PROVISIONAL_RECORD_HELP,
    BOARD_VERIFIED_PICK_HELP,
    STOREFRONT_EMPTY_TITLE,
    ...HOW_RANKING_WORKS_BULLETS,
    HOW_RANKING_VERIFIED_NOTE,
  ].join(" ");
  assert.doesNotMatch(
    blobs,
    /guaranteed|locks|easy money|beat the books|sharp picks|winners|coming soon/i,
  );
});

test("how-ranking copy matches GPT P2 sweep", () => {
  assert.equal(
    HOW_RANKING_WORKS_BULLETS[0],
    "Within the selected scope, a public rank requires the minimum graded sample and non-negative ROI and units.",
  );
  assert.equal(
    HOW_RANKING_WORKS_BULLETS[1],
    "Records below the sample threshold or with negative ROI or units remain visible under Building a Record and are not ranked.",
  );
  assert.equal(
    HOW_RANKING_WORKS_BULLETS[2],
    "CLV sorting requires the minimum sample and at least one stored closing line.",
  );
  assert.equal(
    HOW_RANKING_VERIFIED_NOTE,
    "Verified share is the percentage of tracked picks checked against the board at submission. It does not describe pick outcomes.",
  );
});
