import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

// ONE-TIME: resolves the stuck failed migration in the production DB.
// DELETE this file after running once in production.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization");
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const out = execSync(
      "npx prisma migrate resolve --applied 20260719000000_ci_catchup_istest_needsreview",
      { encoding: "utf8", env: { ...process.env } }
    );
    return NextResponse.json({ ok: true, output: out });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}