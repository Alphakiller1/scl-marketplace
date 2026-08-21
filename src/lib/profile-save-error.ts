import { HANDLE_TAKEN_MESSAGE } from "@/lib/account-claim";
import { databaseErrorCode } from "@/lib/database-retry";

const TRANSIENT_CODES = new Set(["P1001", "P1002", "P1017", "P2024"]);

export type ProfileSaveSurface = "username" | "profile";

/**
 * User-safe save errors that still name the Prisma code when we have one.
 * The generic "couldn't save your profile" toast hid unique conflicts,
 * timeouts, and lookup failures behind the same sentence.
 */
export function userFacingProfileSaveError(
  error: unknown,
  surface: ProfileSaveSurface,
): string {
  const code = databaseErrorCode(error);
  if (code === "P2002") return HANDLE_TAKEN_MESSAGE;
  if (code && TRANSIENT_CODES.has(code)) {
    return "The database timed out. Try saving again.";
  }
  if (code) {
    return `We couldn't save your ${surface} (${code}). Try again.`;
  }
  return `We couldn't save your ${surface}. Try again.`;
}

export function isUniqueHandleConflict(error: unknown): boolean {
  return databaseErrorCode(error) === "P2002";
}
