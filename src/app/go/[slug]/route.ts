import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const tracking = await prisma.trackingUrl.findUnique({
    where: { slug },
    select: {
      id: true,
      targetUrl: true,
      package: {
        select: {
          visibility: true,
          suspendedAt: true,
          isActive: true,
        },
      },
    },
  });

  if (
    !tracking ||
    tracking.package.visibility !== "LIVE" ||
    tracking.package.suspendedAt ||
    !tracking.package.isActive
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const session = await auth();
  const customerUserId =
    session?.user?.role === "CUSTOMER" ? session.user.id : null;

  await prisma.clickEvent.create({
    data: {
      trackingUrlId: tracking.id,
      customerUserId,
      referrer: request.headers.get("referer"),
      userAgent: request.headers.get("user-agent"),
    },
  });

  return NextResponse.redirect(tracking.targetUrl);
}
