import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site-url";
import {
  exchangeWhopAuthorizationCode,
  type WhopPkceState,
} from "@/lib/whop-oauth";
import { listWhopCompanies } from "@/lib/whop-api";
import { persistWhopOAuthCredentials } from "@/lib/whop-sync";
import {
  whopAppApiKey,
  whopAppId,
  whopOAuthConfigured,
} from "@/lib/whop-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PKCE_COOKIE = "whop_oauth_pkce";

function redirectUri() {
  return `${siteUrl()}/api/whop/callback`;
}

function monetizationUrl(query?: Record<string, string>) {
  const url = new URL("/dashboard/monetization", siteUrl());
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
  const params = req.nextUrl.searchParams;
  const oauthError = params.get("error");
  if (oauthError) {
    const description = params.get("error_description") || oauthError;
    console.warn(`[whop/callback] OAuth error: ${description}`);
    return NextResponse.redirect(
      monetizationUrl({
        whop: "oauth-denied",
        reason: description.slice(0, 120),
      }),
    );
  }

  if (!whopOAuthConfigured()) {
    return NextResponse.redirect(monetizationUrl({ whop: "not-configured" }));
  }

  const code = params.get("code");
  const returnedState = params.get("state");
  if (!code || !returnedState) {
    return NextResponse.redirect(monetizationUrl({ whop: "invalid-callback" }));
  }

  const cookieStore = await cookies();
  const rawPkce = cookieStore.get(PKCE_COOKIE)?.value;
  cookieStore.delete(PKCE_COOKIE);

  let pkce: WhopPkceState;
  try {
    pkce = JSON.parse(rawPkce || "null") as WhopPkceState;
  } catch {
    return NextResponse.redirect(monetizationUrl({ whop: "session-expired" }));
  }

  if (!pkce?.state || pkce.state !== returnedState) {
    return NextResponse.redirect(monetizationUrl({ whop: "state-mismatch" }));
  }

  const appId = whopAppId();
  const appSecret = whopAppApiKey();
  if (!appId || !appSecret) {
    return NextResponse.redirect(monetizationUrl({ whop: "not-configured" }));
  }

  let tokens;
  try {
    tokens = await exchangeWhopAuthorizationCode({
      code,
      clientId: appId,
      clientSecret: appSecret,
      redirectUri: redirectUri(),
      codeVerifier: pkce.codeVerifier,
    });
  } catch (error) {
    console.error("[whop/callback] token exchange failed:", error);
    return NextResponse.redirect(monetizationUrl({ whop: "exchange-failed" }));
  }

  let companies: Array<{ id: string; route: string }> = [];
  try {
    companies = await listWhopCompanies(tokens.access_token);
  } catch (error) {
    console.error("[whop/callback] company lookup failed:", error);
    return NextResponse.redirect(monetizationUrl({ whop: "company-missing" }));
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
      monetizationUrl({ whop: "company-missing", reason: persisted.error }),
    );
  }

  const connection = await prisma.storeConnection.findUnique({
    where: { id: pkce.connectionId },
    select: { id: true, adminNotes: true },
  });
  if (!connection) {
    return NextResponse.redirect(
      monetizationUrl({ whop: "connection-missing" }),
    );
  }

  const stamp = new Date().toISOString();
  const noteLine = `[${stamp}] Capper installed the SCL Whop app via OAuth (${companies[0]?.id ?? "unknown company"}).`;
  const adminNotes = connection.adminNotes
    ? `${connection.adminNotes}\n${noteLine}`
    : noteLine;

  await prisma.storeConnection.update({
    where: { id: connection.id },
    data: { adminNotes },
  });

  revalidatePath("/dashboard/monetization");
  revalidatePath("/admin/store-setup");

  return NextResponse.redirect(monetizationUrl({ whop: "connected" }));
}
