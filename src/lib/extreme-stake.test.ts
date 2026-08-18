import assert from "node:assert/strict";
import test from "node:test";

import { PREDICTION_UNIT_MAX } from "@/lib/constants";
import {
  EXTREME_STAKE_UNITS,
  isExtremeStake,
  normalizeExtremeStake,
} from "@/lib/extreme-stake";

test("999u is an extreme stake and clamps to the 5u prediction max", () => {
  assert.equal(isExtremeStake(999), true);
  assert.equal(isExtremeStake(EXTREME_STAKE_UNITS), true);
  assert.equal(isExtremeStake(5), false);
  assert.equal(isExtremeStake(99.99), false);

  const loss = normalizeExtremeStake({ units: 999, profitUnits: -999 });
  assert.equal(loss.units, PREDICTION_UNIT_MAX);
  assert.equal(loss.profitUnits, -5);

  const win = normalizeExtremeStake({ units: 999, profitUnits: 908.18 });
  assert.equal(win.units, 5);
  assert.equal(win.profitUnits, 4.55);

  const pending = normalizeExtremeStake({ units: 999, profitUnits: null });
  assert.equal(pending.units, 5);
  assert.equal(pending.profitUnits, null);

  const ordinary = normalizeExtremeStake({ units: 2.5, profitUnits: 2.27 });
  assert.deepEqual(ordinary, { units: 2.5, profitUnits: 2.27 });
});
