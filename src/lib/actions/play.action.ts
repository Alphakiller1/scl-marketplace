"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { playSchema, type PlayInput } from "@/lib/schemas/play.schema";

type PlayResult = { ok: true } | { ok: false; error: string };

export async function createPlay(input: PlayInput): Promise<PlayResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emailVerified: true },
  });
  if (!account?.emailVerified) {
    return { ok: false, error: "Verify your email before submitting plays." };
  }

  const parsed = playSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }

  const profile = await prisma.capperProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!profile) return { ok: false, error: "No capper profile found." };

  const d = parsed.data;
  await prisma.play.create({
    data: {
      capperId: profile.id,
      sport: d.sport,
      league: d.league ?? null,
      market: d.market,
      selection: d.selection,
      oddsAmerican: d.oddsAmerican,
      units: d.units,
      notes: d.notes ?? null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/picks");
  return { ok: true };
}
