import "server-only";
import { cache } from "react";
import { DEFAULT_HONORS_INTRO } from "@/lib/honors";
import { prisma } from "@/lib/prisma";

/**
 * Saved copy from before the rules were generated repeats the old award names
 * and minimums. Showing it above the generated rules would contradict them.
 */
function isRetiredRulesCopy(body: string): boolean {
  return /rolling 90-day|Seasonal Units Champion/i.test(body);
}

export const getHonorsContent = cache(async () => {
  try {
    const stored = await prisma.honorsContent.findUnique({
      where: { id: "honors" },
    });
    if (stored && !isRetiredRulesCopy(stored.body)) return stored;
    if (stored) return { ...stored, body: DEFAULT_HONORS_INTRO };
  } catch (error) {
    console.error("[honors] content storage unavailable", error);
  }
  return {
    id: "honors",
    title: "SCL Honors",
    body: DEFAULT_HONORS_INTRO,
    updatedAt: null,
    updatedById: null,
  };
});
