import assert from "node:assert/strict";
import test from "node:test";

import { renderPolicyBody } from "@/lib/legal";
import { publishPolicyReleaseSchema } from "@/lib/schemas/admin-policy.schema";
import { bulkCapperEmailSchema } from "@/lib/schemas/admin-communications.schema";

test("renderPolicyBody converts paragraphs to HTML", () => {
  const html = renderPolicyBody("First paragraph.\n\nSecond paragraph.");
  assert.match(html, /<p>First paragraph.<\/p>/);
  assert.match(html, /<p>Second paragraph.<\/p>/);
});

test("publishPolicyReleaseSchema requires all four documents", () => {
  const parsed = publishPolicyReleaseSchema.safeParse({
    version: "2026-07-24",
    requiresReacceptance: true,
    documents: [
      { slug: "TERMS", title: "Terms", body: "Terms body long enough here." },
      {
        slug: "PRIVACY",
        title: "Privacy",
        body: "Privacy body long enough here.",
      },
      {
        slug: "RESPONSIBLE_GAMING",
        title: "RG",
        body: "Responsible gaming body long enough.",
      },
      {
        slug: "DISCLAIMER",
        title: "Disclaimer",
        body: "Disclaimer body long enough here.",
      },
    ],
  });
  assert.equal(parsed.success, true);
});

test("bulkCapperEmailSchema validates broadcast payload", () => {
  const parsed = bulkCapperEmailSchema.parse({
    subject: "Storefront review needed",
    bodyHtml: "<p>Please confirm your package links.</p>",
    audience: "NEEDS_ATTENTION",
  });
  assert.equal(parsed.audience, "NEEDS_ATTENTION");
});
