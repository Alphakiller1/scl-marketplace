import assert from "node:assert/strict";
import { test } from "node:test";

import { shouldApplyRuntimeSchemaPatch } from "@/lib/runtime-schema-patch";

test("shouldApplyRuntimeSchemaPatch skips next build phase", () => {
  const prior = { ...process.env };
  try {
    process.env.NEXT_PHASE = "phase-production-build";
    process.env.VERCEL_ENV = "production";
    assert.equal(shouldApplyRuntimeSchemaPatch(), false);
  } finally {
    process.env = prior;
  }
});

test("shouldApplyRuntimeSchemaPatch applies on Vercel production runtime", () => {
  const prior = { ...process.env };
  try {
    delete process.env.NEXT_PHASE;
    process.env.VERCEL_ENV = "production";
    assert.equal(shouldApplyRuntimeSchemaPatch(), true);
  } finally {
    process.env = prior;
  }
});

test("shouldApplyRuntimeSchemaPatch skips preview and local", () => {
  const prior = { ...process.env };
  try {
    delete process.env.NEXT_PHASE;
    process.env.VERCEL_ENV = "preview";
    assert.equal(shouldApplyRuntimeSchemaPatch(), false);

    delete process.env.VERCEL_ENV;
    assert.equal(shouldApplyRuntimeSchemaPatch(), false);
  } finally {
    process.env = prior;
  }
});
