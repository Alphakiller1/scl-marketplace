import assert from "node:assert/strict";
import test from "node:test";

import {
  adminPublishedPlaysHref,
  parseAdminPublishedPlayFilters,
} from "@/lib/admin-published-plays";

test("admin published-play filters normalize bounded query values", () => {
  assert.deepEqual(
    parseAdminPublishedPlayFilters({
      search: "  capper name ",
      sport: "nba",
      status: "graded",
      page: "3",
    }),
    {
      search: "capper name",
      sport: "NBA",
      status: "graded",
      recordType: "straight",
      page: 3,
    },
  );
});

test("admin published-play filters reject unsupported values", () => {
  assert.deepEqual(
    parseAdminPublishedPlayFilters({
      sport: "../../all",
      status: "deleted",
      page: "-1",
    }),
    {
      search: "",
      sport: "all",
      status: "all",
      recordType: "straight",
      page: 1,
    },
  );
});

test("the sport sentinel the filter form submits stays a sentinel", () => {
  // The register's filter form is a native GET, so every press of "Apply
  // filters" submits sport=all. Uppercasing that into a literal sport code
  // filtered the register down to a sport nothing is logged under.
  for (const value of ["all", "ALL", "All"]) {
    assert.equal(
      parseAdminPublishedPlayFilters({ sport: value }).sport,
      "all",
      `sport=${value} must not become a sport code`,
    );
  }
});

test("admin published-play filters keep real sport codes", () => {
  assert.equal(parseAdminPublishedPlayFilters({ sport: "wnba" }).sport, "WNBA");
  assert.equal(parseAdminPublishedPlayFilters({ sport: "XFL" }).sport, "all");
});

test("admin published-play pagination preserves active filters", () => {
  assert.equal(
    adminPublishedPlaysHref(
      {
        search: "sharp",
        sport: "NFL",
        status: "pending",
        recordType: "parlay",
        page: 1,
      },
      2,
    ),
    "/admin/plays?search=sharp&sport=NFL&status=pending&type=parlay&page=2",
  );
});
