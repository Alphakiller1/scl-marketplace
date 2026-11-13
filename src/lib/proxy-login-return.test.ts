import assert from "node:assert/strict";
import test from "node:test";

import { getSafeCallbackPath } from "@/lib/auth-routing";
import { loadTestModule } from "@/lib/test-support/load-module";

type ProxyRequest = {
  nextUrl: URL;
  auth: { user: Record<string, unknown> } | null;
};
type ProxyResult = { redirect: string } | "next";

function loadProxy() {
  const mod = loadTestModule<{ default: (req: ProxyRequest) => ProxyResult }>(
    "src/proxy.ts",
    {
      // NextAuth(config).auth(handler) hands the request straight to handler.
      "next-auth": {
        __esModule: true,
        default: () => ({
          auth: (handler: (req: ProxyRequest) => ProxyResult) => handler,
        }),
      },
      "next/server": {
        NextResponse: {
          redirect: (url: URL) => ({ redirect: url.toString() }),
          next: () => "next",
        },
      },
      "@/auth.config": { authConfig: {} },
      "@/lib/email-verification-policy": {
        emailVerificationEnforced: () => false,
      },
    },
    { URL },
  );
  return mod.default;
}

function loginReturn(path: string): string | null {
  const result = loadProxy()({
    nextUrl: new URL(path, "https://sportscappersleaderboard.com"),
    auth: null,
  });
  assert.notEqual(result, "next", `${path} should send a guest to login`);
  const login = new URL((result as { redirect: string }).redirect);
  assert.equal(login.pathname, "/login");
  return login.searchParams.get("callbackUrl");
}

test("a guest returns to the exact page after login, query string included", () => {
  // The grading-request email links an admin straight to the request.
  assert.equal(
    loginReturn("/admin/plays/straight/play_1?request=req_9"),
    "/admin/plays/straight/play_1?request=req_9",
  );
  // A capper's request screen carries its type in the query.
  assert.equal(
    loginReturn("/dashboard/picks/parlay/t1/request?type=injury-protection"),
    "/dashboard/picks/parlay/t1/request?type=injury-protection",
  );
  assert.equal(
    loginReturn("/admin/grading/requests?status=all"),
    "/admin/grading/requests?status=all",
  );
  assert.equal(loginReturn("/dashboard/picks"), "/dashboard/picks");
});

test("the return path survives the login page's same-origin check", () => {
  const back = loginReturn("/admin/plays/parlay/t1?request=req_9");
  assert.equal(
    getSafeCallbackPath(back),
    "/admin/plays/parlay/t1?request=req_9",
  );
  // The check still refuses anything that would leave the site.
  assert.equal(getSafeCallbackPath("//evil.example/x?request=1"), null);
  assert.equal(getSafeCallbackPath("https://evil.example/dashboard"), null);
});

test("signed-in visitors and public pages are untouched", () => {
  const proxy = loadProxy();
  assert.equal(
    proxy({
      nextUrl: new URL("https://x.test/dashboard/picks?sort=roi"),
      auth: { user: { role: "CAPPER", accountStatus: "ACTIVE" } },
    }),
    "next",
  );
});
