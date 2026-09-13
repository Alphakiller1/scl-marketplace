import "server-only";
import { cache } from "react";
import { DEFAULT_HONORS_BODY } from "@/lib/honors";
import { prisma } from "@/lib/prisma";

export const getHonorsContent = cache(async () => {
  try {
    const stored = await prisma.honorsContent.findUnique({
      where: { id: "honors" },
    });
    if (stored) return stored;
  } catch (error) {
    console.error("[honors] content storage unavailable", error);
  }
  return {
    id: "honors",
    title: "SCL Honors",
    body: DEFAULT_HONORS_BODY,
    updatedAt: null,
    updatedById: null,
  };
});
