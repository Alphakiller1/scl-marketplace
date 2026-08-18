import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { syncWhopStorefront } from "@/lib/whop-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WHOP_SYNC_BATCH_SIZE = 5;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = req.headers.get("authorization");
  return Boolean(
    secret &&
    (authorization === secret || authorization === `Bearer ${secret}`),
  );
}

function revalidateStorefront(username: string | null, userId: string) {
  revalidatePath("/dashboard/monetization");
  revalidatePath("/admin/store-setup");
  revalidatePath("/admin/packages");
  revalidatePath("/admin/cappers");
  revalidatePath(`/admin/cappers/${userId}`);
  revalidatePath("/packages");
  if (username) revalidatePath(`/cappers/${username.replace(/^@/, "")}`);
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
            revalidateStorefront(
              connection.capper.user.username,
              connection.capper.user.id,
            );
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

  const failed = results.filter((result) => !result.ok);
  const imported = results.reduce(
    (total, result) => total + (result.imported ?? 0),
    0,
  );
  const updated = results.reduce(
    (total, result) => total + (result.updated ?? 0),
    0,
  );

  console.info(
    `[cron/whop-sync] checked=${results.length} imported=${imported} updated=${updated} failed=${failed.length}`,
  );

  return NextResponse.json({
    ok: failed.length === 0,
    checked: results.length,
    imported,
    updated,
    failed: failed.length,
    results,
  });
}
