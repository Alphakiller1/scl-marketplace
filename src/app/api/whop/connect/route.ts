import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  serializeWhopPkceCookie,
  whopOAuthCookieDomain,
} from "@/lib/whop-oauth-cookie";
import { buildWhopAuthorizeUrl, generatePkceState } from "@/lib/whop-oauth";
import { ensureWhopOAuthRedirectRegistered } from "@/lib/whop-oauth-register";
import { whopOAuthRedirectUri } from "@/lib/whop-oauth-redirect";
import {
  whopAppApiKey,
  whopAppId,
  whopOAuthConfigured,
} from "@/lib/whop-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PKCE_COOKIE = "whop_oauth_pkce";
const PKCE_MAX_AGE = 60 * 10;

function monetizationRedirect(code: string, origin: string) {
  return NextResponse.redirect(
    new URL(`/dashboard/monetization?whop=${code}`, origin),
  );
}

/**
 * Start the Whop app-install OAuth flow for the signed-in capper.
 * Requires an existing WHOP StoreConnection in INSTRUCTIONS_VIEWED or later.
 * Always redirects back to monetization with a toastable `?whop=` code —
 * never dumps raw JSON into the browser.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const redirectUri = whopOAuthRedirectUri();
  if (!whopOAuthConfigured()) {
    return monetizationRedirect("not-configured", origin);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL("/login?callbackUrl=/dashboard/monetization", origin),
    );
  }

  const profile = await prisma.capperProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    return monetizationRedirect("profile-missing", origin);
  }

  const connection = await prisma.storeConnection.findUnique({
    where: {
      capperId_provider: { capperId: profile.id, provider: "WHOP" },
    },
    select: { id: true, status: true },
  });
  if (!connection || connection.status === "NOT_STARTED") {
    return monetizationRedirect("start-setup", origin);
  }
  if (connection.status === "DISABLED") {
    return monetizationRedirect("suspended", origin);
  }

  const appId = whopAppId();
  const appSecret = whopAppApiKey();
  if (!appId || !appSecret) {
    return monetizationRedirect("not-configured", origin);
  }

  const redirectSync = await ensureWhopOAuthRedirectRegistered(redirectUri);
  if (redirectSync === "missing") {
    return monetizationRedirect("oauth-misconfigured", origin);
  }

  const pkce = generatePkceState(profile.id, connection.id, origin);
  const cookieStore = await cookies();
  const cookieDomain = whopOAuthCookieDomain(origin);
  cookieStore.delete(PKCE_COOKIE);
  cookieStore.set(PKCE_COOKIE, serializeWhopPkceCookie(pkce, appSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PKCE_MAX_AGE,
    path: "/api/whop",
    ...(cookieDomain && { domain: cookieDomain }),
  });

  const authorizeUrl = buildWhopAuthorizeUrl({
    clientId: appId,
    redirectUri,
    pkce,
  });

  return NextResponse.redirect(authorizeUrl);
}
