import assert from "node:assert/strict";
import test from "node:test";
import { CROSS_SPORTS, parlayReportingSport } from "@/lib/parlay-sport";

test("single-sport parlays remain attributed to their sport", () => {
  assert.equal(
    parlayReportingSport([{ sport: "MLB" }, { sport: "MLB" }]),
    "MLB",
  );
});

test("multi-sport parlays have exactly one Cross-Sports attribution", () => {
  assert.equal(
    parlayReportingSport([
      { sport: "MLB" },
      { sport: "NBA" },
      { sport: "MLB" },
    ]),
    CROSS_SPORTS,
  );
});
