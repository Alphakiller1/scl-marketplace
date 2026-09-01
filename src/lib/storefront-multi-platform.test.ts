import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { WHOP_CAPPER_REFERRAL_URL } from "@/lib/store-connection";

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
    /Add SCL as a Whop affiliate, authorize the Whop API connection from SCL/,
  );
  assert.match(
    source,
    /We’ll help you create a Winible or Whop storefront and connect it to SCL\./,
  );
});

test("cappers without a platform get both Winible and Whop setup blocks", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/scl/monetization-wizard.tsx"),
    "utf8",
  );
  const normalized = source.replace(/\s+/g, " ");

  assert.match(
    normalized,
    /Don’t have a platform yet to sell your picks\? We’ll help you get set up with Winible or Whop\./,
  );
  assert.match(normalized, /Get Set Up With Winible/);
  assert.match(normalized, /Get Set Up With Whop/);
  assert.match(normalized, /Create a Winible storefront/);
  assert.match(normalized, /Create a Whop storefront/);
  assert.match(normalized, /href=\{WINIBLE_CAPPER_REFERRAL_URL\}/);
  assert.match(normalized, /href=\{WHOP_CAPPER_REFERRAL_URL\}/);
  assert.match(
    normalized,
    /This opens SCL&apos;s Whop referral link\. It is not a customer package checkout link\./,
  );
});

test("the Whop creator referral is SCL's affiliate network link", () => {
  assert.equal(
    WHOP_CAPPER_REFERRAL_URL,
    "https://whop.com/network/?a=scleaderboard",
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
  assert.match(source, /Authorize SCL on Whop/);
  assert.match(source, /SCL_WHOP_AFFILIATE_PAGE_URL/);
  assert.match(source, /href="\/api\/whop\/connect"/);
  assert.doesNotMatch(
    source,
    /href="\/api\/whop\/connect"[\s\S]{0,40}target="_blank"/,
    "OAuth in a new tab is how iOS showed Whop's raw JSON error",
  );
  const notice = fs.readFileSync(
    path.join(process.cwd(), "src/components/scl/whop-oauth-notice.tsx"),
    "utf8",
  );
  assert.match(notice, /oauth-misconfigured/);
  assert.doesNotMatch(notice, /Authorized apps/);
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
    /Add Sports Cappers Leaderboard as an affiliate in Whop, then authorize the Whop API connection from SCL/,
  );

  // The owner-authored manual affiliate steps, in order, each with its shot.
  assert.match(normalized, /1\. Open Affiliates in your Whop dashboard/);
  assert.match(normalized, /Marketing → Affiliates/);
  assert.match(normalized, /whop-steps\/1-affiliates-tab\.png/);

  assert.match(normalized, /2\. Set SCL as an affiliate/);
  assert.match(normalized, /Set an affiliate commission for a specific user/);
  assert.match(normalized, /whop-steps\/2-specific-user\.png/);

  assert.match(normalized, /3\. Set the SCL commission/);
  // Leaving the product filter blank is the step cappers got wrong; naming
  // products there silently narrows what SCL is allowed to promote.
  assert.match(normalized, /Only allow referring to these products/);
  assert.match(normalized, /not First Payment Only/);
  // Whop’s reward field has a Percent/flat toggle; 35 flat is not 35%.
  assert.match(normalized, /with <strong>Percent<\/strong> selected/);
  // SCL’s affiliate username (scleaderboard) is NOT its storefront slug
  // (sports-cappers-leaderboard). Naming it prevents inviting the wrong user.
  assert.match(normalized, /SCL_WHOP_AFFILIATE_USERNAME/);
  assert.match(
    normalized,
    /username is not the same as the address of SCL&apos;s Whop storefront/,
  );
  assert.match(normalized, /whop-steps\/3-invite-form\.png/);

  // The API authorization step is unrelated to the manual affiliate invite and
  // stays at the end of the list.
  assert.match(normalized, /4\. Connect your Whop storefront to SCL/);
  assert.match(
    normalized,
    /Make sure you are signed in to the Whop account that manages the business where you sell your picks/,
  );
  assert.match(
    normalized,
    /Keep product names, descriptions, and visibility synchronized between Whop and SCL/,
  );
  assert.match(
    normalized,
    /SCL cannot change your Whop prices, issue refunds, manage payouts, or move funds/,
  );
  assert.match(
    normalized,
    /automatically begin importing your eligible Whop products under <strong>Your Whop packages<\/strong>/,
  );
  assert.match(
    normalized,
    /Imported packages remain hidden from the public until SCL reviews and publishes them/,
  );

  // Old wrong turns that must not come back.
  assert.doesNotMatch(normalized, /search for/);
  assert.doesNotMatch(normalized, /Refer Buyers/);
  assert.doesNotMatch(normalized, /optional but recommended/);
  assert.doesNotMatch(normalized, /3\. Use package-specific affiliate links/);
  assert.doesNotMatch(normalized, /\bapp\b/i);
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

test("Whop OAuth callback route exists for storefront connection", () => {
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
  const connect = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/whop/connect/route.ts"),
    "utf8",
  );
  const callback = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/whop/callback/route.ts"),
    "utf8",
  );
  assert.match(connect, /whopOAuthRedirectUri/);
  assert.match(connect, /ensureWhopOAuthRedirectRegistered/);
  assert.match(connect, /readWhopAppPermissionReadiness/);
  assert.match(connect, /app-permissions-missing/);
  assert.match(connect, /oauth-misconfigured/);
  assert.match(connect, /serializeWhopPkceCookie/);
  assert.match(connect, /whopOAuthCookieDomain/);
  assert.match(callback, /whopOAuthRedirectUri/);
  assert.match(callback, /parseWhopPkceCookie/);
  assert.match(callback, /whopOAuthReturnOrigin/);
  assert.match(callback, /listWhopPlans/);
  assert.match(callback, /permissions-required/);
  assert.match(callback, /status: "NEEDS_ACTION"/);
  assert.doesNotMatch(connect, /\$\{siteUrl\(\)\} \/api\/whop\/callback/);
});

test("existing Whop storefronts can connect or repair their API connection", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/scl/store-status-panel.tsx"),
    "utf8",
  );

  assert.match(source, /provider === "WHOP" && status !== "DISABLED"/);
  assert.match(source, /href="\/api\/whop\/connect"/);
  assert.match(source, /Connect or reconnect Whop API/);
  assert.doesNotMatch(source, /\bSCL app\b/i);
});
