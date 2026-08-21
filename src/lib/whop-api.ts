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
  company?: WhopCompanyListItem | null;
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

export async function retrieveWhopCompany(
  accessToken: string,
  companyId: string,
): Promise<WhopCompanyListItem> {
  return whopFetch<WhopCompanyListItem>(
    `/companies/${encodeURIComponent(companyId)}`,
    accessToken,
  );
}

export async function retrieveWhopProduct(
  accessToken: string,
  productId: string,
): Promise<WhopProductListItem> {
  return whopFetch<WhopProductListItem>(
    `/products/${encodeURIComponent(productId)}`,
    accessToken,
  );
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

export type WhopAppRecord = {
  id: string;
  redirect_uris?: string[] | null;
};

function unwrapWhopApp(
  raw: WhopAppRecord | { data: WhopAppRecord },
): WhopAppRecord {
  if (
    "data" in raw &&
    raw.data &&
    typeof raw.data === "object" &&
    "id" in raw.data
  ) {
    return raw.data;
  }
  return raw as WhopAppRecord;
}

export async function retrieveWhopApp(
  accessToken: string,
  appId: string,
): Promise<WhopAppRecord> {
  const raw = await whopFetch<WhopAppRecord | { data: WhopAppRecord }>(
    `/apps/${encodeURIComponent(appId)}`,
    accessToken,
  );
  return unwrapWhopApp(raw);
}

/**
 * Merge OAuth callback URLs onto the Whop app. Replacing the list wholesale
 * would drop any extra URIs the owner already registered.
 */
export async function mergeWhopAppRedirectUris(input: {
  accessToken: string;
  appId: string;
  redirectUris: string[];
}): Promise<
  | { ok: true; redirectUris: string[] }
  | { ok: false; error: string; redirectUris?: string[] }
> {
  if (!isWhopApiConfigured(input.accessToken)) {
    return { ok: false, error: "Whop is not configured." };
  }
  try {
    const app = await retrieveWhopApp(input.accessToken, input.appId);
    const current = app.redirect_uris ?? [];
    const merged = Array.from(new Set([...current, ...input.redirectUris]));
    if (
      input.redirectUris.every((uri) => current.includes(uri)) &&
      merged.length === current.length
    ) {
      return { ok: true, redirectUris: current };
    }
    const res = await fetch(
      `${WHOP_API_BASE}/apps/${encodeURIComponent(input.appId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ redirect_uris: merged }),
        cache: "no-store",
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Whop rejected the redirect URI sync (HTTP ${res.status})${body ? `: ${body.slice(0, 180)}` : ""}`,
        redirectUris: current,
      };
    }
    return { ok: true, redirectUris: merged };
  } catch (err) {
    const message =
      typeof err === "object" && err && "message" in err
        ? String((err as { message: string }).message)
        : "Could not reach Whop.";
    console.error("[whop-api] mergeWhopAppRedirectUris failed:", err);
    return { ok: false, error: message };
  }
}

/**
 * Fields SCL is willing to push back to Whop.
 *
 * Price is deliberately absent. On Whop a price lives on a Plan, not the
 * Product, and writing one changes what real customers are charged. SCL owns
 * how an offer is *presented*; Whop stays the source of truth for money.
 */
export type WhopProductUpdate = {
  title?: string;
  headline?: string | null;
  visibility?: "visible" | "hidden";
  /** Stamped so the inbound webhook can recognise SCL's own echo. */
  metadata?: Record<string, string>;
};

/**
 * PATCH /products/{id} — the write half of the two-way storefront sync.
 *
 * Needs `access_pass:update` and `access_pass:basic:read` on the app. Returns
 * a typed failure rather than throwing: a storefront edit in SCL must still
 * save even when Whop rejects the push.
 */
export async function updateWhopProduct(input: {
  accessToken: string;
  productId: string;
  update: WhopProductUpdate;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isWhopApiConfigured(input.accessToken)) {
    return { ok: false, error: "Whop is not connected for this capper." };
  }
  try {
    const res = await fetch(
      `${WHOP_API_BASE}/products/${encodeURIComponent(input.productId)}`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${input.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input.update),
        cache: "no-store",
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Whop rejected the update (HTTP ${res.status})${body ? `: ${body.slice(0, 180)}` : ""}`,
      };
    }
    return { ok: true };
  } catch (err) {
    console.error("[whop-api] updateWhopProduct failed:", err);
    return { ok: false, error: "Could not reach Whop." };
  }
}
