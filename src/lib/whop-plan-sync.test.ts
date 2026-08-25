import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WhopPlanListItem } from "@/lib/whop-api";
import { resolveWhopProductPlanPrice } from "@/lib/whop-plan-sync";

const productId = "prod_test";

function plan(overrides: Partial<WhopPlanListItem> = {}): WhopPlanListItem {
  return {
    id: "plan_test",
    visibility: "visible",
    release_method: "buy_now",
    currency: "usd",
    product: { id: productId },
    plan_type: "one_time",
    billing_period: null,
    initial_price: 0,
    renewal_price: 0,
    ...overrides,
  };
}

describe("Whop plan price mapping", () => {
  it("distinguishes a confirmed free plan from an unknown price", () => {
    assert.deepEqual(resolveWhopProductPlanPrice([plan()], productId), {
      priceCents: 0,
      billingPeriod: "ONE_TIME",
      billingIntervalCount: 1,
    });
    assert.equal(resolveWhopProductPlanPrice([], productId), null);
  });

  it("maps one-time Whop currency units to integer cents", () => {
    assert.deepEqual(
      resolveWhopProductPlanPrice([plan({ initial_price: 49.99 })], productId),
      {
        priceCents: 4999,
        billingPeriod: "ONE_TIME",
        billingIntervalCount: 1,
      },
    );
  });

  it("maps documented recurring day counts without losing unusual cadences", () => {
    for (const [days, billingPeriod, billingIntervalCount] of [
      [7, "WEEK", 1],
      [14, "WEEK", 2],
      [30, "MONTH", 1],
      [42, "WEEK", 6],
      [365, "YEAR", 1],
      [5, "DAY", 5],
    ] as const) {
      assert.deepEqual(
        resolveWhopProductPlanPrice(
          [
            plan({
              plan_type: "renewal",
              billing_period: days,
              initial_price: 0,
              renewal_price: 19.95,
            }),
          ],
          productId,
        ),
        { priceCents: 1995, billingPeriod, billingIntervalCount },
      );
    }
  });

  it("collapses duplicate public plans only when price and cadence agree", () => {
    const monthly = plan({
      id: "plan_monthly_1",
      plan_type: "renewal",
      billing_period: 30,
      initial_price: 0,
      renewal_price: 25,
    });
    assert.deepEqual(
      resolveWhopProductPlanPrice(
        [monthly, { ...monthly, id: "plan_monthly_2" }],
        productId,
      ),
      {
        priceCents: 2500,
        billingPeriod: "MONTH",
        billingIntervalCount: 1,
      },
    );
    assert.equal(
      resolveWhopProductPlanPrice(
        [monthly, plan({ id: "plan_once", initial_price: 100 })],
        productId,
      ),
      null,
    );
    assert.equal(
      resolveWhopProductPlanPrice(
        [monthly, plan({ id: "plan_eur", currency: "eur" })],
        productId,
      ),
      null,
    );
  });

  it("rejects plans SCL cannot represent without misleading buyers", () => {
    const unsupported = [
      plan({ visibility: "hidden" }),
      plan({ release_method: "waitlist" }),
      plan({ currency: "eur" }),
      plan({ product: { id: "prod_other" } }),
      plan({ initial_price: Number.NaN }),
      plan({
        plan_type: "renewal",
        billing_period: 30,
        initial_price: 10,
        renewal_price: 25,
      }),
      plan({
        plan_type: "renewal",
        billing_period: 0,
        initial_price: 0,
        renewal_price: 25,
      }),
    ];

    for (const candidate of unsupported) {
      assert.equal(resolveWhopProductPlanPrice([candidate], productId), null);
    }
  });
});
