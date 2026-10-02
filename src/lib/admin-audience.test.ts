import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  audienceLabel,
  audienceListHref,
  matchesAudienceFilters,
  type AudienceSnapshot,
} from "@/lib/admin-audience";
import {
  audienceCounts,
  resolveAudienceMembers,
} from "@/lib/admin-audience-members";
import {
  emptyAudienceFilters,
  parseAudienceFiltersParam,
} from "@/lib/schemas/audience.schema";

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
  });

  it("keeps bounced cappers in the group but not in the recipients", () => {
    const [member] = resolveAudienceMembers(
      [capper({ campaignUndeliverable: true })],
      emptyAudienceFilters(),
      NOW,
    );
    assert.equal(member?.eligible, false);
    assert.equal(member?.ineligibleReason, "bounced");
  });

  it("filters to cappers who played inside the window", () => {
    const filters = { ...emptyAudienceFilters(), playedWithinDays: 3 as const };
    assert.equal(matchesAudienceFilters(capper(), filters, NOW), true);
    assert.equal(
      matchesAudienceFilters(capper({ lastPlayAt: null }), filters, NOW),
      false,
    );
    assert.equal(
      matchesAudienceFilters(
        capper({ lastPlayAt: new Date("2026-09-20T12:00:00.000Z") }),
        filters,
        NOW,
      ),
      false,
    );
  });
});

describe("audience membership vs. email eligibility", () => {
  it("counts the whole group and explains who cannot be emailed", () => {
    const members = resolveAudienceMembers(
      [
        capper({ id: "a", email: "a@scl.com" }),
        capper({ id: "b", email: "b@scl.com", marketingOptOut: true }),
        capper({ id: "c", email: "c@scl.com", accountStatus: "SUSPENDED" }),
        capper({ id: "d", email: "A@scl.com" }),
        capper({ id: "t", email: "t@scl.com", isTest: true }),
      ],
      emptyAudienceFilters(),
      NOW,
    );
    assert.deepEqual(audienceCounts(members), { total: 4, emailable: 1 });
    const reasons = Object.fromEntries(
      members.map((member) => [member.id, member.ineligibleReason]),
    );
    assert.deepEqual(reasons, {
      a: null,
      b: "opted_out",
      c: "restricted",
      d: "duplicate_inbox",
    });
  });

  it("removing one account withdraws its shared inbox entirely", () => {
    const members = resolveAudienceMembers(
      [
        capper({ id: "old", email: "shared@scl.com" }),
        capper({ id: "new", email: "Shared@scl.com" }),
        capper({ id: "other", email: "other@scl.com" }),
      ],
      { ...emptyAudienceFilters(), excludeUserIds: ["old"] },
      NOW,
    );
    assert.deepEqual(
      members.filter((member) => member.eligible).map((member) => member.id),
      ["other"],
    );
  });

  it("dashboard links omit default filters and round-trip", () => {
    const filters = {
      ...emptyAudienceFilters(),
      playHistory: "HAS_PLAYS" as const,
      storefront: "NOT_CONNECTED" as const,
    };
    const href = audienceListHref(filters);
    assert.match(href, /^\/admin\/audiences\?filters=/);
    const raw = decodeURIComponent(href.split("filters=")[1]!);
    assert.deepEqual(JSON.parse(raw), {
      playHistory: "HAS_PLAYS",
      storefront: "NOT_CONNECTED",
    });
    assert.deepEqual(parseAudienceFiltersParam(raw), filters);
    assert.equal(parseAudienceFiltersParam("{not json"), null);
  });
});
