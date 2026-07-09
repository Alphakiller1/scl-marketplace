import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Refresh every surface that displays tracked positions or derived performance.
 * This keeps submissions, manual grades, auto-grades, and parlay settlements from
 * updating the database while public/private dashboards show stale cached data.
 */
export function revalidateTrackingSurfaces(handle?: string | null) {
  revalidatePath("/");
  revalidatePath("/picks");
  revalidatePath("/leaderboard");
  revalidatePath("/cappers");
  revalidatePath("/cappers/[handle]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/picks");
  revalidatePath("/admin");
  revalidatePath("/admin/grading");

  if (handle) {
    revalidatePath(`/cappers/${handle}`);
  }
}
