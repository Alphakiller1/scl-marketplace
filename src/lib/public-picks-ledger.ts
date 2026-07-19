import type { TodayPick } from "@/lib/mock";
import type { ProofReceiptState } from "@/lib/proof-receipt";
import { isVerifiedTier } from "@/lib/verification";

export type PublicPicksWindow = "all" | "7d" | "30d";
export type PublicPicksStatus = "all" | "pending" | "live" | "graded";

export type PublicPicksLedgerFilters = {
  window: PublicPicksWindow;
  sport: string;
  status: PublicPicksStatus;
};

export const DEFAULT_PUBLIC_PICKS_FILTERS: PublicPicksLedgerFilters = {
  window: "all",
  sport: "all",
  status: "all",
};

const GRADED_STATUSES = new Set<TodayPick["status"]>([
  "win",
  "loss",
  "push",
  "void",
]);

export function parsePublicPicksLedgerFilters(
  params: Record<string, string | string[] | undefined>,
): PublicPicksLedgerFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const window = first(params.window);
  const status = first(params.status);
  const sport = first(params.sport)?.trim().toUpperCase();

  return {
    window: window === "7d" || window === "30d" ? window : "all",
    status:
      status === "pending" || status === "live" || status === "graded"
        ? status
        : "all",
    sport: sport && /^[A-Z0-9-]{2,12}$/.test(sport) ? sport : "all",
  };
}

export function filterPublicPicks(
  picks: TodayPick[],
  filters: PublicPicksLedgerFilters,
  now: Date = new Date(),
): TodayPick[] {
  const cutoffDays =
    filters.window === "7d" ? 7 : filters.window === "30d" ? 30 : null;
  const cutoff =
    cutoffDays == null ? null : now.getTime() - cutoffDays * 86_400_000;

  return picks.filter((pick) => {
    if (filters.sport !== "all" && pick.sport.toUpperCase() !== filters.sport) {
      return false;
    }
    if (cutoff != null && new Date(pick.postedAt).getTime() < cutoff)
      return false;
    if (filters.status === "graded" && !GRADED_STATUSES.has(pick.status))
      return false;
    if (filters.status === "live" && pick.status !== "live") return false;
    if (
      filters.status === "pending" &&
      pick.status !== "pending" &&
      pick.status !== "pre-game" &&
      pick.status !== "awaiting-grade"
    ) {
      return false;
    }
    return true;
  });
}

export function publicPickProofState(pick: TodayPick): ProofReceiptState {
  switch (pick.status) {
    case "win":
      return "won";
    case "loss":
      return "loss";
    case "push":
      return "push";
    case "void":
      return "void";
    case "live":
      return "live";
    case "awaiting-grade":
      return "awaiting-grade";
    case "pre-game":
    case "pending":
    default:
      return pick.verificationTier && isVerifiedTier(pick.verificationTier)
        ? "captured"
        : "pending";
  }
}

export function isPublicPickGraded(pick: TodayPick): boolean {
  return GRADED_STATUSES.has(pick.status);
}
