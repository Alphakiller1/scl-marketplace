import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const receiptSource = readFileSync(
  "src/components/scl/verification-receipt.tsx",
  "utf8",
);
const stackSource = readFileSync(
  "src/components/scl/receipt-stack.tsx",
  "utf8",
);
const entrySource = readFileSync(
  "src/components/scl/unified-pick-entry.tsx",
  "utf8",
);

test("completed receipts return users to another selection", () => {
  assert.match(receiptSource, /Make Another Selection/);
  assert.match(stackSource, /Make Another Selection/);
  assert.match(entrySource, /setReceipt\(null\)/);
  assert.match(entrySource, /selectionFlow\.focus/);
  assert.match(entrySource, /selectionFlow\.scrollIntoView/);
});
