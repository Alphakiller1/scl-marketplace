import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import test from "node:test";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import * as etDay from "@/lib/et-day";
import * as traffic from "@/lib/site-traffic";
import { loadTestModule } from "@/lib/test-support/load-module";
import type * as VisitRoute from "@/app/api/site-visits/route";
import type * as TrafficRoute from "@/app/api/admin/site-traffic/route";

function visitServer() {
  const rows = new Set<string>();
  const { POST } = loadTestModule<typeof VisitRoute>(
    "src/app/api/site-visits/route.ts",
    {
      "node:crypto": crypto,
      "next/server": { NextRequest, NextResponse },
      zod: { z },
      "@/lib/et-day": etDay,
      "@/lib/site-traffic": traffic,
      "@/lib/request-identity": {
        getRequestIdentity: async () => "test-browser",
      },
      "@/lib/rate-limit": { consumeRateLimit: async () => true },
      "@/lib/prisma": {
        prisma: {
          siteVisit: {
            createMany: async ({
              data,
              skipDuplicates,
            }: {
              data: { day: string; sessionHash: string }[];
              skipDuplicates: boolean;
            }) => {
              assert.equal(skipDuplicates, true);
              for (const row of data) {
                assert.match(row.sessionHash, /^[a-f0-9]{64}$/);
                rows.add(`${row.day}:${row.sessionHash}`);
              }
            },
          },
        },
      },
    },
    { process: { env: { VERCEL_ENV: "production" } } },
  );
  const request = (path: string, extraHeaders: Record<string, string> = {}) =>
    new NextRequest("https://scl.example/api/site-visits", {
      method: "POST",
      headers: {
        Origin: "https://scl.example",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 Chrome/140.0",
        ...extraHeaders,
      },
      body: JSON.stringify({ path }),
    });
  return { POST, rows, request };
}

test("reloads, retries, and concurrent navigations count one visit per session", async () => {
  const { POST, rows, request } = visitServer();
  const first = await POST(request("/"));
  assert.equal(first.status, 204);
  const cookie = first.cookies.get(traffic.SITE_VISIT_COOKIE);
  assert.ok(cookie);
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.maxAge, 1800);
  const cookieHeader = `${traffic.SITE_VISIT_COOKIE}=${cookie.value}`;
  await Promise.all([
    POST(request("/picks", { Cookie: cookieHeader })),
    POST(request("/leaderboard", { Cookie: cookieHeader })),
    POST(request("/", { Cookie: cookieHeader })),
  ]);
  assert.equal(rows.size, 1);
  await POST(request("/"));
  assert.equal(rows.size, 2, "a new browser session starts another visit");
});

test("admin pages, prefetches, known bots, and cross-origin requests cannot add visits", async () => {
  const { POST, rows, request } = visitServer();
  assert.equal((await POST(request("/admin"))).status, 400);
  assert.equal((await POST(request("/admin/cappers"))).status, 400);
  assert.equal((await POST(request("/api/health"))).status, 400);
  assert.equal(
    (await POST(request("/reset-password?token=private"))).status,
    400,
  );
  assert.equal(
    (await POST(request("/", { "Sec-Purpose": "prefetch" }))).status,
    204,
  );
  assert.equal(
    (await POST(request("/", { "User-Agent": "Mozilla/5.0 Googlebot/2.1" })))
      .status,
    204,
  );
  assert.equal(
    (await POST(request("/", { Origin: "https://other.example" }))).status,
    403,
  );
  assert.equal(rows.size, 0);
});

test("retrying a first visit without its lost response cookie does not count twice", async () => {
  const { POST, rows } = visitServer();
  const requestId = crypto.randomUUID();
  const retry = () =>
    new NextRequest("https://scl.example/api/site-visits", {
      method: "POST",
      headers: {
        Origin: "https://scl.example",
        "User-Agent": "Mozilla/5.0 Chrome/140.0",
      },
      body: JSON.stringify({ path: "/", requestId }),
    });
  const first = await POST(retry());
  const repeated = await POST(retry());
  assert.equal(first.cookies.get(traffic.SITE_VISIT_COOKIE)?.value, requestId);
  assert.equal(
    repeated.cookies.get(traffic.SITE_VISIT_COOKIE)?.value,
    requestId,
  );
  assert.equal(rows.size, 1);
});

test("live traffic polling checks current admin access before querying any counts", async () => {
  let reads = 0;
  let account: {
    role: string;
    accountStatus: string;
    legalAcceptance: object | null;
    emailVerified: Date | null;
  } | null = null;
  const { GET } = loadTestModule<typeof TrafficRoute>(
    "src/app/api/admin/site-traffic/route.ts",
    {
      "next/server": { NextResponse },
      "@/lib/email-verification-policy": {
        emailVerificationEnforced: () => true,
      },
      "@/lib/session": { getCurrentAccount: async () => account },
      "@/lib/queries/site-traffic": {
        getAdminSiteTraffic: async () => {
          reads++;
          return traffic.siteTrafficReport([], null);
        },
      },
    },
  );
  assert.equal((await GET()).status, 401);
  account = {
    role: "CAPPER",
    accountStatus: "ACTIVE",
    legalAcceptance: {},
    emailVerified: new Date(),
  };
  assert.equal((await GET()).status, 403);
  account.role = "ADMIN";
  account.accountStatus = "SUSPENDED";
  assert.equal((await GET()).status, 403);
  account.accountStatus = "ACTIVE";
  account.emailVerified = null;
  assert.equal((await GET()).status, 403);
  assert.equal(reads, 0);
  account.emailVerified = new Date();
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(reads, 1);
  assert.match((await response.json()).checkedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("daily reports use Eastern dates over midnight and daylight-saving boundaries", () => {
  const report = traffic.siteTrafficReport(
    [{ day: "2026-11-01", visits: 3 }],
    new Date("2026-11-01T04:05:00Z"),
    new Date("2026-11-02T04:59:00Z"),
  );
  assert.equal(report.today, 3);
  assert.equal(report.days.at(-1)?.date, "2026-11-01");
  assert.equal(
    report.yesterday,
    null,
    "days before tracking began stay unknown",
  );
  const afterMidnight = traffic.siteTrafficReport(
    [{ day: "2026-11-01", visits: 3 }],
    new Date("2026-11-01T04:05:00Z"),
    new Date("2026-11-02T05:00:00Z"),
  );
  assert.equal(afterMidnight.today, 0);
  assert.equal(afterMidnight.yesterday, 3);
  assert.equal(afterMidnight.last7Days, 3);
  assert.equal(afterMidnight.days.length, 30);
  assert.equal(traffic.siteTrafficReport([], null).firstDay, null);
});
