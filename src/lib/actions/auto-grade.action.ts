"use server";

import { revalidateTrackingSurfaces } from "@/lib/revalidate-tracking";
import { autoGradePending } from "@/lib/results/auto-grade";
import {
  getResultsProvider,
  ResultsProviderUnavailable,
} from "@/lib/results/provider";
import { requireAdmin } from "@/lib/session";

type AutoGradeActionResult =
  | { ok: true; graded: number; skipped: number; provider: string }
  | { ok: false; error: string };

/**
 * Admin trigger: grade every pending position we can resolve from settled results.
 * Uses the live provider when ODDS_API_KEY is set, otherwise demo results.
 */
export async function runAutoGradeAction(): Promise<AutoGradeActionResult> {
  await requireAdmin();
  try {
    const result = await autoGradePending(getResultsProvider());
    revalidateTrackingSurfaces();
    return { ok: true, ...result };
  } catch (err) {
    if (err instanceof ResultsProviderUnavailable) {
      return { ok: false, error: "Results provider isn't configured yet." };
    }
    console.error("[runAutoGradeAction] failed:", err);
    return { ok: false, error: "Auto-grade run failed. Try again." };
  }
}
