import { NextRequest, NextResponse } from "next/server";

import { runLiveWhopSyncVerification } from "../../../../../scripts/verify-live-whop-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(
    secret && req.headers.get("authorization") === `Bearer ${secret}`,
  );
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    capperEmail?: string;
    companyId?: string;
    productId?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body.capperEmail?.trim() ||
    !body.companyId?.startsWith("biz_") ||
    !body.productId?.startsWith("prod_")
  ) {
    return NextResponse.json(
      { error: "capperEmail, companyId, and productId are required" },
      { status: 400 },
    );
  }

  try {
    const result = await runLiveWhopSyncVerification({
      capperEmail: body.capperEmail,
      companyId: body.companyId,
      productId: body.productId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin/verify-whop-sync]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
