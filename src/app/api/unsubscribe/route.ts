import { NextResponse } from "next/server";

import { unsubscribeWithToken } from "@/lib/unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RFC 8058 one-click target for the `List-Unsubscribe` header on campaigns.
 * Mail clients POST `List-Unsubscribe=One-Click` here with no user session; the
 * signed token in the URL is the authorisation.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const ok = await unsubscribeWithToken(token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

/** A client that opens the header URL in a browser gets the confirm page. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL("/unsubscribe", url.origin);
  const token = url.searchParams.get("token");
  if (token) target.searchParams.set("token", token);
  return NextResponse.redirect(target, 303);
}
