import { SPORT_KEYS } from "@/lib/constants";

export const ADMIN_PLAYS_PAGE_SIZE = 50;

export type AdminPublishedPlayStatus = "all" | "pending" | "graded";
export type AdminPublishedRecordType = "straight" | "parlay";

export type AdminPublishedPlayFilters = {
  search: string;
  sport: string;
  status: AdminPublishedPlayStatus;
  recordType: AdminPublishedRecordType;
  page: number;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminPublishedPlayFilters(
  params: Record<string, string | string[] | undefined>,
): AdminPublishedPlayFilters {
  const search = first(params.search)?.trim().slice(0, 80) ?? "";
  const sport = first(params.sport)?.trim().toUpperCase() ?? "";
  const status = first(params.status);
  const recordType = first(params.type);
  const page = Number.parseInt(first(params.page) ?? "1", 10);

  return {
    search,
    // Allowlist against the real sport keys, never a shape test: the filter
    // form always submits the "all" sentinel, and uppercasing it produced a
    // code that passed a shape test and then matched no play at all — every
    // "Apply filters" press returned an empty register.
    sport: SPORT_KEYS.includes(sport as never) ? sport : "all",
    status: status === "pending" || status === "graded" ? status : "all",
    recordType: recordType === "parlay" ? "parlay" : "straight",
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

export function adminPublishedPlaysHref(
  filters: AdminPublishedPlayFilters,
  page: number,
): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.sport !== "all") params.set("sport", filters.sport);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.recordType === "parlay") params.set("type", "parlay");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/plays?${query}` : "/admin/plays";
}
