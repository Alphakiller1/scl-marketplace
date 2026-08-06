/**
 * Minimal Whop REST client — raw fetch, no SDK dependency.
 * @see https://docs.whop.com/developer/api/getting-started
 */

const WHOP_API_BASE = "https://api.whop.com/api/v1";

export type WhopApiError = {
  status: number;
  message: string;
};

export type WhopCompanyListItem = {
  id: string;
  route: string;
  title?: string | null;
};

export type WhopProductListItem = {
  id: string;
  route: string;
  title: string;
  headline?: string | null;
  visibility?: string | null;
};

type WhopListResponse<T> = {
  data: T[];
  page_info?: {
    end_cursor?: string | null;
    has_next_page?: boolean;
  };
};

async function whopFetch<T>(
  path: string,
  accessToken: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(`${WHOP_API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw {
      status: res.status,
      message: body.error?.message || `Whop API ${path} failed (${res.status})`,
    } satisfies WhopApiError;
  }

  return (await res.json()) as T;
}

export async function listWhopCompanies(
  accessToken: string,
): Promise<WhopCompanyListItem[]> {
  const res = await whopFetch<WhopListResponse<WhopCompanyListItem>>(
    "/companies",
    accessToken,
    { first: 10 },
  );
  return res.data ?? [];
}

export async function listWhopProducts(input: {
  accessToken: string;
  companyId: string;
}): Promise<WhopProductListItem[]> {
  const products: WhopProductListItem[] = [];
  let after: string | undefined;

  for (let page = 0; page < 10; page += 1) {
    const res = await whopFetch<WhopListResponse<WhopProductListItem>>(
      "/products",
      input.accessToken,
      {
        company_id: input.companyId,
        first: 50,
        after,
      },
    );
    products.push(...(res.data ?? []));
    if (!res.page_info?.has_next_page || !res.page_info.end_cursor) break;
    after = res.page_info.end_cursor;
  }

  return products;
}

/** Public Whop checkout URL with SCL affiliate attribution. */
export function buildWhopProductCheckoutUrl(input: {
  companyRoute: string;
  productRoute: string;
  affiliateUsername: string;
}): string {
  const url = new URL(
    `https://whop.com/${input.companyRoute}/${input.productRoute}`,
  );
  url.searchParams.set("a", input.affiliateUsername);
  return url.toString();
}

export function isWhopApiConfigured(accessToken: string | null | undefined) {
  return Boolean(accessToken?.trim());
}
