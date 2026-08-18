import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

import {
  isWhopProductSyncable,
  whopProductSyncAction,
} from "@/lib/whop-product-sync";

const product = {
  id: "prod_test",
  route: "sync-test",
  title: "Sync test",
};

describe("Whop product sync decisions", () => {
  it("upserts visible and quick-link products", () => {
    assert.equal(
      whopProductSyncAction({ ...product, visibility: "visible" }, false),
      "upsert",
    );
    assert.equal(
      whopProductSyncAction({ ...product, visibility: "quick_link" }, true),
      "upsert",
    );
  });

  it("deactivates an existing SCL package when Whop hides the product", () => {
    assert.equal(
      whopProductSyncAction({ ...product, visibility: "hidden" }, true),
      "deactivate",
    );
  });

  it("does not create a package for an unmapped hidden product", () => {
    const hidden = { ...product, visibility: "hidden" };

    assert.equal(isWhopProductSyncable(hidden), false);
    assert.equal(whopProductSyncAction(hidden, false), "skip");
  });

  it("wires deactivation into the persisted SCL package and audit trail", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/lib/whop-sync.ts"),
      "utf8",
    );
    const normalized = source.replace(/\s+/g, " ");

    assert.match(normalized, /syncAction !== "upsert"/);
    assert.match(
      normalized,
      /data: \{ title: product\.title, description: nextDescription, isActive: false/,
    );
    assert.match(normalized, /action: "DEACTIVATED"/);
  });
});
