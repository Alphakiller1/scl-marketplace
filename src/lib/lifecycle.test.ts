import assert from "node:assert/strict";
import { test } from "node:test";

import { deriveLifecycle } from "./lifecycle";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-07-14T20:00:00Z");

test("graded outcomes map directly", () => {
  assert.equal(deriveLifecycle({ outcome: "WIN", now }), "win");
  assert.equal(deriveLifecycle({ outcome: "LOSS", now }), "loss");
  assert.equal(deriveLifecycle({ outcome: "PUSH", now }), "push");
  assert.equal(deriveLifecycle({ outcome: "VOID", now }), "void");
});

test("pending before start is pre-game", () => {
  const start = new Date(now.getTime() + HOUR);
  assert.equal(
    deriveLifecycle({ outcome: "PENDING", eventStartsAt: start, now }),
    "pre-game",
  );
});

test("pending just after start is live", () => {
  const start = new Date(now.getTime() - HOUR);
  assert.equal(
    deriveLifecycle({ outcome: "PENDING", eventStartsAt: start, now }),
    "live",
  );
});

test("pending past the expected-final window is awaiting-grade", () => {
  const start = new Date(now.getTime() - 6 * HOUR);
  assert.equal(
    deriveLifecycle({ outcome: "PENDING", eventStartsAt: start, now }),
    "awaiting-grade",
  );
});

test("pending with missing/invalid start defaults to pre-game", () => {
  assert.equal(deriveLifecycle({ outcome: "PENDING", now }), "pre-game");
  assert.equal(
    deriveLifecycle({ outcome: "PENDING", eventStartsAt: null, now }),
    "pre-game",
  );
  assert.equal(
    deriveLifecycle({ outcome: "PENDING", eventStartsAt: "nope", now }),
    "pre-game",
  );
});

test("accepts an ISO string start", () => {
  const iso = new Date(now.getTime() + HOUR).toISOString();
  assert.equal(
    deriveLifecycle({ outcome: "PENDING", eventStartsAt: iso, now }),
    "pre-game",
  );
});
