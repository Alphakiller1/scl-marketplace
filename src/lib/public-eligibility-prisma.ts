import "server-only";

import { prismaExcludeTestHandles } from "@/lib/public-eligibility";
import { hasIsTestColumn } from "@/lib/results/schema-features";

/**
 * Public-query user filter with User.isTest soft-degrade.
 * Prefer this over the pure {@link prismaExcludeTestHandles} in server queries.
 */
export async function prismaExcludeTestHandlesLive() {
  return prismaExcludeTestHandles({
    includeIsTestColumn: await hasIsTestColumn(),
  });
}
