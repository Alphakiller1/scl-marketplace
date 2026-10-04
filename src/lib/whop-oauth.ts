import { createHash, randomBytes } from "node:crypto";

/** Identity scopes used alongside the app's Whop product permissions. */
export const WHOP_OAUTH_SCOPES = "openid profile email";

const WHOP_AUTHORIZE_URL = "https://api.whop.com/oauth/authorize";
const WHOP_TOKEN_URL = "https://api.whop.com/oauth/token";

export type WhopPkceState = {
  codeVerifier: string;
  state: string;
  nonce: string;
  capperProfileId: string;
  connectionId: string;
  companyId?: string;
  returnOrigin?: string;
};

export type WhopTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  id_token?: string;
};

function base64url(bytes: Buffer): string {
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generatePkceState(
  capperProfileId: string,
  connectionId: string,
  returnOrigin?: string,
  companyId?: string,
): WhopPkceState {
  return {
    codeVerifier: base64url(randomBytes(32)),
    state: base64url(randomBytes(16)),
    nonce: base64url(randomBytes(16)),
    capperProfileId,
    connectionId,
    ...(companyId && { companyId }),
    ...(returnOrigin && { returnOrigin }),
  };
}

/** Whop business IDs are visible in dashboard URLs as `biz_...`. */
export function normalizeWhopCompanyId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && /^biz_[A-Za-z0-9]+$/.test(trimmed) ? trimmed : null;
}

export function pkceCodeChallenge(codeVerifier: string): string {
  return base64url(createHash("sha256").update(codeVerifier).digest());
}

export function buildWhopAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  pkce: WhopPkceState;
  companyId?: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: WHOP_OAUTH_SCOPES,
    state: input.pkce.state,
    nonce: input.pkce.nonce,
    code_challenge: pkceCodeChallenge(input.pkce.codeVerifier),
    code_challenge_method: "S256",
    ...(input.companyId && { company_id: input.companyId }),
  });
  return `${WHOP_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeWhopAuthorizationCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<WhopTokenResponse> {
  const res = await fetch(WHOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code_verifier: input.codeVerifier,
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string;
      error_description?: string;
    };
    throw new Error(
      err.error_description ||
        err.error ||
        `Whop token exchange failed (${res.status})`,
    );
  }

  return (await res.json()) as WhopTokenResponse;
}

/** Refresh an expired capper OAuth access token so storefront sync stays permanent. */
export async function refreshWhopAccessToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  companyId?: string;
}): Promise<WhopTokenResponse> {
  const res = await fetch(WHOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      ...(input.companyId && { company_id: input.companyId }),
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string;
      error_description?: string;
    };
    throw new Error(
      err.error_description ||
        err.error ||
        `Whop token refresh failed (${res.status})`,
    );
  }

  return (await res.json()) as WhopTokenResponse;
}
