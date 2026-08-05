"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { HANDLE_TAKEN_MESSAGE } from "@/lib/account-claim";
import { prisma } from "@/lib/prisma";
import { isTestHandle } from "@/lib/public-eligibility";
import { profileSchema, type ProfileInput } from "@/lib/schemas/profile.schema";
import { getCurrentAccount } from "@/lib/session";

type ProfileResult = { ok: true } | { ok: false; error: string };

const nullify = (v?: string) => (v && v.trim() ? v.trim() : null);

export async function updateProfileAction(
  input: ProfileInput,
): Promise<ProfileResult> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: "You must be logged in." };
  if (account.accountStatus !== "ACTIVE" || !account.emailVerified) {
    return {
      ok: false,
      error: "Verify your email before updating your profile.",
    };
  }
  if (!account.legalAcceptance) {
    return { ok: false, error: "Accept the current terms to continue." };
  }

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    const usernameIssue = parsed.error.issues.find((issue) =>
      issue.path.includes("username"),
    );
    return {
      ok: false,
      error: usernameIssue?.message ?? "Please check the form and try again.",
    };
  }
  const d = parsed.data;

  const current = await prisma.user.findUnique({
    where: { id: account.id },
    select: { username: true },
  });
  if (!current) return { ok: false, error: "Account not found." };

  const nextUsername = d.username;
  const previousUsername = current.username?.replace(/^@+/, "").toLowerCase();
  const usernameChanged = nextUsername !== previousUsername;

  if (usernameChanged) {
    if (isTestHandle(nextUsername)) {
      return {
        ok: false,
        error: "That username is reserved. Choose a different handle.",
      };
    }

    const taken = await prisma.user.findUnique({
      where: { username: nextUsername },
      select: { id: true },
    });
    if (taken && taken.id !== account.id) {
      return { ok: false, error: HANDLE_TAKEN_MESSAGE };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (usernameChanged) {
        await tx.user.update({
          where: { id: account.id },
          data: { username: nextUsername },
        });
      }

      await tx.capperProfile.update({
        where: { userId: account.id },
        data: {
          headline: nullify(d.headline),
          bio: nullify(d.bio),
          providerType: d.providerType,
          sports: d.sports,
          books: d.books,
          specialties: d.specialties,
          betTypes: d.betTypes,
          dailyVolume: d.dailyVolume ? d.dailyVolume : null,
          writtenAnalysis: d.writtenAnalysis,
          biggestBetWon: nullify(d.biggestBetWon),
          storefrontTitle: nullify(d.storefrontTitle),
          storefrontDescription: nullify(d.storefrontDescription),
          storefrontEnabled: d.storefrontEnabled,
          // Social / website columns intentionally untouched — dormant legacy values.
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: HANDLE_TAKEN_MESSAGE };
    }
    throw error;
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/cappers");
  revalidatePath("/leaderboard");
  revalidatePath("/discover");
  if (previousUsername) {
    revalidatePath(`/cappers/${previousUsername}`);
  }
  revalidatePath(`/cappers/${nextUsername}`);
  return { ok: true };
}
