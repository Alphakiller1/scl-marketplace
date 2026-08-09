import assert from "node:assert/strict";
import test from "node:test";

import {
  findMarketplaceCapperMatches,
  type PublicMarketplaceCapper,
} from "@/lib/marketplace-search";

const cappers: PublicMarketplaceCapper[] = [
  {
    id: "inevitable",
    handle: "InevitablePicks",
    name: "Inevitable Picks",
    avatarUrl: null,
  },
  {
    id: "listed",
    handle: "ListedCapper",
    name: "Listed Capper",
    avatarUrl: null,
  },
];

test("finds a public capper without an offer by username", () => {
  for (const query of ["InevitablePicks", "@inevitablepicks", "INEVITABLE"]) {
    assert.deepEqual(
      findMarketplaceCapperMatches(query, cappers, new Set()).map(
        (capper) => capper.handle,
      ),
      ["InevitablePicks"],
    );
  }
});

test("does not duplicate cappers already represented by an offer", () => {
  assert.deepEqual(
    findMarketplaceCapperMatches("listed", cappers, new Set(["listed"])),
    [],
  );
});

test("does not return profile suggestions for an empty or unmatched search", () => {
  assert.deepEqual(findMarketplaceCapperMatches("", cappers, new Set()), []);
  assert.deepEqual(
    findMarketplaceCapperMatches("missing", cappers, new Set()),
    [],
  );
});
