import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildWhopProductCheckoutUrl, updateWhopProduct } from "@/lib/whop-api";
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

  it("sends only fields supported by Whop's product update schema", async () => {
    const originalFetch = globalThis.fetch;
    let body: unknown;
    globalThis.fetch = (async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    try {
      const result = await updateWhopProduct({
        accessToken: "test-token",
        productId: "prod_test",
        update: {
          title: "SCL title",
          headline: "SCL headline",
          visibility: "visible",
        },
      });
      assert.deepEqual(result, { ok: true });
      assert.deepEqual(body, {
        title: "SCL title",
        headline: "SCL headline",
        visibility: "visible",
      });
      assert.equal(
        Object.hasOwn(body as object, "metadata"),
        false,
        "Whop's product update endpoint does not accept metadata",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
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
