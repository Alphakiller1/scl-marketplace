import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  parseWhopPkceCookie,
  whopOAuthCookieDomain,
  whopOAuthReturnOrigin,
} from "@/lib/whop-oauth-cookie";
import {
  exchangeWhopAuthorizationCode,
  type WhopPkceState,
} from "@/lib/whop-oauth";
import { whopOAuthRedirectUri } from "@/lib/whop-oauth-redirect";
import { listWhopCompanies, listWhopPlans } from "@/lib/whop-api";
import { isWhopPlanReadPermissionError } from "@/lib/whop-app-permissions";
import { persistWhopOAuthCredentials } from "@/lib/whop-sync";
import {
  whopAppApiKey,
  whopAppId,
  whopOAuthConfigured,
  whopStorefrontApiKey,
} from "@/lib/whop-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PKCE_COOKIE = "whop_oauth_pkce";

function monetizationUrl(origin: string, query?: Record<string, string>) {
  const url = new URL("/dashboard/monetization", origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

/**
 * Whop OAuth callback — exchanges the authorization code, records that the
 * capper installed the SCL app, and returns them to the storefront setup page.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const redirectUri = whopOAuthRedirectUri();
  const params = req.nextUrl.searchParams;
  if (!whopOAuthConfigured()) {
    return NextResponse.redirect(
      monetizationUrl(origin, { whop: "not-configured" }),
    );
  }

  const appId = whopAppId();
  const appSecret = whopAppApiKey();
  if (!appId || !appSecret) {
    return NextResponse.redirect(
      monetizationUrl(origin, { whop: "not-configured" }),
    );
  }

  const cookieStore = await cookies();
  const rawPkce = cookieStore.get(PKCE_COOKIE)?.value;
  const cookieDomain = whopOAuthCookieDomain(origin);
  cookieStore.set(PKCE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/api/whop",
    ...(cookieDomain && { domain: cookieDomain }),
  });

  const pkce: WhopPkceState | null = parseWhopPkceCookie(rawPkce, appSecret);
  const returnOrigin = whopOAuthReturnOrigin(pkce?.returnOrigin, origin);

  const oauthError = params.get("error");
  if (oauthError) {
    const description = params.get("error_description") || oauthError;
    console.warn(`[whop/callback] OAuth error: ${description}`);
    return NextResponse.redirect(
      monetizationUrl(returnOrigin, {
        whop: "oauth-denied",
        reason: description.slice(0, 120),
      }),
    );
  }

  const code = params.get("code");
  const returnedState = params.get("state");
  if (!code || !returnedState) {
    return NextResponse.redirect(
      monetizationUrl(returnOrigin, { whop: "invalid-callback" }),
    );
  }

  if (!pkce) {
    return NextResponse.redirect(
      monetizationUrl(returnOrigin, { whop: "session-expired" }),
    );
  }

  if (!pkce?.state || pkce.state !== returnedState) {
    return NextResponse.redirect(
      monetizationUrl(returnOrigin, { whop: "state-mismatch" }),
    );
  }

  let tokens;
  try {
    tokens = await exchangeWhopAuthorizationCode({
      code,
      clientId: appId,
      clientSecret: appSecret,
      redirectUri,
      codeVerifier: pkce.codeVerifier,
    });
  } catch (error) {
    console.error("[whop/callback] token exchange failed:", error);
    return NextResponse.redirect(
      monetizationUrl(returnOrigin, { whop: "exchange-failed" }),
    );
  }

  let companies: Array<{ id: string; route: string }> = [];
  try {
    companies = await listWhopCompanies(tokens.access_token);
  } catch (error) {
    console.error("[whop/callback] company lookup failed:", error);
    return NextResponse.redirect(
      monetizationUrl(returnOrigin, { whop: "company-missing" }),
    );
  }

  const persisted = await persistWhopOAuthCredentials({
    storeConnectionId: pkce.connectionId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    companies,
  });
  if (!persisted.ok) {
    return NextResponse.redirect(
      monetizationUrl(returnOrigin, {
        whop: "company-missing",
        reason: persisted.error,
      }),
    );
  }

  // A successful OAuth exchange only proves identity. Verify the installed
  // business granted the app permission needed for package price/cadence sync
  // before telling the capper that setup succeeded.
  let permissionFailure: "missing" | "unavailable" | null = null;
  const companyId = companies[0]?.id;
  const storefrontApiKey = whopStorefrontApiKey(tokens.access_token);
  if (!companyId || !storefrontApiKey) {
    permissionFailure = "unavailable";
  } else {
    try {
      await listWhopPlans({ accessToken: storefrontApiKey, companyId });
    } catch (error) {
      permissionFailure = isWhopPlanReadPermissionError(error)
        ? "missing"
        : "unavailable";
      console.error(
        `[whop/callback] post-install plan permission probe failed for ${companyId}:`,
        error,
      );
    }
  }

  const connection = await prisma.storeConnection.findUnique({
    where: { id: pkce.connectionId },
    select: { id: true, status: true, adminNotes: true },
  });
  if (!connection) {
    return NextResponse.redirect(
      monetizationUrl(returnOrigin, { whop: "connection-missing" }),
    );
  }

  const stamp = new Date().toISOString();
  const permissionNote =
    permissionFailure === "missing"
      ? " Required plan:basic:read permission was not granted; connection marked NEEDS_ACTION."
      : permissionFailure === "unavailable"
        ? " SCL could not verify plan access; connection marked NEEDS_ACTION."
        : " Required plan:basic:read permission verified.";
  const noteLine = `[${stamp}] Capper installed the SCL Whop app via OAuth (${companies[0]?.id ?? "unknown company"}).${permissionNote}`;
  const adminNotes = connection.adminNotes
    ? `${connection.adminNotes}\n${noteLine}`
    : noteLine;

  await prisma.storeConnection.update({
    where: { id: connection.id },
    data: {
      adminNotes,
      ...(permissionFailure && connection.status !== "DISABLED"
        ? { status: "NEEDS_ACTION" as const, requiresAttention: true }
        : {}),
    },
  });

  revalidatePath("/dashboard/monetization");
  revalidatePath("/admin/store-setup");

  const whopResult =
    permissionFailure === "missing"
      ? "permissions-required"
      : permissionFailure === "unavailable"
        ? "permission-check-failed"
        : "connected";
  return NextResponse.redirect(
    monetizationUrl(returnOrigin, { whop: whopResult }),
  );
}
