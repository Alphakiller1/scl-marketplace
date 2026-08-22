import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveLegacyHandleAlias } from "./legacy-handle-aliases";

test("resolveLegacyHandleAlias maps the proven WGS short slug", () => {
  assert.equal(resolveLegacyHandleAlias("wgs"), "wisegentlemensports");
  assert.equal(resolveLegacyHandleAlias("@WGS"), "wisegentlemensports");
});

test("the old WGS slug redirects and resolves to the live handle", () => {
  const nextConfig = source("next.config.ts");
  const capperQuery = source("src/lib/queries/capper.ts");
  assert.match(nextConfig, /\/cappers\/wgs/);
  assert.match(nextConfig, /\/cappers\/wisegentlemensports/);
  assert.match(capperQuery, /resolveLegacyHandleAlias/);
});

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("resolveLegacyHandleAlias leaves unknown handles intact", () => {
  assert.equal(
    resolveLegacyHandleAlias("wisegentlemensports"),
    "wisegentlemensports",
  );
  assert.equal(resolveLegacyHandleAlias("bankofdennis"), "bankofdennis");
});
