import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("capper storefront setup exposes both supported platform connections", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/scl/monetization-wizard.tsx"),
    "utf8",
  );
  assert.match(source, /SUPPORTED_PROVIDERS = \["WINIBLE", "WHOP"\]/);
  assert.match(source, /Connect Another Platform/);
  assert.match(source, /allConnections\.map/);
  assert.match(source, /selectInitialStoreConnection\(connections\)/);
});

test("capper storefront setup tailors platform guidance to the selected option", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/scl/monetization-wizard.tsx"),
    "utf8",
  );
  assert.match(source, /Already sell picks on Whop\? Add SCL as an affiliate/);
  assert.match(
    source,
    /Complete the Winible affiliate invite, then submit — SCL accepts the relationship and manually publishes your package links\./,
  );
  assert.match(
    source,
    /Add SCL as a Whop affiliate, install the SCL app when available/,
  );
  assert.match(
    source,
    /We’ll help you create a Winible storefront and connect it to SCL\./,
  );
});

test("Whop connection copy explains the capper experience", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/scl/monetization-wizard.tsx"),
    "utf8",
  );
  assert.match(
    source,
    /Add SCL as an affiliate on \$\{label\}\. After you submit, our team verifies the relationship/,
  );
  assert.match(
    source,
    /checkout, subscriptions, and payments stay on \$\{label\}\./,
  );
  assert.match(source, /Continue to Connect Whop/);
  assert.match(source, /Install SCL app on Whop/);
  assert.match(
    source,
    /When SCL refers a subscriber to your storefront, we earn an affiliate commission/,
  );
});

test("Winible connection copy explains the capper experience", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/scl/monetization-wizard.tsx"),
    "utf8",
  );
  assert.match(
    source,
    /Invite Sports Cappers Leaderboard as an affiliate in Winible/,
  );
  assert.match(source, /Copy SCL affiliate email/);
  assert.match(source, /Wait for SCL to accept in Winible/);
  assert.match(source, /Awaiting SCL Acceptance/);
});

test("Winible setup instructions focus on the capper workflow", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/scl/monetization-wizard.tsx"),
    "utf8",
  );
  const normalized = source.replace(/\s+/g, " ");

  assert.match(
    normalized,
    /1\. Open the Affiliates tab in your Winible dashboard/,
  );
  assert.match(normalized, /2\. Invite affiliate/);
  assert.match(normalized, /3\. Fill in the SCL affiliate information below/);
  assert.match(normalized, /4\. Wait for SCL to accept in Winible/);
  assert.match(normalized, /winible-steps\/1-affiliates-tab\.png/);
});

test("Winible step screenshots ship in public assets", () => {
  assert.ok(
    fs.existsSync(
      path.join(process.cwd(), "public/winible-steps/1-affiliates-tab.png"),
    ),
  );
  assert.ok(
    fs.existsSync(
      path.join(process.cwd(), "public/winible-steps/2-invite-affiliate.png"),
    ),
  );
  assert.ok(
    fs.existsSync(
      path.join(process.cwd(), "public/winible-steps/3-invite-form.png"),
    ),
  );
});

test("Whop setup instructions focus on the capper workflow", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/scl/monetization-wizard.tsx"),
    "utf8",
  );
  const normalized = source.replace(/\s+/g, " ");

  assert.match(
    normalized,
    /Add Sports Cappers Leaderboard as an affiliate in Whop\. After you submit, SCL verifies the relationship and manually publishes the approved package links/,
  );
  assert.match(normalized, /Install the SCL app on Whop/);
  assert.match(normalized, /3\. Use package-specific affiliate links/);
  assert.match(normalized, /4\. Select recurring commissions/);
  assert.match(
    normalized,
    /Hiding a mapped product on Whop also takes its SCL offer down/,
  );
  assert.doesNotMatch(normalized, /It is read-only/);
});

test("capper-facing storefront copy describes the manual SCL review workflow", () => {
  const page = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/app/(capper)/dashboard/monetization/page.tsx",
    ),
    "utf8",
  );
  assert.match(page, /manually publishes the approved package links/);
  assert.doesNotMatch(page, /SCL imports links/);
});

test("Whop OAuth callback route exists for app install", () => {
  assert.ok(
    fs.existsSync(
      path.join(process.cwd(), "src/app/api/whop/callback/route.ts"),
    ),
  );
  assert.ok(
    fs.existsSync(
      path.join(process.cwd(), "src/app/api/whop/connect/route.ts"),
    ),
  );
});

test("existing Whop storefronts can install or repair their app connection", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/scl/store-status-panel.tsx"),
    "utf8",
  );

  assert.match(source, /provider === "WHOP" && status !== "DISABLED"/);
  assert.match(source, /href="\/api\/whop\/connect"/);
  assert.match(source, /Install or reconnect SCL app/);
});
