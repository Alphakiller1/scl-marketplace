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
});

test("capper storefront setup tailors platform guidance to the selected option", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/scl/monetization-wizard.tsx"),
    "utf8",
  );
  assert.match(
    source,
    /Already sell picks on Whop\? Connect your Whop storefront to SCL\./,
  );
  assert.match(
    source,
    /You’ll complete the affiliate setup in Winible\. SCL imports your packages after approval\./,
  );
  assert.match(
    source,
    /SCL imports your packages directly from Whop once your affiliate connection is complete\./,
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
    /Connect your existing Whop storefront to SCL\. Once your affiliate connection is complete, SCL imports your packages and publishes them on your SCL profile\./,
  );
  assert.match(
    source,
    /checkout, subscriptions, and payments all remain on Whop\./,
  );
  assert.match(source, /Continue to Connect Whop/);
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
