import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { freshestSnapshot } from "@/lib/odds-snapshot-freshness";

type Layered = { savedAt: number; layer: "runtime" | "durable" };

const runtime: Layered = { savedAt: 1_000, layer: "runtime" };
const durable: Layered = { savedAt: 2_000, layer: "durable" };

describe("freshestSnapshot", () => {
  // The regression: the read returned the runtime value whenever it parsed, so
  // a regional cache holding an older board masked a newer database snapshot.
  // Production sat on an empty MLB board while the row held eleven games.
  it("prefers the durable snapshot when it is newer", () => {
    assert.equal(freshestSnapshot(runtime, durable)?.layer, "durable");
  });

  it("prefers the runtime snapshot when it is newer", () => {
    assert.equal(
      freshestSnapshot({ savedAt: 3_000, layer: "runtime" } as Layered, durable)
        ?.layer,
      "runtime",
    );
  });

  // Same write seen twice; no reason to swap to the slower layer.
  it("keeps the runtime snapshot on a tie", () => {
    assert.equal(
      freshestSnapshot({ savedAt: 2_000, layer: "runtime" } as Layered, durable)
        ?.layer,
      "runtime",
    );
  });

  it("falls back to whichever layer exists", () => {
    assert.equal(freshestSnapshot(null, durable)?.layer, "durable");
    assert.equal(freshestSnapshot(runtime, null)?.layer, "runtime");
    assert.equal(freshestSnapshot(null, null), null);
    assert.equal(freshestSnapshot(undefined, undefined), null);
  });

  // An empty board is a valid snapshot and parses cleanly — which is exactly
  // how the stale entry won before. Recency must still decide.
  it("does not treat an empty board as a reason to prefer it", () => {
    const emptyRuntime: Layered = { savedAt: 1_000, layer: "runtime" };
    const fullDurable: Layered = { savedAt: 9_000, layer: "durable" };
    assert.equal(freshestSnapshot(emptyRuntime, fullDurable)?.layer, "durable");
  });
});
