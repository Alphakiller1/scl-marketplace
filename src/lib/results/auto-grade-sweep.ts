import "server-only";

import { after } from "next/server";

import { consumeRateLimit } from "@/lib/rate-limit";
import { autoGradePending } from "@/lib/results/auto-grade";
import { getResultsProvider } from "@/lib/results/provider";

/** Shortest gap between traffic-triggered sweeps, across all instances. */
const SWEEP_WINDOW_MS = 10 * 60 * 1000;

/**
 * Grade pending picks off the back of ordinary traffic.
 *
 * Grading used to depend entirely on schedulers, and both are unreliable here:
 * Vercel Hobby permits ONE cron a day, and GitHub's scheduled workflows are
 * best-effort — on a bad day a fifteen-minute schedule fired roughly every two hours and
 * then stopped, leaving finished games ungraded for eight hours while the code
 * was working perfectly.
 *
 * A busy site pokes itself. The throttle is a DB row, not process memory, so it
 * holds across serverless instances: at most one sweep per SWEEP_WINDOW_MS no
 * matter how much traffic arrives, which also caps the Odds API spend.
 *
 * Fire-and-forget via `after()` — the visitor's response is never delayed and a
 * failure here can never surface as a broken page. The schedulers stay as a
 * floor for quiet periods.
 */
export async function maybeSweepGrading(): Promise<void> {
  let allowed = false;
  try {
    allowed = await consumeRateLimit({
      scope: "auto-grade-sweep",
      identity: "global",
      limit: 1,
      windowMs: SWEEP_WINDOW_MS,
    });
  } catch {
    // Throttle store unavailable — skip rather than risk a stampede.
    return;
  }
  if (!allowed) return;

  after(async () => {
    try {
      const result = await autoGradePending(getResultsProvider());
      if (result.graded > 0) {
        console.info(
          `[auto-grade-sweep] graded ${result.graded}, skipped ${result.skipped}`,
        );
      }
    } catch (err) {
      console.error("[auto-grade-sweep] failed:", err);
    }
  });
}
