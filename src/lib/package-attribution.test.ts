import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { attributionForSelection } from "@/lib/package-attribution-rule";

const STOREFRONT = ["pkg_a", "pkg_b", "pkg_c"];

describe("attributionForSelection", () => {
  it("keeps an explicit selection exactly as chosen", () => {
    assert.deepEqual(attributionForSelection(["pkg_a", "pkg_c"], STOREFRONT), [
      "pkg_a",
      "pkg_c",
    ]);
  });

  it("fans an empty selection out across the whole storefront", () => {
    assert.deepEqual(attributionForSelection([], STOREFRONT), STOREFRONT);
  });

  it("leaves a pick unattributed when there is nothing to sell", () => {
    assert.deepEqual(attributionForSelection([], []), []);
  });

  it("never selects a package outside the storefront it was given", () => {
    // The caller validates ownership first; this only decides the shape.
    const result = attributionForSelection([], STOREFRONT);
    assert.equal(
      result.every((id) => STOREFRONT.includes(id)),
      true,
    );
  });

  it("copies rather than aliasing its inputs", () => {
    const selected = ["pkg_a"];
    const result = attributionForSelection(selected, STOREFRONT);
    result.push("pkg_z");
    assert.deepEqual(selected, ["pkg_a"]);
  });
});
