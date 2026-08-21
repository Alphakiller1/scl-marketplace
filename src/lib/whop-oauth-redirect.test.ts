import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  whopOAuthRedirectUri,
  whopOAuthRedirectUrisToRegister,
} from "@/lib/whop-oauth-redirect";

const ORIGINAL = {
  site: process.env.NEXT_PUBLIC_SITE_URL,
  vercel: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  redirect: process.env.WHOP_OAUTH_REDIRECT_URI,
};

afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL.site;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = ORIGINAL.vercel;
  process.env.WHOP_OAUTH_REDIRECT_URI = ORIGINAL.redirect;
  if (ORIGINAL.site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  if (ORIGINAL.vercel === undefined)
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (ORIGINAL.redirect === undefined)
    delete process.env.WHOP_OAUTH_REDIRECT_URI;
});

test("production and Vercel hosts send the custom-domain Whop callback", () => {
  delete process.env.WHOP_OAUTH_REDIRECT_URI;
  process.env.NEXT_PUBLIC_SITE_URL = "https://sportscappersleaderboard.com";
  assert.equal(
    whopOAuthRedirectUri(),
    "https://sportscappersleaderboard.com/api/whop/callback",
  );

  process.env.NEXT_PUBLIC_SITE_URL =
    "https://www.sportscappersleaderboard.com/";
  assert.equal(
    whopOAuthRedirectUri(),
    "https://sportscappersleaderboard.com/api/whop/callback",
  );

  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "scl-marketplace.vercel.app";
  assert.equal(
    whopOAuthRedirectUri(),
    "https://sportscappersleaderboard.com/api/whop/callback",
  );
});

test("localhost keeps a local callback so dev OAuth does not hit production", () => {
  delete process.env.WHOP_OAUTH_REDIRECT_URI;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  assert.equal(
    whopOAuthRedirectUri(),
    "http://localhost:3000/api/whop/callback",
  );
});

test("WHOP_OAUTH_REDIRECT_URI wins and drops a trailing slash", () => {
  process.env.WHOP_OAUTH_REDIRECT_URI =
    "https://sportscappersleaderboard.com/api/whop/callback/";
  assert.equal(
    whopOAuthRedirectUri(),
    "https://sportscappersleaderboard.com/api/whop/callback",
  );
});

test("the allowlist always includes apex and www", () => {
  delete process.env.WHOP_OAUTH_REDIRECT_URI;
  process.env.NEXT_PUBLIC_SITE_URL = "https://sportscappersleaderboard.com";
  const uris = whopOAuthRedirectUrisToRegister();
  assert.ok(
    uris.includes("https://sportscappersleaderboard.com/api/whop/callback"),
  );
  assert.ok(
    uris.includes("https://www.sportscappersleaderboard.com/api/whop/callback"),
  );
});
