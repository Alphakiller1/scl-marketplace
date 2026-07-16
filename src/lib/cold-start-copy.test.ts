import assert from "node:assert/strict";
import { test } from "node:test";

import { hasSignal, MIN_GRADED_FOR_SIGNAL } from "@/lib/sample";
import {
  BOARD_VERIFIED_PICK_HELP,
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
  ].join(" ");
  assert.doesNotMatch(
    blobs,
    /guaranteed|locks|easy money|beat the books|sharp picks|winners/i,
  );
});
