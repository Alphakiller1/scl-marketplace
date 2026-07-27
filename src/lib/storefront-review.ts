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
