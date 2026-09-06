import "server-only";
import type { Prisma } from "@prisma/client";

/** Serialize manual and automatic settlements of a ticket and its legs. */
export async function lockParlaySettlement(
  tx: Prisma.TransactionClient,
  id: string,
) {
  await tx.$queryRaw`SELECT "id" FROM scl."Parlay" WHERE "id" = ${id} FOR UPDATE`;
}
