import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { ensureWhopOAuthRedirectRegistered } from "@/lib/whop-oauth-register";

const ORIGINAL = {
  appId: process.env.WHOP_APP_ID,
  publicAppId: process.env.NEXT_PUBLIC_WHOP_APP_ID,
  appKey: process.env.WHOP_APP_API_KEY,
  clientSecret: process.env.WHOP_CLIENT_SECRET,
  accountKey: process.env.WHOP_API_KEY,
  fetch: globalThis.fetch,
  consoleError: console.error,
};

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restoreEnv("WHOP_APP_ID", ORIGINAL.appId);
  restoreEnv("NEXT_PUBLIC_WHOP_APP_ID", ORIGINAL.publicAppId);
  restoreEnv("WHOP_APP_API_KEY", ORIGINAL.appKey);
  restoreEnv("WHOP_CLIENT_SECRET", ORIGINAL.clientSecret);
  restoreEnv("WHOP_API_KEY", ORIGINAL.accountKey);
  globalThis.fetch = ORIGINAL.fetch;
  console.error = ORIGINAL.consoleError;
});

function configureCredentials() {
  process.env.WHOP_APP_ID = "app_test";
  delete process.env.NEXT_PUBLIC_WHOP_APP_ID;
  process.env.WHOP_APP_API_KEY = "app-key";
  delete process.env.WHOP_CLIENT_SECRET;
  process.env.WHOP_API_KEY = "account-key";
  console.error = () => undefined;
}

test("falls back to the account key when the app key cannot update callbacks", async () => {
  configureCredentials();
  const authorizationHeaders: string[] = [];
  globalThis.fetch = async (_input, init) => {
    const authorization = new Headers(init?.headers).get("authorization") ?? "";
    authorizationHeaders.push(authorization);
    if (!init?.method) {
      return Response.json({ id: "app_test", redirect_uris: [] });
    }
    if (authorization === "Bearer app-key") {
      return new Response("missing developer:update_app", { status: 403 });
    }
    return Response.json({ id: "app_test" });
  };

  assert.equal(
    await ensureWhopOAuthRedirectRegistered("https://example.com/callback"),
    "ok",
  );
  assert.deepEqual(authorizationHeaders, [
    "Bearer app-key",
    "Bearer app-key",
    "Bearer account-key",
    "Bearer account-key",
  ]);
});

test("stops after the first credential verifies an existing callback", async () => {
  configureCredentials();
  const authorizationHeaders: string[] = [];
  globalThis.fetch = async (_input, init) => {
    authorizationHeaders.push(
      new Headers(init?.headers).get("authorization") ?? "",
    );
    return Response.json({
      id: "app_test",
      redirect_uris: ["https://example.com/callback"],
    });
  };

  assert.equal(
    await ensureWhopOAuthRedirectRegistered("https://example.com/callback"),
    "ok",
  );
  assert.deepEqual(authorizationHeaders, ["Bearer app-key"]);
});

test("reports missing only after a credential read the allowlist", async () => {
  configureCredentials();
  globalThis.fetch = async (_input, init) => {
    if (!init?.method) {
      return Response.json({ id: "app_test", redirect_uris: [] });
    }
    return new Response("forbidden", { status: 403 });
  };

  assert.equal(
    await ensureWhopOAuthRedirectRegistered("https://example.com/callback"),
    "missing",
  );
});
