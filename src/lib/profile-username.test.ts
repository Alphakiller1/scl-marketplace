import assert from "node:assert/strict";
import test from "node:test";

import {
  HANDLE_TAKEN_MESSAGE,
  UNCLAIMED_HANDLE_MESSAGE,
} from "@/lib/account-claim";
import {
  decideHandleCollision,
  handleOccupantHasPublicRecord,
  parkedReleasedHandle,
  type HandleOccupant,
  type HandleOccupantCounts,
} from "@/lib/profile-username";

const emptyCounts: HandleOccupantCounts = {
  plays: 0,
  parlays: 0,
  legacyRecords: 0,
  packages: 0,
  storeConnections: 0,
};

function occupant(overrides: {
  id?: string;
  passwordHash?: string | null;
  accountStatus?: HandleOccupant["accountStatus"];
  capperProfile?: HandleOccupant["capperProfile"];
  counts?: Partial<HandleOccupantCounts>;
}): HandleOccupant {
  const capperProfile =
    overrides.capperProfile === undefined
      ? { _count: { ...emptyCounts, ...overrides.counts } }
      : overrides.capperProfile;
  return {
    id: overrides.id ?? "occupant-id",
    passwordHash:
      overrides.passwordHash === undefined ? null : overrides.passwordHash,
    accountStatus: overrides.accountStatus ?? "ACTIVE",
    capperProfile,
  };
}

test("a free handle is allowed", () => {
  assert.deepEqual(decideHandleCollision(null), { action: "allow" });
});

test("a claimed account keeps the handle", () => {
  assert.deepEqual(decideHandleCollision(occupant({ passwordHash: "hash" })), {
    action: "reject",
    error: HANDLE_TAKEN_MESSAGE,
  });
});

test("a restricted account keeps the handle even when empty", () => {
  for (const accountStatus of ["SUSPENDED", "DISABLED"] as const) {
    assert.deepEqual(
      decideHandleCollision(occupant({ accountStatus, passwordHash: null })),
      { action: "reject", error: HANDLE_TAKEN_MESSAGE },
    );
  }
});

test("an unclaimed import with a record is not stolen", () => {
  assert.equal(
    handleOccupantHasPublicRecord(
      occupant({ counts: { ...emptyCounts, plays: 3 } }),
    ),
    true,
  );
  assert.deepEqual(decideHandleCollision(occupant({ counts: { plays: 1 } })), {
    action: "reject",
    error: UNCLAIMED_HANDLE_MESSAGE,
  });
  assert.deepEqual(
    decideHandleCollision(occupant({ counts: { legacyRecords: 2 } })),
    { action: "reject", error: UNCLAIMED_HANDLE_MESSAGE },
  );
});

test("an empty unclaimed stub is released so a live capper can take the handle", () => {
  assert.deepEqual(decideHandleCollision(occupant({ passwordHash: null })), {
    action: "release",
    occupantId: "occupant-id",
  });
  assert.deepEqual(
    decideHandleCollision(
      occupant({ passwordHash: null, capperProfile: null }),
    ),
    { action: "release", occupantId: "occupant-id" },
  );
});

test("parked handles stay unique, valid, and within the 30-char ceiling", () => {
  const cuid = "cmiu2abcdefghijk123456789";
  const parked = parkedReleasedHandle(cuid);
  assert.equal(parked, `rel_${cuid}`);
  assert.ok(parked.length <= 30);
  assert.match(parked, /^[a-z0-9_]+$/);
  assert.notEqual(parkedReleasedHandle(cuid, 1), parked);
});
