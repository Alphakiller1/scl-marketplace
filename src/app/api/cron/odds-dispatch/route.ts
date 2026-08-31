import { NextRequest, NextResponse } from "next/server";

import { claimDueOddsRuns } from "@/lib/odds-control-runtime";
import { executeClaimedOddsRun } from "@/lib/odds-control-executor";
import { executeVerificationScheduleRun } from "@/lib/verification-schedule-executor";
import { claimDueVerificationSchedule } from "@/lib/verification-schedule-runtime";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(
    secret && req.headers.get("authorization") === `Bearer ${secret}`,
  );
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let claimed: Awaited<ReturnType<typeof claimDueOddsRuns>>;
  let verification: Awaited<ReturnType<typeof claimDueVerificationSchedule>>;
  try {
    claimed = await claimDueOddsRuns();
    verification = await claimDueVerificationSchedule();
  } catch (error) {
    console.error("[odds-dispatch] unable to claim work", error);
    return NextResponse.json(
      { ok: false, error: "Dispatcher storage is unavailable." },
      { status: 503 },
    );
  }
  if (!claimed.runs.length && !verification) {
    return NextResponse.json({ ok: true, state: claimed.state, runs: [] });
  }
  const runs = await Promise.all(
    claimed.runs.map((run) => executeClaimedOddsRun(req.nextUrl.origin, run)),
  );
  // Verification owns a per-invocation provider-cost counter. Run it after
  // population so parallel work cannot reset or contaminate that total.
  if (verification) {
    runs.push(await executeVerificationScheduleRun(verification));
  }
  const ok = runs.every((run) => run.ok);
  return NextResponse.json(
    { ok, state: claimed.state, runs },
    { status: ok ? 200 : 502 },
  );
}
