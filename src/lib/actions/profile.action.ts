"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";

import { unstable_update } from "@/auth";
import { HANDLE_TAKEN_MESSAGE } from "@/lib/account-claim";
import { emailVerificationEnforced } from "@/lib/email-verification-policy";
import { prisma } from "@/lib/prisma";
import { isTestHandle } from "@/lib/public-eligibility";
import { profileSchema, type ProfileInput } from "@/lib/schemas/profile.schema";
import { getCurrentAccount } from "@/lib/session";

type ProfileResult =
  | { ok: true; usernameChanged: boolean; username: string }
  | { ok: false; error: string };

const nullify = (v?: string) => (v && v.trim() ? v.trim() : null);

export async function updateProfileAction(
  input: ProfileInput,
): Promise<ProfileResult> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: "You must be logged in." };
  if (account.accountStatus !== "ACTIVE") {
    return {
      ok: false,
      error: "Your account must be active before updating your profile.",
    };
  }
  if (emailVerificationEnforced() && !account.emailVerified) {
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

  if (isTestHandle(nextUsername) && nextUsername !== previousUsername) {
    return {
      ok: false,
      error: "That username is reserved. Choose a different handle.",
    };
  }

  const taken = await prisma.user.findFirst({
    where: {
      username: { equals: nextUsername, mode: "insensitive" },
      NOT: { id: account.id },
    },
    select: { id: true },
  });
  if (taken) {
    return { ok: false, error: HANDLE_TAKEN_MESSAGE };
  }

  const profileData = {
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
  };

  try {
    await prisma.$transaction(async (tx) => {
      // Always persist the canonical handle. Skipping when `usernameChanged`
      // is false left mixed-case / @-prefixed rows untouched, so Save looked
      // like a no-op even when the form showed a different value.
      await tx.user.update({
        where: { id: account.id },
        data: { username: nextUsername },
      });

      await tx.capperProfile.upsert({
        where: { userId: account.id },
        create: { userId: account.id, ...profileData },
        update: profileData,
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: HANDLE_TAKEN_MESSAGE };
    }
    console.error("[profile] save failed:", error);
    return {
      ok: false,
      error: "We couldn't save your profile. Try again.",
    };
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/picks");
  revalidatePath("/cappers");
  revalidatePath("/leaderboard");
  revalidatePath("/discover");
  revalidateTag("leaderboard", { expire: 0 });
  revalidatePath("/cappers/[handle]", "page");
  if (previousUsername) {
    revalidatePath(`/cappers/${previousUsername}`);
  }
  revalidatePath(`/cappers/${nextUsername}`);

  if (current.username !== nextUsername) {
    try {
      await unstable_update({ user: { name: nextUsername } });
    } catch (error) {
      console.error("[profile] session username update failed:", error);
    }
  }

  return { ok: true, usernameChanged, username: nextUsername };
}
