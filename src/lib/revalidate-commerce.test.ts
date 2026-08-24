import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("commerce writes bust leaderboard tag and profile ISR", () => {
  const helper = fs.readFileSync(
    path.join(root, "src/lib/revalidate-commerce.ts"),
    "utf8",
  );
  const storeAction = fs.readFileSync(
    path.join(root, "src/lib/actions/store.action.ts"),
    "utf8",
  );
  const webhook = fs.readFileSync(
    path.join(root, "src/app/api/webhooks/whop/route.ts"),
    "utf8",
  );
  const cron = fs.readFileSync(
    path.join(root, "src/app/api/cron/whop-sync/route.ts"),
    "utf8",
  );
  const profileAction = fs.readFileSync(
    path.join(root, "src/lib/actions/profile.action.ts"),
    "utf8",
  );

  assert.match(helper, /revalidateTag\("leaderboard"/);
  assert.match(helper, /revalidatePath\("\/cappers\/\[handle\]"/);
  assert.doesNotMatch(helper, /revalidatePath\("\/admin\/packages"\)/);
  assert.match(storeAction, /revalidateCommerceSurfaces/);
  assert.match(webhook, /revalidateCommerceSurfaces/);
  assert.match(cron, /revalidateCommerceSurfaces/);
  assert.match(profileAction, /revalidateTag\("leaderboard"/);
});

test("Whop storefronts have a signed scheduled reconciliation path", () => {
  const route = fs.readFileSync(
    path.join(root, "src/app/api/cron/whop-sync/route.ts"),
    "utf8",
  );
  const workflow = fs.readFileSync(
    path.join(root, ".github/workflows/whop-sync.yml"),
    "utf8",
  );

  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /syncWhopStorefront/);
  assert.match(route, /WHOP_SYNC_BATCH_SIZE/);
  assert.match(route, /status: \{ not: "DISABLED" \}/);
  assert.match(workflow, /cron: "\*\/5 \* \* \* \*"/);
  assert.match(workflow, /api\/cron\/whop-sync/);
  assert.match(workflow, /Authorization: Bearer \$CRON_SECRET/);
});

test("owner and public storefront views refresh stale Whop packages", () => {
  const sync = fs.readFileSync(path.join(root, "src/lib/whop-sync.ts"), "utf8");
  const ownerPage = fs.readFileSync(
    path.join(root, "src/app/(capper)/dashboard/monetization/page.tsx"),
    "utf8",
  );
  const publicPage = fs.readFileSync(
    path.join(root, "src/app/(marketing)/cappers/[handle]/page.tsx"),
    "utf8",
  );

  assert.match(sync, /WHOP_STOREFRONT_FRESHNESS_MS = 60_000/);
  assert.match(sync, /lastImportedAt >= cutoff/);
  assert.doesNotMatch(sync, /Claim a short freshness lease/);
  assert.match(ownerPage, /refreshWhopStorefrontIfStale\(\{ capperId \}\)/);
  assert.match(
    publicPage,
    /refreshWhopStorefrontIfStale\(\{ capperId: capper\.id \}\)/,
  );
});

test("scheduled Whop checks do not write no-op package audit events", () => {
  const source = fs.readFileSync(
    path.join(root, "src/lib/whop-sync.ts"),
    "utf8",
  );

  assert.match(source, /if \(!packageChanged && !trackingChanged\) continue/);
  assert.match(
    source,
    /if \(imported > 0 \|\| updated > 0 \|\| readiness\.status !== connection\.status\)/,
  );
});

test("SCL edits remain durable until Whop acknowledges the exact revision", () => {
  const schema = fs.readFileSync(
    path.join(root, "prisma/schema.prisma"),
    "utf8",
  );
  const storeAction = fs.readFileSync(
    path.join(root, "src/lib/actions/store.action.ts"),
    "utf8",
  );
  const sync = fs.readFileSync(path.join(root, "src/lib/whop-sync.ts"), "utf8");
  const cron = fs.readFileSync(
    path.join(root, "src/app/api/cron/whop-sync/route.ts"),
    "utf8",
  );

  assert.match(schema, /whopPushPendingAt\s+DateTime\?/);
  assert.match(schema, /whopPushAttempts\s+Int\s+@default\(0\)/);
  assert.match(storeAction, /whopPushPendingAt: whopPushQueuedAt/);
  assert.match(storeAction, /afterResponse\(async \(\) =>/);
  assert.match(sync, /if \(existing\?\.whopPushPendingAt\)/);
  assert.match(
    sync,
    /where: \{ id: pkg\.id, whopPushPendingAt: pkg\.whopPushPendingAt \}/,
  );
  assert.ok(
    cron.indexOf("pushPackageToWhop(pending.id)") <
      cron.indexOf("syncWhopStorefront({"),
    "pending outbound revisions must be delivered before inbound polling",
  );
});
