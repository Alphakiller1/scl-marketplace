import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(
  "src/components/scl/home-verification-rail.tsx",
  "utf8",
);
const legend = readFileSync(
  "src/components/scl/verification-legend.tsx",
  "utf8",
);
const page = readFileSync("src/app/(marketing)/verification/page.tsx", "utf8");

test("owner-approved verification explanation is shared across public surfaces", () => {
  assert.match(
    home,
    /SCL uses standardized sportsbook market data to help verify picks and/,
  );
  for (const source of [legend, page]) {
    assert.match(
      source,
      /SCL captures sportsbook odds and uses that market data/,
    );
    assert.match(source, /independently of the capper/);
    assert.match(source, /Consistent Standards/);
    assert.match(source, /consistent way to compare/);
  }
});

test("removed post-pick verification claims do not return", () => {
  for (const source of [home, legend, page]) {
    assert.doesNotMatch(source, /authentic odds at submission/i);
    assert.doesNotMatch(source, /synchronizes odds from multiple sportsbooks/i);
  }
});
