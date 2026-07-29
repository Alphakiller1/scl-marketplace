import type {
  PackageImportStatus,
  StoreConnectionStatus,
  StorefrontReviewAction,
} from "@prisma/client";

export const ADMIN_STOREFRONT_ACTIONS = [
  "APPROVE",
  "MARK_LIVE",
  "REQUEST_CHANGES",
  "SUSPEND",
  "RESTORE",
  "SAVE_NOTES",
] as const;

export type AdminStorefrontAction = (typeof ADMIN_STOREFRONT_ACTIONS)[number];

export type StorefrontTransition = {
  targetStatus: StoreConnectionStatus;
  auditAction: StorefrontReviewAction;
};

export type StorefrontPackageReadiness = {
  status: StoreConnectionStatus;
  packageImportStatus: PackageImportStatus;
};

const REVIEWABLE_STATUSES: StoreConnectionStatus[] = [
  "PENDING_SCL_ACCEPTANCE",
  "PENDING_SCL_LINK_IMPORT",
  "LINKS_RECEIVED",
  "PACKAGES_IMPORTED",
  "LIVE",
  "NEEDS_ACTION",
];

/**
 * Storefront-revenue state for one capper. Drives the admin roster-coverage
 * view: who is earning, who SCL owes action to, who stalled mid-setup, and who
 * never started (the Winible outreach list).
 */
export const STOREFRONT_COVERAGE_BUCKETS = [
  "pipeline",
  "live",
  "stalled",
  "neverStarted",
  "blocked",
] as const;

export type StorefrontCoverageBucket =
  (typeof STOREFRONT_COVERAGE_BUCKETS)[number];

/** Higher = further along. A capper is judged by their furthest connection. */
const COVERAGE_RANK: Record<StoreConnectionStatus, number> = {
  NOT_STARTED: 0,
  INSTRUCTIONS_VIEWED: 1,
  DISABLED: 2,
  NEEDS_ACTION: 3,
  PENDING_SCL_ACCEPTANCE: 4,
  PENDING_SCL_LINK_IMPORT: 5,
  LINKS_RECEIVED: 6,
  PACKAGES_IMPORTED: 7,
  LIVE: 8,
};

/** The connection that best represents a capper's progress, or null when none. */
export function furthestStorefrontStatus(
  statuses: StoreConnectionStatus[],
): StoreConnectionStatus | null {
  if (!statuses.length) return null;
  return statuses.reduce((best, status) =>
    COVERAGE_RANK[status] > COVERAGE_RANK[best] ? status : best,
  );
}

/**
 * Bucket a capper by their furthest storefront connection. Total function —
 * every capper lands in exactly one bucket, including those with no connection.
 */
export function storefrontCoverageBucket(
  statuses: StoreConnectionStatus[],
): StorefrontCoverageBucket {
  const status = furthestStorefrontStatus(statuses);
  if (!status) return "neverStarted";
  switch (status) {
    case "LIVE":
      return "live";
    case "PENDING_SCL_ACCEPTANCE":
    case "PENDING_SCL_LINK_IMPORT":
    case "LINKS_RECEIVED":
    case "PACKAGES_IMPORTED":
      return "pipeline";
    case "NEEDS_ACTION":
    case "DISABLED":
      return "blocked";
    case "NOT_STARTED":
    case "INSTRUCTIONS_VIEWED":
      return "stalled";
  }
}

export function storefrontTransition(
  currentStatus: StoreConnectionStatus,
  action: AdminStorefrontAction,
  context: { hasPackages?: boolean } = {},
): StorefrontTransition | null {
  switch (action) {
    case "APPROVE":
      return [
        "PENDING_SCL_ACCEPTANCE",
        "PENDING_SCL_LINK_IMPORT",
        "NEEDS_ACTION",
      ].includes(currentStatus)
        ? {
            targetStatus: context.hasPackages
              ? "PACKAGES_IMPORTED"
              : "LINKS_RECEIVED",
            auditAction: "APPROVED",
          }
        : null;
    case "MARK_LIVE":
      return ["LINKS_RECEIVED", "PACKAGES_IMPORTED", "NEEDS_ACTION"].includes(
        currentStatus,
      )
        ? { targetStatus: "LIVE", auditAction: "MARKED_LIVE" }
        : null;
    case "REQUEST_CHANGES":
      return REVIEWABLE_STATUSES.includes(currentStatus) &&
        currentStatus !== "NEEDS_ACTION"
        ? {
            targetStatus: "NEEDS_ACTION",
            auditAction: "CHANGES_REQUESTED",
          }
        : null;
    case "SUSPEND":
      return REVIEWABLE_STATUSES.includes(currentStatus)
        ? { targetStatus: "DISABLED", auditAction: "SUSPENDED" }
        : null;
    case "RESTORE":
      return currentStatus === "DISABLED"
        ? { targetStatus: "NEEDS_ACTION", auditAction: "RESTORED" }
        : null;
    case "SAVE_NOTES":
      return {
        targetStatus: currentStatus,
        auditAction: "NOTES_UPDATED",
      };
  }
}

export function storefrontActionRequiresReason(
  action: AdminStorefrontAction,
): boolean {
  return (
    action === "REQUEST_CHANGES" || action === "SUSPEND" || action === "RESTORE"
  );
}

export function canCapperOpenStorefrontSetup(
  status: StoreConnectionStatus,
): boolean {
  return status === "NOT_STARTED" || status === "INSTRUCTIONS_VIEWED";
}

export function canCapperSubmitStorefront(
  status: StoreConnectionStatus,
): boolean {
  return status === "INSTRUCTIONS_VIEWED";
}

export function resolveStorefrontPackageReadiness(input: {
  currentStatus: StoreConnectionStatus;
  packageCount: number;
  activePackageCount: number;
}): StorefrontPackageReadiness {
  const packageImportStatus: PackageImportStatus =
    input.packageCount === 0
      ? "NOT_STARTED"
      : input.currentStatus === "LIVE" && input.activePackageCount > 0
        ? "LIVE"
        : "IMPORTED";

  if (
    input.currentStatus === "DISABLED" ||
    input.currentStatus === "NEEDS_ACTION"
  ) {
    return { status: input.currentStatus, packageImportStatus };
  }
  if (input.currentStatus === "LIVE" && input.activePackageCount === 0) {
    return { status: "PACKAGES_IMPORTED", packageImportStatus };
  }
  if (
    (input.currentStatus === "LINKS_RECEIVED" ||
      input.currentStatus === "PACKAGES_IMPORTED") &&
    input.packageCount > 0
  ) {
    return { status: "PACKAGES_IMPORTED", packageImportStatus };
  }

  return { status: input.currentStatus, packageImportStatus };
}

export function storefrontReviewActionLabel(
  action: StorefrontReviewAction,
): string {
  switch (action) {
    case "APPROVED":
      return "Storefront approved";
    case "MARKED_LIVE":
      return "Storefront marked live";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "SUSPENDED":
      return "Storefront suspended";
    case "RESTORED":
      return "Storefront restored for review";
    case "NOTES_UPDATED":
      return "Internal notes updated";
    case "PACKAGE_SYNC":
      return "Package readiness synchronized";
  }
}
