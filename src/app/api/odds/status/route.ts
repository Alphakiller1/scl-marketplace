import { NextResponse } from "next/server";

import { oddsApiKey } from "@/lib/odds-api";

// Public health probe: reports ONLY whether the odds key is configured in this
// deployment (never the value). Used to verify env wiring; safe to remove later.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ configured: Boolean(oddsApiKey()) });
}
