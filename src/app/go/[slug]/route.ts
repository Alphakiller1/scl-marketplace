import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * SCL tracking redirect:
 * User clicks package on SCL → /go/:slug logs click → 302 to provider affiliate URL.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  if (!slug) {
    return NextResponse.redirect(new URL("/packages", request.url));
  }

  try {
    const tracking = await prisma.trackingUrl.findUnique({
      where: { slug },
      select: {
        id: true,
        targetUrl: true,
        package: {
          select: {
            isActive: true,
            storeConnection: { select: { status: true } },
          },
        },
      },
    });

    if (!tracking) {
      return NextResponse.redirect(new URL("/packages", request.url));
    }

    const storeStatus = tracking.package.storeConnection?.status;
    const allowed =
      tracking.package.isActive &&
      (storeStatus == null || storeStatus === "LIVE");

    if (!allowed || !tracking.targetUrl) {
      return NextResponse.redirect(new URL("/packages", request.url));
    }

    const referrer = request.headers.get("referer");
    const userAgent = request.headers.get("user-agent");

    await prisma.clickEvent.create({
      data: {
        trackingUrlId: tracking.id,
        referrer: referrer?.slice(0, 500) || null,
        userAgent: userAgent?.slice(0, 500) || null,
      },
    });

    return NextResponse.redirect(tracking.targetUrl, { status: 302 });
  } catch (error) {
    console.error("[/go] tracking lookup failed:", error);
    return NextResponse.redirect(new URL("/packages", request.url));
  }
}
