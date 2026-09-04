import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("public capper hydration does not fan out against one pooled connection", () => {
  const capperSource = source("src/lib/queries/capper.ts");
  const hydration = capperSource.slice(
    capperSource.indexOf("const loadPublicCapperByHandle"),
    capperSource.indexOf("const getCachedPublicCapperByHandle"),
  );

  assert.doesNotMatch(hydration, /Promise\.all(?:Settled)?\s*\(/);
});

test("profile packages load before optional accolades", () => {
  const pageSource = source("src/app/(marketing)/cappers/[handle]/page.tsx");

  assert.doesNotMatch(pageSource, /Promise\.all\s*\(/);
  assert.ok(
    pageSource.indexOf("await getLivePackagesForCapper") <
      pageSource.indexOf("await getCapperAccolades"),
  );
});

test("profile metadata does not start a second full profile hydration", () => {
  const pageSource = source("src/app/(marketing)/cappers/[handle]/page.tsx");
  const metadataSource = pageSource.slice(
    pageSource.indexOf("export async function generateMetadata"),
    pageSource.indexOf("export default async function CapperProfilePage"),
  );

  assert.doesNotMatch(metadataSource, /getPublicCapperByHandle/);
  assert.match(metadataSource, /buildCapperHandleMetadata/);
});

test("profile cache does not reuse pre-serialization partial payloads", () => {
  const capperSource = source("src/lib/queries/capper.ts");

  // v7 adds the per-scope payload (windowStats, windowSportBreakdown,
  // clvTrackerByWindow, defaultWindow). A cached v6 entry deserializes without
  // them, so the section would render with no scope to select.
  assert.match(capperSource, /\["public-capper-by-handle-v7"\]/);
});
