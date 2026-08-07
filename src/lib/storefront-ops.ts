import type { StoreConnectionStatus, StoreProvider } from "@prisma/client";

import { isPendingStoreStatus, providerLabel } from "@/lib/store-connection";
import type { AdminStorefrontAction } from "@/lib/storefront-review";

/**
 * Shared copy + readiness helpers for the revenue storefront path.
 * Capper and admin surfaces should speak the same language for Winible + Whop.
 */

export function adminApproveLabel(provider: StoreProvider): string {
  return provider === "WHOP"
    ? "Confirm affiliate ready"
    : "Confirm affiliate accepted";
}

export function adminActionSuccessMessage(
  action: AdminStorefrontAction,
  provider: StoreProvider,
): string {
  switch (action) {
    case "APPROVE":
      return provider === "WHOP"
        ? "Whop affiliate confirmed. Sync or paste packages, activate them, then Mark live."
        : "Winible affiliate confirmed. Add package links, activate them, then Mark live.";
    case "MARK_LIVE":
      return `${providerLabel(provider)} storefront is live — packages are public on the capper profile.`;
    case "REQUEST_CHANGES":
      return "Changes requested — capper will see Needs Attention.";
    case "SUSPEND":
      return "Storefront suspended — packages are no longer public.";
    case "RESTORE":
      return "Restored for review — confirm affiliate again before Mark live.";
    case "SAVE_NOTES":
      return "Internal notes saved";
    default:
      return "Storefront review recorded";
  }
}

export type StorefrontGoLiveGate = {
  canMarkLive: boolean;
  reasons: string[];
};

/** Why Mark live is blocked — shown next to the admin action buttons. */
export function storefrontGoLiveGate(input: {
  status: StoreConnectionStatus;
  activePackageCount: number;
}): StorefrontGoLiveGate {
  const reasons: string[] = [];
  if (isPendingStoreStatus(input.status)) {
    reasons.push("Confirm the affiliate relationship first.");
  } else if (
    input.status !== "LINKS_RECEIVED" &&
    input.status !== "PACKAGES_IMPORTED" &&
    input.status !== "NEEDS_ACTION"
  ) {
    if (input.status === "LIVE") {
      reasons.push("Already live.");
    } else if (input.status === "DISABLED") {
      reasons.push("Restore for review before going live.");
    } else {
      reasons.push("Storefront is not ready for Mark live yet.");
    }
  }
  if (input.activePackageCount < 1) {
    reasons.push(
      "Activate at least one package with a checkout link before Mark live.",
    );
  }
  return { canMarkLive: reasons.length === 0, reasons };
}

export type AdminReadinessItem = {
  label: string;
  done: boolean;
};

/** Computed checklist — replaces decorative read-only checkboxes. */
export function adminStorefrontReadiness(input: {
  provider: StoreProvider;
  status: StoreConnectionStatus;
  packageCount: number;
  activePackageCount: number;
  affiliatePercent: number | null;
  whopConnected: boolean;
}): AdminReadinessItem[] {
  const approved =
    input.status === "LINKS_RECEIVED" ||
    input.status === "PACKAGES_IMPORTED" ||
    input.status === "LIVE";
  const live = input.status === "LIVE";

  if (input.provider === "WHOP") {
    return [
      {
        label: "Capper submitted Whop affiliate confirmation",
        done: isPendingStoreStatus(input.status) || approved || live,
      },
      {
        label: "Capper installed SCL app on Whop (for package sync)",
        done: input.whopConnected,
      },
      {
        label: "Affiliate commission % recorded",
        done: input.affiliatePercent != null && input.affiliatePercent > 0,
      },
      {
        label: "SCL confirmed affiliate relationship",
        done: approved || live,
      },
      {
        label: "At least one package imported or pasted",
        done: input.packageCount > 0,
      },
      {
        label: "At least one package activated with checkout link",
        done: input.activePackageCount > 0,
      },
      {
        label: "Storefront marked live (public on profile)",
        done: live,
      },
    ];
  }

  return [
    {
      label: "Capper submitted Winible affiliate request",
      done: isPendingStoreStatus(input.status) || approved || live,
    },
    {
      label: "Affiliate invite accepted in Winible (off-platform)",
      done: approved || live,
    },
    {
      label: "Affiliate commission % recorded",
      done: input.affiliatePercent != null && input.affiliatePercent > 0,
    },
    {
      label: "SCL confirmed affiliate relationship",
      done: approved || live,
    },
    {
      label: "At least one package link pasted",
      done: input.packageCount > 0,
    },
    {
      label: "At least one package activated with checkout link",
      done: input.activePackageCount > 0,
    },
    {
      label: "Storefront marked live (public on profile)",
      done: live,
    },
  ];
}

/**
 * Which storefront connection a saved package belongs to.
 *
 * Editing must never re-home an offer. `activePublicPackageWhere` publishes a
 * package when it is unattached **or** its connection is LIVE, so inferring a
 * connection for a carried-over legacy offer — every package on this
 * marketplace is unattached — would pull it off the public site the first time
 * an admin corrected a typo in it, with no visible cause. Inference is for
 * creates, where there is no prior home to keep.
 */
export function resolvePackageStoreConnectionId(input: {
  /** Connection the editing surface is scoped to, when it has one. */
  explicit: string | null;
  /** The package's current connection — null for a create. */
  existing: string | null;
  /** Connection matching this capper + provider, if one exists. */
  inferred: string | null;
  isEdit: boolean;
}): string | null {
  if (input.explicit) return input.explicit;
  if (input.isEdit) return input.existing;
  return input.inferred;
}

export function packagePublicationLabel(input: {
  isActive: boolean;
  hasCheckout: boolean;
  connectionStatus: StoreConnectionStatus | null;
  unattached: boolean;
}): { label: string; tone: "draft" | "ready" | "live" | "hidden" } {
  if (!input.isActive) {
    return { label: "Draft", tone: "draft" };
  }
  if (!input.hasCheckout) {
    return { label: "Needs link", tone: "hidden" };
  }
  if (input.unattached || input.connectionStatus === "LIVE") {
    return { label: "Public", tone: "live" };
  }
  return { label: "Ready · not live", tone: "ready" };
}
