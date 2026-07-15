import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LIFECYCLE_CHIP_STYLES,
  lifecycleChipAriaLabel,
} from "@/lib/lifecycle-chip";
import type { PickStatus } from "@/lib/mock";

const ALL: PickStatus[] = [
  "pre-game",
  "pending",
  "live",
  "awaiting-grade",
  "win",
  "loss",
  "push",
  "void",
];

test("lifecycle chip mapping covers every PickStatus", () => {
  for (const status of ALL) {
    assert.ok(LIFECYCLE_CHIP_STYLES[status], `missing style for ${status}`);
    assert.ok(LIFECYCLE_CHIP_STYLES[status].label);
    assert.ok(LIFECYCLE_CHIP_STYLES[status].className);
  }
});

test("pre-game uses blue informational token (not live)", () => {
  const s = LIFECYCLE_CHIP_STYLES["pre-game"];
  assert.equal(s.label, "Pre-Game");
  assert.match(s.className, /\btext-blue\b/);
  assert.match(s.className, /\bbg-blue\//);
  assert.doesNotMatch(s.className, /\btext-live\b/);
  assert.doesNotMatch(s.className, /\bbg-live\//);
  assert.equal(s.live, undefined);
  assert.equal(s.ariaPrefix, "Status");
});

test("live uses live token + pulse flag", () => {
  const s = LIFECYCLE_CHIP_STYLES.live;
  assert.equal(s.label, "Live");
  assert.match(s.className, /\btext-live\b/);
  assert.match(s.className, /\bbg-live\//);
  assert.equal(s.live, true);
  assert.equal(s.ariaPrefix, "Status");
});

test("awaiting-grade is muted", () => {
  const s = LIFECYCLE_CHIP_STYLES["awaiting-grade"];
  assert.equal(s.label, "Awaiting Grade");
  assert.match(s.className, /text-muted-foreground/);
  assert.equal(s.ariaPrefix, "Status");
});

test("won/lost use win-green / loss-red tokens", () => {
  assert.match(LIFECYCLE_CHIP_STYLES.win.className, /\btext-pos\b/);
  assert.match(LIFECYCLE_CHIP_STYLES.win.className, /\bbg-pos\//);
  assert.equal(LIFECYCLE_CHIP_STYLES.win.label, "Won");

  assert.match(LIFECYCLE_CHIP_STYLES.loss.className, /\btext-neg\b/);
  assert.match(LIFECYCLE_CHIP_STYLES.loss.className, /\bbg-neg\//);
  assert.equal(LIFECYCLE_CHIP_STYLES.loss.label, "Lost");
});

test("push uses push-neutral; void is muted", () => {
  assert.match(LIFECYCLE_CHIP_STYLES.push.className, /\btext-push\b/);
  assert.match(LIFECYCLE_CHIP_STYLES.push.className, /\bbg-push\//);
  assert.equal(LIFECYCLE_CHIP_STYLES.push.label, "Push");

  assert.match(LIFECYCLE_CHIP_STYLES.void.className, /text-muted-foreground/);
  assert.equal(LIFECYCLE_CHIP_STYLES.void.label, "Void");
});

test("aria-label: lifecycle uses Status, graded outcomes use Result", () => {
  assert.equal(lifecycleChipAriaLabel("pre-game"), "Status: Pre-Game");
  assert.equal(lifecycleChipAriaLabel("live"), "Status: Live");
  assert.equal(
    lifecycleChipAriaLabel("awaiting-grade"),
    "Status: Awaiting Grade",
  );
  assert.equal(lifecycleChipAriaLabel("pending"), "Status: Pending");

  assert.equal(lifecycleChipAriaLabel("win"), "Result: Won");
  assert.equal(lifecycleChipAriaLabel("loss"), "Result: Lost");
  assert.equal(lifecycleChipAriaLabel("push"), "Result: Push");
  assert.equal(lifecycleChipAriaLabel("void"), "Result: Void");
});
