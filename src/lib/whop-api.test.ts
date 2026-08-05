import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildWhopProductCheckoutUrl } from "@/lib/whop-api";
import { whopWebhookCompanyId, whopWebhookEventName } from "@/lib/whop-sync";

describe("whop api helpers", () => {
  it("builds attributed checkout URLs", () => {
    const url = buildWhopProductCheckoutUrl({
      companyRoute: "pickaxe",
      productRoute: "analytics-pro",
      affiliateUsername: "sportscappersleaderboard",
    });
    assert.equal(
      url,
      "https://whop.com/pickaxe/analytics-pro?a=sportscappersleaderboard",
    );
  });
});

describe("whop webhook helpers", () => {
  it("reads event names from action or type", () => {
    assert.equal(
      whopWebhookEventName({ action: "product.updated" }),
      "product.updated",
    );
    assert.equal(
      whopWebhookEventName({ type: "payment.succeeded" }),
      "payment.succeeded",
    );
  });

  it("extracts company id from nested payload", () => {
    assert.equal(
      whopWebhookCompanyId({
        data: { company: { id: "biz_abc123" } },
      }),
      "biz_abc123",
    );
    assert.equal(
      whopWebhookCompanyId({ data: { company_id: "biz_xyz" } }),
      "biz_xyz",
    );
  });
});
