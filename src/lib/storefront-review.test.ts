import assert from "node:assert/strict";
import test from "node:test";

import type { StoreConnectionStatus } from "@prisma/client";

import {
  canCapperOpenStorefrontSetup,
  canCapperSubmitStorefront,
  resolveStorefrontPackageReadiness,
  storefrontActionRequiresReason,
  storefrontCoverageBucket,
  storefrontTransition,
  furthestStorefrontStatus,
  STOREFRONT_COVERAGE_BUCKETS,
} from "@/lib/storefront-review";

test("approval maps pending provider workflows onto the existing state model", () => {
  assert.deepEqual(storefrontTransition("PENDING_SCL_ACCEPTANCE", "APPROVE"), {
    targetStatus: "LINKS_RECEIVED",
    auditAction: "APPROVED",
  });
  assert.deepEqual(storefrontTransition("PENDING_SCL_LINK_IMPORT", "APPROVE"), {
    targetStatus: "LINKS_RECEIVED",
    auditAction: "APPROVED",
  });
  assert.deepEqual(
    storefrontTransition("PENDING_SCL_ACCEPTANCE", "APPROVE", {
      hasPackages: true,
    }),
    {
      targetStatus: "PACKAGES_IMPORTED",
      auditAction: "APPROVED",
    },
  );
});

test("suspension and restoration never restore a storefront directly to live", () => {
  assert.deepEqual(storefrontTransition("LIVE", "SUSPEND"), {
    targetStatus: "DISABLED",
    auditAction: "SUSPENDED",
  });
  assert.deepEqual(storefrontTransition("DISABLED", "RESTORE"), {
    targetStatus: "NEEDS_ACTION",
    auditAction: "RESTORED",
  });
  assert.equal(storefrontTransition("DISABLED", "MARK_LIVE"), null);
});

test("invalid or duplicate transitions are rejected", () => {
  assert.equal(storefrontTransition("NOT_STARTED", "APPROVE"), null);
  assert.equal(storefrontTransition("LIVE", "MARK_LIVE"), null);
  assert.equal(storefrontTransition("NEEDS_ACTION", "REQUEST_CHANGES"), null);
});

test("high-impact transitions require a reason", () => {
  assert.equal(storefrontActionRequiresReason("SUSPEND"), true);
  assert.equal(storefrontActionRequiresReason("REQUEST_CHANGES"), true);
  assert.equal(storefrontActionRequiresReason("RESTORE"), true);
  assert.equal(storefrontActionRequiresReason("APPROVE"), false);
  assert.equal(storefrontActionRequiresReason("SAVE_NOTES"), false);
});

test("package readiness never bypasses explicit live approval", () => {
  assert.deepEqual(
    resolveStorefrontPackageReadiness({
      currentStatus: "LINKS_RECEIVED",
      packageCount: 1,
      activePackageCount: 1,
    }),
    {
      status: "PACKAGES_IMPORTED",
      packageImportStatus: "IMPORTED",
    },
  );
  assert.deepEqual(
    resolveStorefrontPackageReadiness({
      currentStatus: "PENDING_SCL_ACCEPTANCE",
      packageCount: 1,
      activePackageCount: 1,
    }),
    {
      status: "PENDING_SCL_ACCEPTANCE",
      packageImportStatus: "IMPORTED",
    },
  );
});

test("removing the last active package takes a live storefront out of publication", () => {
  assert.deepEqual(
    resolveStorefrontPackageReadiness({
      currentStatus: "LIVE",
      packageCount: 1,
      activePackageCount: 0,
    }),
    {
      status: "PACKAGES_IMPORTED",
      packageImportStatus: "IMPORTED",
    },
  );
  assert.deepEqual(
    resolveStorefrontPackageReadiness({
      currentStatus: "DISABLED",
      packageCount: 1,
      activePackageCount: 1,
    }),
    {
      status: "DISABLED",
      packageImportStatus: "IMPORTED",
    },
  );
});

test("capper self-service cannot overwrite reviewed or suspended states", () => {
  assert.equal(canCapperOpenStorefrontSetup("NOT_STARTED"), true);
  assert.equal(canCapperOpenStorefrontSetup("INSTRUCTIONS_VIEWED"), true);
  assert.equal(canCapperOpenStorefrontSetup("PENDING_SCL_ACCEPTANCE"), false);
  assert.equal(canCapperOpenStorefrontSetup("LIVE"), false);
  assert.equal(canCapperOpenStorefrontSetup("DISABLED"), false);

  assert.equal(canCapperSubmitStorefront("INSTRUCTIONS_VIEWED"), true);
  assert.equal(canCapperSubmitStorefront("NEEDS_ACTION"), false);
  assert.equal(canCapperSubmitStorefront("DISABLED"), false);
});

