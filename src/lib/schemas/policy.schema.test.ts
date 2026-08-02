import assert from "node:assert/strict";
import test from "node:test";

import { policyDocumentSchema } from "@/lib/schemas/policy.schema";

const validPolicy = {
  slug: "TERMS",
  title: "Terms & Conditions",
  body: "A sufficiently detailed policy paragraph. ".repeat(3),
  version: "2026-07-26",
};

test("policy documents accept bounded plain-text content", () => {
  assert.equal(policyDocumentSchema.safeParse(validPolicy).success, true);
  assert.equal(
    policyDocumentSchema.safeParse({
      ...validPolicy,
      slug: "REFUND",
      title: "Refund Policy",
    }).success,
    true,
  );
});

test("policy document versions reject spaces and unsafe punctuation", () => {
  assert.equal(
    policyDocumentSchema.safeParse({
      ...validPolicy,
      version: "July 2026 <script>",
    }).success,
    false,
  );
});

test("policy documents reject empty or oversized copy", () => {
  assert.equal(
    policyDocumentSchema.safeParse({ ...validPolicy, body: "Too short" })
      .success,
    false,
  );
  assert.equal(
    policyDocumentSchema.safeParse({
      ...validPolicy,
      body: "x".repeat(50_001),
    }).success,
    false,
  );
});
