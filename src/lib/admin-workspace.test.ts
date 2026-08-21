import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const workspaceRoot = process.cwd();

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}

test("admin grading diagnostics expose the manual auto-grade control", () => {
  const source = readSource("src/app/(admin)/admin/grading/page.tsx");

  assert.match(source, /import \{ AutoGradeButton \}/);
  assert.match(source, /<AutoGradeButton \/>/);
  assert.match(source, /Grade completed force-settles ungraded plays/);
});

test("capper package management is directly visible and provider aware", () => {
  const source = readSource("src/app/(admin)/admin/cappers/[id]/page.tsx");

  assert.match(source, /id="manual-package-manager"/);
  assert.match(source, /Add Whop package/);
  assert.match(source, /Add Winible package/);
  assert.match(source, /selectedPackage\?\.affiliateProvider/);
  assert.doesNotMatch(source, /profile\?\.storeConnections\[0\]\.id/);
});

test("package row controls meet the minimum mobile tap-target size", () => {
  const source = readSource(
    "src/components/scl/admin-package-row-controls.tsx",
  );

  // Every control in the row is the 40px `icon` size — never the compact
  // `icon-sm`. The count tracks the row's controls (up, down, show/hide,
  // delete); bump it when a control is added, don't relax the size rule.
  assert.doesNotMatch(source, /size="icon-sm"/);
  assert.equal((source.match(/size="icon"/g) ?? []).length, 4);
});

test("admin published plays use dedicated mobile cards instead of a compressed table", () => {
  const source = readSource("src/app/(admin)/admin/plays/page.tsx");

  assert.match(source, /function MobilePublishedPlayCard/);
  assert.match(source, /divide-border divide-y lg:hidden/);
  assert.match(source, /hidden lg:block/);
});

test("shared compact controls preserve 40px mobile tap targets", () => {
  const buttonSource = readSource("src/components/ui/button.tsx");
  const filterSource = readSource("src/components/scl/leaderboard-filters.tsx");

  assert.match(buttonSource, /sm: "h-10[\s\S]*?lg:h-9/);
  assert.match(buttonSource, /"icon-sm":[\s\S]*?size-10[\s\S]*?lg:size-9/);
  assert.match(filterSource, /min-h-10[\s\S]*?lg:h-8/);
});
