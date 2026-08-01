export const ADMIN_CAPPERS_PAGE_SIZE = 30;

export type AdminCapperStatusFilter =
  | "all"
  | "pending"
  | "active"
  | "suspended"
  | "disabled";
export type AdminCapperVerificationFilter = "all" | "verified" | "unverified";
export type AdminCapperScopeFilter = "all" | "public" | "test";
export type AdminCapperStorefrontFilter =
  | "all"
  | "none"
  | "pending"
  | "live"
  | "attention";

export type AdminCapperFilters = {
  search: string;
  status: AdminCapperStatusFilter;
  verification: AdminCapperVerificationFilter;
  scope: AdminCapperScopeFilter;
  storefront: AdminCapperStorefrontFilter;
  page: number;
};

export type AdminCapperSearchParams = Record<
  string,
  string | string[] | undefined
>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function oneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function parseAdminCapperFilters(
  searchParams: AdminCapperSearchParams,
): AdminCapperFilters {
  const parsedPage = Number.parseInt(first(searchParams.page), 10);

  return {
    search: first(searchParams.q).trim().slice(0, 80),
    status: oneOf(
      first(searchParams.status).toLowerCase(),
      ["all", "pending", "active", "suspended", "disabled"] as const,
      "all",
    ),
    verification: oneOf(
      first(searchParams.verification).toLowerCase(),
      ["all", "verified", "unverified"] as const,
      "all",
    ),
    scope: oneOf(
      first(searchParams.scope).toLowerCase(),
      ["all", "public", "test"] as const,
      "all",
    ),
    storefront: oneOf(
      first(searchParams.storefront).toLowerCase(),
      ["all", "none", "pending", "live", "attention"] as const,
      "all",
    ),
    page:
      Number.isSafeInteger(parsedPage) && parsedPage > 0
        ? Math.min(parsedPage, 10_000)
        : 1,
  };
}

export function adminCappersHref(
  filters: AdminCapperFilters,
  page = filters.page,
): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.verification !== "all")
    params.set("verification", filters.verification);
  if (filters.scope !== "all") params.set("scope", filters.scope);
  if (filters.storefront !== "all")
    params.set("storefront", filters.storefront);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/cappers?${query}` : "/admin/cappers";
}
