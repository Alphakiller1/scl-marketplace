import type { Prisma } from "@prisma/client";

import { EXPECTED_FINAL_MS } from "@/lib/lifecycle";
import type { PublicPicksLedgerFilters } from "@/lib/public-picks-ledger";

/**
 * Server query scope for the public ledger. Predicates run before the bounded
 * `take`, so a scoped empty state never means "absent from the latest global 24."
 */
export function buildPublicPicksScopeWhere(
  filters: PublicPicksLedgerFilters,
  now: Date,
): Prisma.PlayWhereInput {
  const createdAt =
    filters.window === "all"
      ? undefined
      : {
          gte: new Date(
            now.getTime() -
              (filters.window === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000,
          ),
        };
  const sport = filters.sport === "all" ? undefined : filters.sport;
  const liveLowerBound = new Date(now.getTime() - EXPECTED_FINAL_MS);

  const lifecycle: Prisma.PlayWhereInput = (() => {
    switch (filters.status) {
      case "graded":
        return { outcome: { in: ["WIN", "LOSS", "PUSH", "VOID"] } };
      case "live":
        return {
          outcome: "PENDING",
          eventStartsAt: { gt: liveLowerBound, lte: now },
        };
      case "pending":
        return {
          outcome: "PENDING",
          OR: [
            { eventStartsAt: null },
            { eventStartsAt: { gt: now } },
            { eventStartsAt: { lte: liveLowerBound } },
          ],
        };
      default:
        return {};
    }
  })();

  return {
    ...(createdAt ? { createdAt } : {}),
    ...(sport ? { sport } : {}),
    ...lifecycle,
  };
}
