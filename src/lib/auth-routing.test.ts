import assert from "node:assert/strict";
import test from "node:test";

import { getDefaultWorkspace, getSafeCallbackPath } from "@/lib/auth-routing";

test("admins default to the admin console", () => {
  assert.deepEqual(getDefaultWorkspace("ADMIN"), {
    href: "/admin",
    label: "Admin Console",
  });
});

test("non-admin users default to the capper dashboard", () => {
  assert.equal(getDefaultWorkspace("CAPPER").href, "/dashboard");
  assert.equal(getDefaultWorkspace(undefined).href, "/dashboard");
});

test("callback paths preserve safe same-origin routes", () => {
  assert.equal(
    getSafeCallbackPath("/admin/store-setup?provider=WHOP#packages"),
    "/admin/store-setup?provider=WHOP#packages",
  );
});

test("callback paths reject external redirects", () => {
  assert.equal(getSafeCallbackPath("https://example.com"), null);
  assert.equal(getSafeCallbackPath("//example.com/admin"), null);
  assert.equal(getSafeCallbackPath("/\\example.com/admin"), null);
  assert.equal(getSafeCallbackPath(null), null);
});
