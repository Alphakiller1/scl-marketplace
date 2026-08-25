import type { WhopPlanListItem } from "@/lib/whop-api";

export type WhopPlanPrice = {
  priceCents: number;
  billingPeriod: "ONE_TIME" | "DAY" | "WEEK" | "MONTH" | "YEAR";
  billingIntervalCount: number;
};

function currencyUnitsToCents(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function recurringCadence(
  days: number | null | undefined,
): Pick<WhopPlanPrice, "billingPeriod" | "billingIntervalCount"> | null {
  if (typeof days !== "number" || !Number.isSafeInteger(days) || days <= 0) {
    return null;
  }

  // Whop documents 30 days as monthly and 365 days as yearly. Preserve every
  // other interval exactly instead of pretending, for example, that 42 days is
  // a calendar month.
  if (days === 365) {
    return { billingPeriod: "YEAR", billingIntervalCount: 1 };
  }
  if (days === 30) {
    return { billingPeriod: "MONTH", billingIntervalCount: 1 };
  }
  if (days % 7 === 0) {
    return { billingPeriod: "WEEK", billingIntervalCount: days / 7 };
  }
  return { billingPeriod: "DAY", billingIntervalCount: days };
}

function mapPublicBuyNowPlan(plan: WhopPlanListItem): WhopPlanPrice | null {
  if (
    plan.visibility?.toLowerCase() !== "visible" ||
    plan.release_method?.toLowerCase() !== "buy_now" ||
    plan.currency?.toLowerCase() !== "usd"
  ) {
    return null;
  }

  if (plan.plan_type?.toLowerCase() === "one_time") {
    const priceCents = currencyUnitsToCents(plan.initial_price);
    return priceCents === null
      ? null
      : {
          priceCents,
          billingPeriod: "ONE_TIME",
          billingIntervalCount: 1,
        };
  }

  if (plan.plan_type?.toLowerCase() !== "renewal") return null;

  // Whop defines initial_price on a renewal as an additional first-purchase
  // charge on top of renewal_price. SCL cannot faithfully display both prices
  // in its one-price Package schema, so do not publish a misleading partial
  // price for that plan.
  const initialPriceCents = currencyUnitsToCents(plan.initial_price);
  const priceCents = currencyUnitsToCents(plan.renewal_price);
  const cadence = recurringCadence(plan.billing_period);
  if (initialPriceCents !== 0 || priceCents === null || !cadence) return null;

  return { priceCents, ...cadence };
}

/**
 * Resolve the one price SCL can safely display for a Whop product.
 *
 * A Whop product may have multiple visible plans, while SCL currently has one
 * price per Package. Identical alternatives are safe to collapse; different
 * prices/cadences are deliberately unresolved so the storefront says "See
 * provider for current price" instead of inventing a winner.
 */
export function resolveWhopProductPlanPrice(
  plans: WhopPlanListItem[],
  productId: string,
): WhopPlanPrice | null {
  const publicBuyNowPlans = plans.filter(
    (plan) =>
      plan.product?.id === productId &&
      plan.visibility?.toLowerCase() === "visible" &&
      plan.release_method?.toLowerCase() === "buy_now",
  );
  if (!publicBuyNowPlans.length) return null;

  const candidates = publicBuyNowPlans.map(mapPublicBuyNowPlan);
  // One incompatible public option makes the product as a whole ambiguous.
  // Ignoring it and showing a different plan's price would still misdescribe
  // what the buyer can choose on Whop.
  if (candidates.some((candidate) => candidate === null)) return null;
  const mapped = candidates as WhopPlanPrice[];
  const first = mapped[0]!;
  const allIdentical = mapped.every(
    (candidate) =>
      candidate.priceCents === first.priceCents &&
      candidate.billingPeriod === first.billingPeriod &&
      candidate.billingIntervalCount === first.billingIntervalCount,
  );
  return allIdentical ? first : null;
}
