import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Bust every surface that embeds package / storefront data.
 *
 * Profile package cards are queried live, but the capper shell (stats,
 * storefront copy, leaderboard buy CTAs) is cached under the `leaderboard`
 * tag for 60s. Commerce writes must invalidate the tag and profile ISR.
 */
export function revalidateCommerceSurfaces(input?: {
  username?: string | null;
  capperUserId?: string | null;
}) {
  revalidateTag("leaderboard", { expire: 0 });

  revalidatePath("/dashboard/monetization");
  revalidatePath("/admin/store-setup");
  revalidatePath("/admin/packages");
  revalidatePath("/admin/cappers");
  revalidatePath("/packages");
  revalidatePath("/leaderboard");
  revalidatePath("/discover");
  revalidatePath("/cappers/[handle]", "page");

  if (input?.capperUserId) {
    revalidatePath(`/admin/cappers/${input.capperUserId}`);
  }

  const handle = input?.username?.replace(/^@+/, "").trim();
  if (handle) {
    revalidatePath(`/cappers/${handle}`);
  }
}
