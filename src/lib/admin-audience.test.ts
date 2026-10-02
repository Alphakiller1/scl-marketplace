import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  audienceLabel,
  matchesAudienceFilters,
  type AudienceSnapshot,
} from "@/lib/admin-audience";
import { emptyAudienceFilters } from "@/lib/schemas/audience.schema";

const NOW = new Date("2026-10-01T12:00:00.000Z");

function capper(over: Partial<AudienceSnapshot> = {}): AudienceSnapshot {
  return {
    id: "capper-1",
    email: "capper@scl.com",
    username: "capper",
    displayName: "Capper",
    emailVerified: NOW,
    accountStatus: "ACTIVE",
    isTest: false,
    marketingOptOut: false,
    campaignUndeliverable: false,
    createdAt: new Date("2026-09-20T12:00:00.000Z"),
    playCount: 4,
    parlayCount: 1,
    lastPlayAt: new Date("2026-09-29T12:00:00.000Z"),
    hasConnectedStorefront: true,
    storefrontAwaitingReview: false,
    ...over,
  };
}

describe("shared admin audience filters", () => {
  it("combines play history and storefront criteria with AND semantics", () => {
    const filters = {
      ...emptyAudienceFilters(),
      playHistory: "HAS_PLAYS" as const,
      storefront: "NOT_CONNECTED" as const,
    };
    assert.equal(
      matchesAudienceFilters(
        capper({ hasConnectedStorefront: false }),
        filters,
        NOW,
      ),
      true,
    );
    assert.equal(matchesAudienceFilters(capper(), filters, NOW), false);
    assert.match(audienceLabel(filters), /has submitted plays/);
    assert.match(audienceLabel(filters), /no connected storefront/);
  });

  it("treats never submitted as inactive for every no-play window", () => {
    const never = capper({ playCount: 0, parlayCount: 0, lastPlayAt: null });
    for (const days of [3, 7, 14, 30] as const) {
      assert.equal(
        matchesAudienceFilters(
          never,
          { ...emptyAudienceFilters(), noPlaysWithinDays: days },
          NOW,
        ),
        true,
      );
    }
  });

  it("does not classify a recent play as inactive", () => {
    assert.equal(
      matchesAudienceFilters(
        capper(),
        { ...emptyAudienceFilters(), noPlaysWithinDays: 3 },
        NOW,
      ),
      false,
    );
  });

  it("supports recent joins and verification together", () => {
    const filters = {
      ...emptyAudienceFilters(),
      joinedWithinDays: 14 as const,
      verification: "VERIFIED" as const,
    };
    assert.equal(matchesAudienceFilters(capper(), filters, NOW), true);
    assert.equal(
      matchesAudienceFilters(capper({ emailVerified: null }), filters, NOW),
      false,
    );
  });

  it("honours manual recipient removals and excludes test profiles", () => {
    assert.equal(
      matchesAudienceFilters(
        capper(),
        { ...emptyAudienceFilters(), excludeUserIds: ["capper-1"] },
        NOW,
      ),
      false,
    );
    assert.equal(
      matchesAudienceFilters(
        capper({ isTest: true }),
        emptyAudienceFilters(),
        NOW,
      ),
      false,
    );
    assert.equal(
      matchesAudienceFilters(
        capper({ campaignUndeliverable: true }),
        emptyAudienceFilters(),
        NOW,
      ),
      false,
    );
  });
});
