import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { whopAppId } from "@/lib/whop-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Open Whop's official business chooser for the SCL Marketplace app. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL("/login?callbackUrl=/dashboard/monetization", req.nextUrl.origin),
    );
  }

  const appId = whopAppId();
  if (!appId) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/monetization?whop=not-configured",
        req.nextUrl.origin,
      ),
    );
  }

  return NextResponse.redirect(`https://whop.com/apps/${appId}/install`);
}
