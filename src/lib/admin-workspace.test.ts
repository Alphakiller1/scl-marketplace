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
});

test("capper package management targets the preferred storefront connection", () => {
  const source = readSource("src/app/(admin)/admin/cappers/[id]/page.tsx");

  assert.match(
    source,
    /primaryConnection\s*\?\s*`\/admin\/store-setup\?id=\$\{primaryConnection\.id\}`/,
  );
  assert.doesNotMatch(source, /profile\?\.storeConnections\[0\]\.id/);
});

test("package row controls meet the minimum mobile tap-target size", () => {
  const source = readSource(
    "src/components/scl/admin-package-row-controls.tsx",
  );

  assert.doesNotMatch(source, /size="icon-sm"/);
  assert.equal((source.match(/size="icon"/g) ?? []).length, 3);
});
