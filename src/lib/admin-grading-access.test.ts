import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { adminGradingHref } from "@/lib/admin-grading-link";
import { loadTestModule } from "@/lib/test-support/load-module";
import type * as Queries from "@/lib/queries/admin-play-correction";

test("stale tennis parlay legs open their parent; straight plays retain their route", () => {
  assert.equal(
    adminGradingHref({ id: "leg", parlayId: "ticket" }),
    "/admin/plays/parlay/ticket",
  );
  assert.equal(
    adminGradingHref({ id: "single", parlayId: null }),
    "/admin/plays/straight/single",
  );
  const queue = readFileSync("src/app/(admin)/admin/grading/page.tsx", "utf8");
  assert.equal(queue.match(/href=\{adminGradingHref\(p\)\}/g)?.length, 2);
  assert.doesNotMatch(queue, /href=\{`\/admin\/plays\/straight/);
});

test("admin operational lookup is independent of public visibility and still rejects drafts/legs", async () => {
  const calls: { kind: string; where: unknown }[] = [];
  let authorized = 0;
  const query = loadTestModule<typeof Queries>(
    "src/lib/queries/admin-play-correction.ts",
    {
      "server-only": {},
      "@/lib/session": {
        requireAdmin: async () => {
          authorized++;
        },
      },
      "@/lib/prisma": {
        prisma: {
          play: {
            findFirst: async ({ where }: { where: unknown }) => {
              calls.push({ kind: "straight", where });
              return null;
            },
          },
          parlay: {
            findFirst: async ({ where }: { where: unknown }) => {
              calls.push({ kind: "parlay", where });
              return null;
            },
          },
        },
      },
    },
  );
  assert.equal(
    await query.getAdminStraightCorrectionRecord("hidden-single"),
    null,
  );
  assert.equal(
    await query.getAdminParlayCorrectionRecord("hidden-ticket"),
    null,
  );
  assert.equal(authorized, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    {
      kind: "straight",
      where: { id: "hidden-single", parlayId: null, status: "COMMITTED" },
    },
    {
      kind: "parlay",
      where: {
        id: "hidden-ticket",
        legs: { some: {}, every: { status: "COMMITTED" } },
      },
    },
  ]);
});

test("non-admins are rejected before either grading record is read", async () => {
  const query = loadTestModule<typeof Queries>(
    "src/lib/queries/admin-play-correction.ts",
    {
      "server-only": {},
      "@/lib/session": {
        requireAdmin: async () => {
          throw new Error("access denied");
        },
      },
      "@/lib/prisma": { prisma: {} },
    },
  );
  await assert.rejects(
    query.getAdminStraightCorrectionRecord("single"),
    /access denied/,
  );
  await assert.rejects(
    query.getAdminParlayCorrectionRecord("ticket"),
    /access denied/,
  );
});

test("old straight URLs for parlay legs redirect after authorization", async () => {
  let authorized = false;
  const page = loadTestModule<{
    default: (p: {
      params: Promise<{ kind: string; id: string }>;
    }) => Promise<unknown>;
  }>("src/app/(admin)/admin/plays/[kind]/[id]/page.tsx", {
    "react/jsx-runtime": {},
    "next/link": {},
    "lucide-react": {},
    "next/navigation": {
      notFound: () => {
        throw new Error("404");
      },
      redirect: (url: string) => {
        throw new Error(`redirect:${url}`);
      },
    },
    "@/components/scl/admin-grade-correction": {},
    "@/components/scl/admin-settlement-audit": {},
    "@/components/scl/badges": {},
    "@/components/scl/section": {},
    "@/lib/format": {},
    "@/lib/admin-grading-link": { adminGradingHref },
    "@/lib/session": {
      requireAdmin: async () => {
        authorized = true;
      },
    },
    "@/lib/prisma": {
      prisma: {
        play: {
          findUnique: async () => {
            assert.ok(authorized);
            return { id: "leg", parlayId: "ticket" };
          },
        },
      },
    },
    "@/lib/queries/admin-play-correction": {},
  });
  await assert.rejects(
    page.default({ params: Promise.resolve({ kind: "straight", id: "leg" }) }),
    /redirect:\/admin\/plays\/parlay\/ticket/,
  );
  await assert.rejects(
    page.default({ params: Promise.resolve({ kind: "bogus", id: "leg" }) }),
    /404/,
  );
});
