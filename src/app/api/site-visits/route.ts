import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { etYmd } from "@/lib/et-day";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIdentity } from "@/lib/request-identity";
import {
  isSiteVisitBrowser,
  isSiteVisitPath,
  SITE_VISIT_COOKIE,
  SITE_VISIT_SECONDS,
} from "@/lib/site-traffic";

const visitSchema = z.object({
  path: z.string().max(512).refine(isSiteVisitPath),
});
const sessionSchema = z.uuid();

export async function POST(request: NextRequest) {
  const empty = () =>
    new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "private, no-store" },
    });
  if (
    process.env.VERCEL_ENV === "preview" ||
    !isSiteVisitBrowser(request.headers)
  ) {
    return empty();
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403 });
  }
  if (Number(request.headers.get("content-length")) > 1024) {
    return new NextResponse(null, { status: 413 });
  }
  const body = await request.text();
  if (body.length > 1024) return new NextResponse(null, { status: 413 });
  try {
    visitSchema.parse(JSON.parse(body));
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const allowed = await consumeRateLimit({
      scope: "site-visits",
      identity: await getRequestIdentity(),
      limit: 120,
      windowMs: 60_000,
    });
    if (!allowed) return empty();
    const existing = sessionSchema.safeParse(
      request.cookies.get(SITE_VISIT_COOKIE)?.value,
    );
    const session = existing.success ? existing.data : randomUUID();
    const now = new Date();
    const day = etYmd(now);
    const sessionHash = createHash("sha256")
      .update(`${day}:${session}`)
      .digest("hex");
    // The database key deduplicates retries and concurrent navigation requests.
    // Only the day and its anonymous hash are persisted.
    await prisma.siteVisit.createMany({
      data: [{ day, sessionHash, createdAt: now }],
      skipDuplicates: true,
    });
    const response = empty();
    response.cookies.set(SITE_VISIT_COOKIE, session, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: SITE_VISIT_SECONDS,
    });
    return response;
  } catch (error) {
    console.error("[site-visits] recording unavailable", error);
    return new NextResponse(null, { status: 503 });
  }
}
