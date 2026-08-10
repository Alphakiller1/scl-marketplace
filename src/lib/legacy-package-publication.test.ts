import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("the marketplace query does not truncate the migrated package catalog", () => {
  const storeSource = source("src/lib/queries/store.ts");
  const marketplaceQuery = storeSource.slice(
    storeSource.indexOf(
      "export async function listActiveMarketplacePackagesResult",
    ),
    storeSource.indexOf(
      "export async function listActiveMarketplacePackages()",
    ),
  );

  assert.ok(marketplaceQuery.includes("prisma.package.findMany"));
  // Nested relations may take one tracking URL. The package findMany itself
  // must never cap the catalog before client-side search and sorting.
  assert.doesNotMatch(marketplaceQuery, /^ {6}take\s*:/m);
});

test("marketplace capper evidence covers every returned capper", () => {
  const leaderboardSource = source("src/lib/queries/leaderboard.ts");
  const evidenceQuery = leaderboardSource.slice(
    leaderboardSource.indexOf(
      "export async function getPublicCapperEvidenceByIds",
    ),
    leaderboardSource.indexOf("async function loadLeaderboardResult"),
  );

  assert.doesNotMatch(evidenceQuery, /\.slice\s*\(/);
});

test("the package page serializes database-heavy evidence reads", () => {
  const pageSource = source("src/app/(marketing)/packages/page.tsx");

  assert.doesNotMatch(pageSource, /Promise\.all\s*\(/);
});

test("Fluid Compute pool and heavy routes stay concurrency safe", () => {
  const prismaUrlSource = source("src/lib/prisma-url.ts");
  const picksPageSource = source("src/app/(marketing)/picks/page.tsx");
  const gradingSource = source("src/lib/grading-health.ts");
  const storeSource = source("src/lib/queries/store.ts");
  const storeQuerySource = storeSource.slice(
    storeSource.indexOf(
      "export async function getLegacyPackageIntegrityForAdmin",
    ),
    storeSource.indexOf("export async function listConnectionsForCapper"),
  );

  assert.match(prismaUrlSource, /DEFAULT_POOLED_CONNECTION_LIMIT\s*=\s*5/);
  assert.doesNotMatch(picksPageSource, /Promise\.all\s*\(/);
  assert.doesNotMatch(gradingSource, /Promise\.all\s*\(/);
  assert.doesNotMatch(storeQuerySource, /Promise\.all\s*\(/);
});

test("server routes never restore obsolete one-connection guidance", () => {
  for (const path of [
    "src/app/(marketing)/picks/page.tsx",
    "src/app/(marketing)/cappers/[handle]/page.tsx",
    "src/app/(admin)/admin/store-setup/page.tsx",
    "src/lib/capper-profile-seo.ts",
  ]) {
    assert.doesNotMatch(source(path), /one[- ]connection|single connection/i);
  }
});

test("production verification rejects degraded 200 responses", () => {
  const deploySource = source(".github/workflows/deploy.yml");
  const verifierSource = source("scripts/verify-production-release.mjs");
  const deepHealthSource = source("src/app/api/health/deep/route.ts");

  assert.match(deploySource, /verify-production-release\.mjs/);
  assert.match(deploySource, /CRON_SECRET/);
  assert.match(verifierSource, /data-data-status/);
  assert.match(verifierSource, /verifyDeepHealth/);
  assert.match(deepHealthSource, /legacyPackages/);
  assert.match(deepHealthSource, /oddsProvider/);
});

test("importing Prisma does not start competing schema patch queries", () => {
  const prismaSource = source("src/lib/prisma.ts");

  assert.doesNotMatch(prismaSource, /ensureAuthEmailSchema/);
  assert.doesNotMatch(prismaSource, /ensureStorefrontMessagesSchema/);
});

test("production deploys fail closed on migration or package audit failure", () => {
  const migrationSource = source("scripts/migrate-on-production-only.mjs");

  assert.match(migrationSource, /blocking deployment/);
  assert.match(migrationSource, /verify-package-integrity\.ts/);
  assert.match(migrationSource, /process\.exit\(1\)/);
});

test("owners can manually manage Whop packages without API sync", () => {
  const formSource = source("src/components/scl/admin-package-form.tsx");
  const detailSource = source("src/app/(admin)/admin/cappers/[id]/page.tsx");
  const integrityPanelSource = source(
    "src/components/scl/legacy-package-integrity-panel.tsx",
  );

  assert.match(formSource, /allowProviderSelection/);
  assert.match(formSource, /does not require a working provider API/);
  assert.match(detailSource, /Add Whop package/);
  assert.match(detailSource, /AdminPackageRowControls/);
  assert.match(integrityPanelSource, /Count lineage:/);
  assert.match(integrityPanelSource, /original three migrated Whop offers/);
  assert.match(integrityPanelSource, /Verify or edit/);
});
