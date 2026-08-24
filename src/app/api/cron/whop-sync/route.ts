import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { revalidateCommerceSurfaces } from "@/lib/revalidate-commerce";
import { pushPackageToWhop, syncWhopStorefront } from "@/lib/whop-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WHOP_SYNC_BATCH_SIZE = 5;
const WHOP_PUSH_BATCH_SIZE = 25;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = req.headers.get("authorization");
  return Boolean(
    secret &&
    (authorization === secret || authorization === `Bearer ${secret}`),
  );
}

/**
 * Reconcile every connected Whop storefront.
 *
 * Whop webhooks remain the fast path. This scheduled pass is the durable path
 * for businesses whose events are delayed or whose company-specific webhook
 * is unavailable. It also discovers new products without manual admin action.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = await prisma.user.findFirst({
    where: { role: "ADMIN", accountStatus: "ACTIVE" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "No active admin actor is available." },
      { status: 503 },
    );
  }

  // SCL owns an explicit admin edit until Whop acknowledges it. Retry those
  // durable revisions before any inbound pull so a failed push cannot be
  // silently overwritten by the older Whop value.
  const pendingPushes = await prisma.package.findMany({
    where: {
      whopPushPendingAt: { not: null },
      externalProductId: { not: null },
      storeConnection: {
        is: { provider: "WHOP", status: { not: "DISABLED" } },
      },
    },
    select: { id: true, externalProductId: true, whopPushAttempts: true },
    orderBy: { whopPushPendingAt: "asc" },
    take: WHOP_PUSH_BATCH_SIZE,
  });
  const pushResults = await Promise.all(
    pendingPushes.map(async (pending) => {
      try {
        const result = await pushPackageToWhop(pending.id);
        return {
          packageId: pending.id,
          productId: pending.externalProductId,
          ok: result.ok,
          pushed: result.ok ? result.pushed : false,
          attempt: pending.whopPushAttempts + 1,
          ...(!result.ok && { error: result.error }),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          JSON.stringify({
            level: "error",
            message: "Unhandled Whop package retry failure",
            packageId: pending.id,
            productId: pending.externalProductId,
            attempt: pending.whopPushAttempts + 1,
            error: message,
          }),
        );
        return {
          packageId: pending.id,
          productId: pending.externalProductId,
          ok: false as const,
          pushed: false,
          attempt: pending.whopPushAttempts + 1,
          error: message,
        };
      }
    }),
  );
  const failedPushes = pushResults.filter((result) => !result.ok);

  const connections = await prisma.storeConnection.findMany({
    where: {
      provider: "WHOP",
      status: { not: "DISABLED" },
      whopCompanyId: { not: null },
      whopCompanyRoute: { not: null },
    },
    select: {
      id: true,
      whopCompanyId: true,
      capper: {
        select: { user: { select: { id: true, username: true } } },
      },
    },
    orderBy: { updatedAt: "asc" },
  });

  const results: Array<{
    connectionId: string;
    companyId: string | null;
    ok: boolean;
    imported?: number;
    updated?: number;
    skipped?: number;
    error?: string;
  }> = [];

  for (
    let index = 0;
    index < connections.length;
    index += WHOP_SYNC_BATCH_SIZE
  ) {
    const batch = connections.slice(index, index + WHOP_SYNC_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (connection) => {
        try {
          const result = await syncWhopStorefront({
            storeConnectionId: connection.id,
            actorId: actor.id,
          });
          if (!result.ok) {
            return {
              connectionId: connection.id,
              companyId: connection.whopCompanyId,
              ok: false,
              error: result.error,
            };
          }
          if (result.imported > 0 || result.updated > 0) {
            revalidateCommerceSurfaces({
              username: connection.capper.user.username,
              capperUserId: connection.capper.user.id,
            });
          }
          return {
            connectionId: connection.id,
            companyId: connection.whopCompanyId,
            ok: true,
            imported: result.imported,
            updated: result.updated,
            skipped: result.skipped,
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unexpected sync failure";
          console.error(`[cron/whop-sync] ${connection.id} failed: ${message}`);
          return {
            connectionId: connection.id,
            companyId: connection.whopCompanyId,
            ok: false,
            error: message,
          };
        }
      }),
    );
    results.push(...batchResults);
  }

  const failedSyncs = results.filter((result) => !result.ok);
  const imported = results.reduce(
    (total, result) => total + (result.imported ?? 0),
    0,
  );
  const updated = results.reduce(
    (total, result) => total + (result.updated ?? 0),
    0,
  );

  console.info(
    `[cron/whop-sync] pushes=${pushResults.length} pushFailed=${failedPushes.length} checked=${results.length} imported=${imported} updated=${updated} syncFailed=${failedSyncs.length}`,
  );

  return NextResponse.json({
    ok: failedPushes.length === 0 && failedSyncs.length === 0,
    pushes: {
      checked: pushResults.length,
      pushed: pushResults.filter((result) => result.pushed).length,
      failed: failedPushes.length,
      results: pushResults,
    },
    checked: results.length,
    imported,
    updated,
    failed: failedPushes.length + failedSyncs.length,
    results,
  });
}
