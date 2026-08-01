// No `server-only` guard, matching `prisma.ts` and `public-eligibility-prisma.ts`
// in the same chain: the Milestone 3 smoke test imports `/go/[slug]` directly
// under tsx, and `server-only` throws outside the bundler. The real protection
// is unchanged — this imports `prisma`, which cannot run in a browser — and
// `whop-webhook.ts` already establishes the precedent of dropping the guard
// where it costs testability.
import { createHash } from "crypto";

import { prisma } from "@/lib/prisma";

type ThrottleRow = { count: number };

const throttleKey = (scope: string, identity: string) =>
  createHash("sha256")
    .update(`${scope}:${identity.trim().toLowerCase()}`)
    .digest("hex");

export async function consumeRateLimit({
  scope,
  identity,
  limit,
  windowMs,
}: {
  scope: string;
  identity: string;
  limit: number;
  windowMs: number;
}): Promise<boolean> {
  const key = throttleKey(scope, identity);
  const resetBefore = new Date(Date.now() - windowMs);
  // SCL lives in the `scl` schema. Prisma's ORM is schema-aware, but a raw query is NOT —
  // through Supabase's transaction pooler the search_path isn't `scl`, so an unqualified
  // "RequestThrottle" resolves to `public` and fails (42P01), throwing a 500 out of every
  // rate-limited action (signup, login, password reset). Qualify the table explicitly.
  const rows = await prisma.$queryRaw<ThrottleRow[]>`
    INSERT INTO "scl"."RequestThrottle" ("key", "count", "windowStartedAt", "updatedAt")
    VALUES (${key}, 1, NOW(), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RequestThrottle"."windowStartedAt" < ${resetBefore} THEN 1
        ELSE "RequestThrottle"."count" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "RequestThrottle"."windowStartedAt" < ${resetBefore} THEN NOW()
        ELSE "RequestThrottle"."windowStartedAt"
      END,
      "updatedAt" = NOW()
    RETURNING "count"
  `;

  return (rows[0]?.count ?? limit + 1) <= limit;
}

export async function isRateLimitAllowed({
  scope,
  identity,
  limit,
  windowMs,
}: {
  scope: string;
  identity: string;
  limit: number;
  windowMs: number;
}) {
  const record = await prisma.requestThrottle.findUnique({
    where: { key: throttleKey(scope, identity) },
    select: { count: true, windowStartedAt: true },
  });
  if (!record) return true;
  if (record.windowStartedAt.getTime() < Date.now() - windowMs) return true;
  return record.count < limit;
}

export async function clearRateLimit(scope: string, identity: string) {
  await prisma.requestThrottle.deleteMany({
    where: { key: throttleKey(scope, identity) },
  });
}
