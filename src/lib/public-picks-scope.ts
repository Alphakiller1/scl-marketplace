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

/**
 * The same scope for parlays.
 *
 * A parlay has no `sport` or `eventStartsAt` of its own — its legs carry both —
 * so sport matches when any leg is in that sport, and the lifecycle reads off
 * the legs: in progress once any leg has started inside the expected-final
 * window, still pending when none has.
 */
export function buildPublicParlayScopeWhere(
  filters: PublicPicksLedgerFilters,
  now: Date,
): Prisma.ParlayWhereInput {
  const liveLowerBound = new Date(now.getTime() - EXPECTED_FINAL_MS);
  const started = { eventStartsAt: { gt: liveLowerBound, lte: now } };
  // Sport and lifecycle both constrain `legs`, so they are ANDed rather than
  // spread into one object where the second would silently drop the first.
  const conditions: Prisma.ParlayWhereInput[] = [];

  if (filters.window !== "all") {
    conditions.push({
      createdAt: {
        gte: new Date(
          now.getTime() -
            (filters.window === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000,
        ),
      },
    });
  }
  if (filters.sport !== "all") {
    conditions.push({ legs: { some: { sport: filters.sport } } });
  }
  switch (filters.status) {
    case "graded":
      conditions.push({ outcome: { in: ["WIN", "LOSS", "PUSH", "VOID"] } });
      break;
    case "live":
      conditions.push({ outcome: "PENDING" }, { legs: { some: started } });
      break;
    case "pending":
      conditions.push({ outcome: "PENDING" }, { legs: { none: started } });
      break;
    default:
      break;
  }

  return conditions.length ? { AND: conditions } : {};
}
