import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildWhopProductCheckoutUrl,
  listWhopPlans,
  updateWhopProduct,
  WhopApiError,
} from "@/lib/whop-api";
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

  it("lists every Whop plan page for the connected company", async () => {
    const originalFetch = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = (async (input) => {
      const url = String(input);
      urls.push(url);
      const secondPage = url.includes("after=cursor-1");
      return Response.json(
        secondPage
          ? { data: [{ id: "plan_2" }], page_info: { has_next_page: false } }
          : {
              data: [{ id: "plan_1" }],
              page_info: { has_next_page: true, end_cursor: "cursor-1" },
            },
      );
    }) as typeof fetch;

    try {
      const plans = await listWhopPlans({
        accessToken: "test-token",
        companyId: "biz_test",
      });
      assert.deepEqual(
        plans.map((plan) => plan.id),
        ["plan_1", "plan_2"],
      );
      assert.equal(urls.length, 2);
      assert.match(urls[0]!, /\/api\/v1\/plans\?/);
      assert.match(urls[0]!, /company_id=biz_test/);
      assert.match(urls[0]!, /first=50/);
      assert.match(urls[1]!, /after=cursor-1/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("preserves Whop HTTP failures as real errors with status and message", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      Response.json(
        { error: { message: "Missing plan:basic:read" } },
        { status: 403 },
      )) as typeof fetch;

    try {
      await assert.rejects(
        listWhopPlans({ accessToken: "test-token", companyId: "biz_test" }),
        (error: unknown) => {
          assert(error instanceof WhopApiError);
          assert(error instanceof Error);
          assert.equal(error.status, 403);
          assert.equal(error.message, "Missing plan:basic:read");
          return true;
        },
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
