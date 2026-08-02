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
