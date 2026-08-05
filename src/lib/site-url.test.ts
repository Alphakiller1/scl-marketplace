import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { siteUrl } from "./site-url";

const ORIGINAL = {
  site: process.env.NEXT_PUBLIC_SITE_URL,
  vercel: process.env.VERCEL_PROJECT_PRODUCTION_URL,
};

afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL.site;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = ORIGINAL.vercel;
  if (ORIGINAL.site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  if (ORIGINAL.vercel === undefined)
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
});

test("prefers NEXT_PUBLIC_SITE_URL", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://sportscappersleaderboard.com";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "scl-marketplace.vercel.app";
  assert.equal(siteUrl(), "https://sportscappersleaderboard.com");
});

test("strips a trailing slash so paths do not double up", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://sportscappersleaderboard.com/";
  assert.equal(siteUrl(), "https://sportscappersleaderboard.com");
});

test("adds a protocol when the env var is a bare host", () => {
  // VERCEL_PROJECT_PRODUCTION_URL is always supplied without a scheme.
  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "scl-marketplace.vercel.app";
  assert.equal(siteUrl(), "https://scl-marketplace.vercel.app");
});

test("ignores a blank NEXT_PUBLIC_SITE_URL and falls through", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "   ";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "example.vercel.app";
  assert.equal(siteUrl(), "https://example.vercel.app");
});

test("falls back to the deployment host when nothing is configured", () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  assert.equal(siteUrl(), "https://scl-marketplace.vercel.app");
});
