"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  honorsContentSchema,
  type HonorsContentInput,
} from "@/lib/schemas/honors.schema";
import { requireAdmin } from "@/lib/session";

export async function saveHonorsContentAction(input: HonorsContentInput) {
  const admin = await requireAdmin();
  const parsed = honorsContentSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Check the Honors content.",
    };
  try {
    await prisma.honorsContent.upsert({
      where: { id: "honors" },
      create: { id: "honors", ...parsed.data, updatedById: admin.id },
      update: { ...parsed.data, updatedById: admin.id },
    });
    revalidatePath("/honors");
    revalidatePath("/admin/policies");
    return { ok: true as const };
  } catch (error) {
    console.error("[honors] save failed", error);
    return {
      ok: false as const,
      error:
        "Honors storage is unavailable. Apply the local database migration first.",
    };
  }
}
