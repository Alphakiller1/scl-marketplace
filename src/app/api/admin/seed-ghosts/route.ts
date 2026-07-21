import { NextRequest, NextResponse } from "next/server";

import { runGhostSeed } from "../../../../../scripts/seed-ghosts";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    return req.headers.get("authorization") === `Bearer ${secret}`;
  }
  if (req.headers.get("x-vercel-cron") === "1") return true;
  return false;
}

/**
 * Temporary production populate: wipe/seed @ghost.scl.demo cappers.
 * Auth: Authorization: Bearer $CRON_SECRET (same as /api/cron/grade).
 *
 * Chunked body JSON:
 *   { "wipeOnly": true }
 *   { "skipWipe": true, "offset": 0, "limit": 3 }
 */
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  process.env.GHOST_SEED = "1";
  process.env.GHOST_SEED_FORCE = "1";

  let body: {
    wipeOnly?: boolean;
    skipWipe?: boolean;
    offset?: number;
    limit?: number;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const result = await runGhostSeed({
      force: true,
      wipeOnly: body.wipeOnly === true,
      skipWipe: body.skipWipe === true,
      offset: body.offset,
      limit: body.limit ?? (body.wipeOnly ? undefined : 3),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin/seed-ghosts]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    hint: "POST with { wipeOnly: true } then chunked { skipWipe: true, offset, limit }",
  });
}
