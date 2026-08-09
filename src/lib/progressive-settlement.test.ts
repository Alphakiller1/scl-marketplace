import assert from "node:assert/strict";
import test from "node:test";

import { settleProgressively } from "@/lib/progressive-settlement";

test("settleProgressively publishes a fast board without waiting for a slow board", async () => {
  let finishSlow!: (value: string) => void;
  const slow = new Promise<string>((resolve) => {
    finishSlow = resolve;
  });
  const seen: string[] = [];

  const finished = settleProgressively(
    [slow, Promise.resolve("fast")],
    (value) => seen.push(value),
  );

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(seen, ["fast"]);

  finishSlow("slow");
  await finished;
  assert.deepEqual(seen, ["fast", "slow"]);
});

test("settleProgressively reports completion only after every board settles", async () => {
  const progress: boolean[] = [];

  await settleProgressively(
    [Promise.resolve(1), Promise.resolve(2)],
    (_value, state) => progress.push(state.allComplete),
  );

  assert.deepEqual(progress, [false, true]);
});
