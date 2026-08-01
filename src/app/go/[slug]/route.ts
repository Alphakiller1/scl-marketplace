import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";
import { publicPackagePublicationWhere } from "@/lib/public-packages";

export const runtime = "nodejs";

/** Clicks one client may record on a single offer before further hits stop counting. */
const CLICK_RECORD_LIMIT = 10;
const CLICK_RECORD_WINDOW_MS = 60 * 60 * 1000;

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
    const excludeTest = await prismaExcludeTestHandlesLive();
    const tracking = await prisma.trackingUrl.findFirst({
      where: {
        slug,
        package: publicPackagePublicationWhere(excludeTest),
      },
      select: {
        id: true,
        targetUrl: true,
      },
    });

    if (!tracking) {
      return NextResponse.redirect(new URL("/packages", request.url));
    }

    if (!tracking.targetUrl) {
      return NextResponse.redirect(new URL("/packages", request.url));
    }

    const referrer = request.headers.get("referer");
    const userAgent = request.headers.get("user-agent");

    // This endpoint is public and writes a row per request, so a loop could
    // both bloat ClickEvent and inflate a capper's click count — a number
    // admins read as performance. Cap what one client can record per offer.
    //
    // The cap suppresses the RECORDING only; the redirect always happens.
    // Rate-limiting someone out of a purchase to protect an analytics number
    // would be the wrong trade, and a failure here must never block the sale
    // either, so recording is best-effort.
    const client =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    try {
      const record = await consumeRateLimit({
        scope: `go:${slug}`,
        identity: client,
        limit: CLICK_RECORD_LIMIT,
        windowMs: CLICK_RECORD_WINDOW_MS,
      });
      if (record) {
        await prisma.clickEvent.create({
          data: {
            trackingUrlId: tracking.id,
            referrer: referrer?.slice(0, 500) || null,
            userAgent: userAgent?.slice(0, 500) || null,
          },
        });
      }
    } catch (error) {
      console.error("[/go] click not recorded:", error);
    }

    return NextResponse.redirect(tracking.targetUrl, { status: 302 });
  } catch (error) {
    console.error("[/go] tracking lookup failed:", error);
    return NextResponse.redirect(new URL("/packages", request.url));
  }
}
