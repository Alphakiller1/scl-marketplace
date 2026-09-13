"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  honorsContentSchema,
  type HonorsContentInput,
} from "@/lib/schemas/honors.schema";
import { requireAdmin } from "@/lib/session";
import { getCurrentHonors } from "@/lib/queries/honors";

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
    revalidatePath("/admin/honors");
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

export async function snapshotCurrentHonorsAction() {
  await requireAdmin();
  try {
    const awards = await getCurrentHonors(new Date());
    if (!awards.length) {
      return {
        ok: false as const,
        error: "No qualifying award winners are available to save.",
      };
    }
    await prisma.$transaction(
      awards.map((award) => {
        const data = {
          name: award.name,
          abbreviation: award.abbreviation,
          icon: award.icon,
          period: award.period,
          sport: award.sport,
          metric: award.metric,
          minimumPicks: award.minimumPicks,
          visibleFrom: award.visibleFrom,
          visibleUntil: award.visibleUntil,
          capperId: award.winner.id,
          winnerName: award.winner.name,
          winnerHandle: award.winner.handle,
          winnerAvatarUrl: award.winner.avatarUrl ?? null,
          wins: award.winner.record.w,
          losses: award.winner.record.l,
          pushes: award.winner.record.p,
          units: award.winner.units,
          roi: award.winner.roi,
        };
        return prisma.honorAwardGrant.upsert({
          where: { id: award.id },
          create: { id: award.id, ...data },
          update: data,
        });
      }),
    );
    revalidatePath("/");
    revalidatePath("/honors");
    revalidatePath("/leaderboard");
    revalidatePath("/cappers/[handle]", "page");
    return { ok: true as const, count: awards.length };
  } catch (error) {
    console.error("[honors] snapshot failed", error);
    return {
      ok: false as const,
      error:
        "Awards could not be saved. Apply the local database migration first.",
    };
  }
}
