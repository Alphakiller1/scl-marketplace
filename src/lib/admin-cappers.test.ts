import assert from "node:assert/strict";
import test from "node:test";

import { adminCappersHref, parseAdminCapperFilters } from "@/lib/admin-cappers";

test("capper filters normalize invalid and repeated URL values", () => {
  assert.deepEqual(
    parseAdminCapperFilters({
      q: ["  sharp bettor  ", "ignored"],
      status: "suspended",
      verification: "unknown",
      scope: "test",
      storefront: "live",
      page: "-3",
    }),
    {
      search: "sharp bettor",
      status: "suspended",
      verification: "all",
      scope: "test",
      storefront: "live",
      page: 1,
    },
  );
});

test("capper filter links preserve active filters and omit defaults", () => {
  const filters = parseAdminCapperFilters({
    q: "ace@example.com",
    status: "ACTIVE",
    verification: "verified",
    storefront: "attention",
    page: "2",
  });

  assert.equal(
    adminCappersHref(filters, 3),
    "/admin/cappers?q=ace%40example.com&status=active&verification=verified&storefront=attention&page=3",
  );
  assert.equal(adminCappersHref(parseAdminCapperFilters({})), "/admin/cappers");
});
