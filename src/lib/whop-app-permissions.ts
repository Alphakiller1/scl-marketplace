import {
  retrieveWhopApp,
  WhopApiError,
  type WhopAppRequestedPermission,
  type WhopAppRequestedPermissionInput,
} from "@/lib/whop-api";
import { whopAccountApiKey, whopAppApiKey, whopAppId } from "@/lib/whop-config";

export const WHOP_PLAN_READ_PERMISSION = "plan:basic:read";
export const WHOP_PLAN_READ_JUSTIFICATION =
  "Read each connected capper's Whop plans so SCL can keep storefront package prices and billing cadence synchronized.";

export type WhopAppPermissionReadiness = "ready" | "missing" | "unknown";

export function isWhopPlanReadPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    (error instanceof WhopApiError && error.status === 403) ||
    message.toLowerCase().includes(WHOP_PLAN_READ_PERMISSION)
  );
}

export function hasRequiredWhopAppPermission(
  permissions: WhopAppRequestedPermission[] | null | undefined,
  action = WHOP_PLAN_READ_PERMISSION,
): boolean {
  return Boolean(
    permissions?.some(
      (permission) =>
        permission.permission_action.action === action &&
        permission.is_required,
    ),
  );
}

export function mergeRequiredWhopAppPermission(
  permissions: WhopAppRequestedPermission[] | null | undefined,
  action = WHOP_PLAN_READ_PERMISSION,
  justification = WHOP_PLAN_READ_JUSTIFICATION,
): WhopAppRequestedPermissionInput[] {
  const current = permissions ?? [];
  const merged = current.map((permission) => ({
    action: permission.permission_action.action,
    is_required:
      permission.permission_action.action === action
        ? true
        : permission.is_required,
    justification:
      permission.justification?.trim() ||
      (permission.permission_action.action === action
        ? justification
        : "Required by SCL."),
  }));

  if (!merged.some((permission) => permission.action === action)) {
    merged.push({ action, is_required: true, justification });
  }

  return merged;
}

/**
 * Check the app-wide install contract before onboarding a capper. A positive
 * read is authoritative. "unknown" means the configured runtime credentials
 * cannot inspect developer settings; the callback performs a company-level
 * permission probe so an unknown preflight can never become a false success.
 */
export async function readWhopAppPermissionReadiness(): Promise<WhopAppPermissionReadiness> {
  const appId = whopAppId();
  const credentials = Array.from(
    new Set([whopAppApiKey(), whopAccountApiKey()].filter(Boolean)),
  ) as string[];
  if (!appId || credentials.length === 0) return "unknown";

  for (const accessToken of credentials) {
    try {
      const app = await retrieveWhopApp(accessToken, appId);
      return hasRequiredWhopAppPermission(app.requested_permissions)
        ? "ready"
        : "missing";
    } catch (error) {
      console.warn(
        "[whop] Could not inspect app install permissions with a configured credential:",
        error,
      );
    }
  }
  return "unknown";
}