test("workflow transitions update new status fields correctly", () => {
  // APPROVE sets requiresAttention to false (only NEEDS_ACTION sets it to true)
  const approveTransition = storefrontTransition(
    "PENDING_SCL_ACCEPTANCE",
    "APPROVE",
    { hasPackages: false },
  );
  assert(approveTransition);
  assert.equal(approveTransition.targetStatus, "LINKS_RECEIVED");
  assert.equal(approveTransition.auditAction, "APPROVED");

  // REQUEST_CHANGES sets status to NEEDS_ACTION
  const requestChanges = storefrontTransition(
    "LINKS_RECEIVED",
    "REQUEST_CHANGES",
  );
  assert(requestChanges);
  assert.equal(requestChanges.targetStatus, "NEEDS_ACTION");

  // MARK_LIVE transitions to LIVE
  const markLive = storefrontTransition("PACKAGES_IMPORTED", "MARK_LIVE");
  assert(markLive);
  assert.equal(markLive.targetStatus, "LIVE");
  assert.equal(markLive.auditAction, "MARKED_LIVE");
});

test("storefront coverage: every capper lands in exactly one bucket", () => {
  const ALL_STATUSES: StoreConnectionStatus[] = [
    "NOT_STARTED",
    "INSTRUCTIONS_VIEWED",
    "PENDING_SCL_ACCEPTANCE",
    "PENDING_SCL_LINK_IMPORT",
    "LINKS_RECEIVED",
    "PACKAGES_IMPORTED",
    "LIVE",
    "NEEDS_ACTION",
    "DISABLED",
  ];

  // Total function: no status escapes the bucket map, and each maps to a real bucket.
  for (const status of ALL_STATUSES) {
    const bucket = storefrontCoverageBucket([status]);
    assert.ok(
      STOREFRONT_COVERAGE_BUCKETS.includes(bucket),
      `${status} produced unknown bucket ${bucket}`,
    );
  }

  // No connection at all is the outreach list, not a crash.
  assert.equal(storefrontCoverageBucket([]), "neverStarted");

  // Revenue-state mapping.
  assert.equal(storefrontCoverageBucket(["LIVE"]), "live");
  assert.equal(
    storefrontCoverageBucket(["PENDING_SCL_ACCEPTANCE"]),
    "pipeline",
  );
  assert.equal(
    storefrontCoverageBucket(["PENDING_SCL_LINK_IMPORT"]),
    "pipeline",
  );
  assert.equal(storefrontCoverageBucket(["LINKS_RECEIVED"]), "pipeline");
  assert.equal(storefrontCoverageBucket(["PACKAGES_IMPORTED"]), "pipeline");
  assert.equal(storefrontCoverageBucket(["NEEDS_ACTION"]), "blocked");
  assert.equal(storefrontCoverageBucket(["DISABLED"]), "blocked");

  // Has a storefront but never synced to SCL's affiliate program.
  assert.equal(storefrontCoverageBucket(["INSTRUCTIONS_VIEWED"]), "stalled");
  assert.equal(storefrontCoverageBucket(["NOT_STARTED"]), "stalled");
});

test("storefront coverage: a capper is judged by their furthest connection", () => {
  // Live on one provider beats an abandoned/suspended one — still earning.
  assert.equal(storefrontCoverageBucket(["DISABLED", "LIVE"]), "live");
  assert.equal(
    storefrontCoverageBucket(["INSTRUCTIONS_VIEWED", "LIVE"]),
    "live",
  );
  // Pending beats not-started: SCL owes them action.
  assert.equal(
    storefrontCoverageBucket(["NOT_STARTED", "PENDING_SCL_ACCEPTANCE"]),
    "pipeline",
  );
  // Order must not matter.
  assert.equal(
    storefrontCoverageBucket(["LIVE", "DISABLED"]),
    storefrontCoverageBucket(["DISABLED", "LIVE"]),
  );
  assert.equal(furthestStorefrontStatus([]), null);
  assert.equal(furthestStorefrontStatus(["DISABLED", "LIVE"]), "LIVE");
});
