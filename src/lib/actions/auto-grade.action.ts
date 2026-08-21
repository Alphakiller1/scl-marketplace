"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { autoGradePending } from "@/lib/results/auto-grade";
import { ESPN_HISTORICAL_SCOREBOARD_DAYS } from "@/lib/results/espn-scores";
import {
  getResultsProvider,
  ResultsProviderUnavailable,
} from "@/lib/results/provider";
import { requireAdmin } from "@/lib/session";

type AutoGradeActionResult =
  | { ok: true; graded: number; skipped: number; provider: string }
  | { ok: false; error: string };

/**
 * Admin trigger: force-settle every pending play whose event is already
 * completed. Uses the full scores stack (Odds API for every sport + ESPN 14d,
 * including UFC cards) rather than the credit-saving cron provider.
 */
export async function runAutoGradeAction(): Promise<AutoGradeActionResult> {
  await requireAdmin();
  try {
    const result = await autoGradePending(getResultsProvider(), {
      lookbackDays: ESPN_HISTORICAL_SCOREBOARD_DAYS,
    });
    revalidateTag("leaderboard", { expire: 0 });
    revalidatePath("/admin/grading");
    revalidatePath("/admin/plays");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/picks");
    revalidatePath("/picks");
    revalidatePath("/leaderboard");
    revalidatePath("/discover");
    revalidatePath("/cappers/[handle]", "page");
    revalidatePath("/");
    return { ok: true, ...result };
  } catch (err) {
    if (err instanceof ResultsProviderUnavailable) {
      return { ok: false, error: "Results provider isn't configured yet." };
    }
    console.error("[runAutoGradeAction] failed:", err);
    return { ok: false, error: "Auto-grade run failed. Try again." };
  }
}
