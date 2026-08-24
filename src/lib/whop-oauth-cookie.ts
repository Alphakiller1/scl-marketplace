import { createHmac, timingSafeEqual } from "node:crypto";

import type { WhopPkceState } from "@/lib/whop-oauth";
import {
  SCL_PRODUCTION_ORIGIN,
  SCL_WWW_PRODUCTION_ORIGIN,
  whopOAuthRedirectUri,
} from "@/lib/whop-oauth-redirect";

const PRODUCTION_COOKIE_DOMAIN = "sportscappersleaderboard.com";
const PRODUCTION_ORIGINS = new Set([
  SCL_PRODUCTION_ORIGIN,
  SCL_WWW_PRODUCTION_ORIGIN,
]);

function normalizedOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** Share only the short-lived OAuth handoff between SCL's two public hosts. */
export function whopOAuthCookieDomain(
  requestOrigin: string,
): string | undefined {
  const origin = normalizedOrigin(requestOrigin);
  return origin && PRODUCTION_ORIGINS.has(origin)
    ? PRODUCTION_COOKIE_DOMAIN
    : undefined;
}

/** Never let cookie state turn the post-OAuth return into an open redirect. */
export function whopOAuthReturnOrigin(
  candidate: string | null | undefined,
  fallbackOrigin: string,
): string {
  const candidateOrigin = normalizedOrigin(candidate);
  if (candidateOrigin && PRODUCTION_ORIGINS.has(candidateOrigin)) {
    return candidateOrigin;
  }

  const callbackOrigin = new URL(whopOAuthRedirectUri()).origin;
  if (candidateOrigin === callbackOrigin) return candidateOrigin;

  if (process.env.NODE_ENV !== "production" && candidateOrigin) {
    const hostname = new URL(candidateOrigin).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return candidateOrigin;
    }
  }

  const safeFallback = normalizedOrigin(fallbackOrigin);
  if (safeFallback && PRODUCTION_ORIGINS.has(safeFallback)) {
    return safeFallback;
  }
  return callbackOrigin;
}

/** Sign the cross-host PKCE cookie so a sibling host cannot alter its owner. */
export function serializeWhopPkceCookie(
  pkce: WhopPkceState,
  secret: string,
): string {
  const payload = Buffer.from(JSON.stringify(pkce)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function validPkceState(value: unknown): value is WhopPkceState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<WhopPkceState>;
  return (
    typeof state.codeVerifier === "string" &&
    Boolean(state.codeVerifier) &&
    typeof state.state === "string" &&
    Boolean(state.state) &&
    typeof state.nonce === "string" &&
    Boolean(state.nonce) &&
    typeof state.capperProfileId === "string" &&
    Boolean(state.capperProfileId) &&
    typeof state.connectionId === "string" &&
    Boolean(state.connectionId) &&
    (state.returnOrigin === undefined || typeof state.returnOrigin === "string")
  );
}

export function parseWhopPkceCookie(
  raw: string | null | undefined,
  secret: string,
): WhopPkceState | null {
  if (!raw || !secret) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts as [string, string];
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  const actualBytes = Buffer.from(signature, "base64url");
  const expectedBytes = Buffer.from(expected, "base64url");
  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as unknown;
    return validPkceState(decoded) ? decoded : null;
  } catch {
    return null;
  }
}
