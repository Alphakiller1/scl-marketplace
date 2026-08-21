"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";

import { emailsShareInbox } from "@/lib/user-credentials";
import { HANDLE_TAKEN_MESSAGE, isUnclaimedAccount } from "@/lib/account-claim";
import { afterResponse } from "@/lib/after-response";
import { withTransientDatabaseRetry } from "@/lib/database-retry";
import { emailVerificationEnforced } from "@/lib/email-verification-policy";
import { prisma } from "@/lib/prisma";
import { isTestHandle } from "@/lib/public-eligibility";
import {
  decideHandleCollision,
  parkedReleasedHandle,
  type HandleOccupant,
  type HandleOccupantCounts,
} from "@/lib/profile-username";
import { profileSchema, type ProfileInput } from "@/lib/schemas/profile.schema";
import { getCurrentAccount } from "@/lib/session";

type ProfileResult =
  | { ok: true; usernameChanged: boolean; username: string }
  | { ok: false; error: string };

const nullify = (v?: string) => (v && v.trim() ? v.trim() : null);

const emptyOccupantCounts: HandleOccupantCounts = {
  plays: 0,
  parlays: 0,
  legacyRecords: 0,
  packages: 0,
  storeConnections: 0,
};

function isUniqueHandleConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function loadOccupantCounts(
  userId: string,
): Promise<HandleOccupantCounts | null> {
  try {
    const profile = await prisma.capperProfile.findUnique({
      where: { userId },
      select: {
        _count: {
          select: {
            plays: true,
            parlays: true,
            legacyRecords: true,
            packages: true,
            storeConnections: true,
          },
        },
      },
    });
    return profile?._count ?? emptyOccupantCounts;
  } catch (error) {
    console.error("[profile] occupant count lookup failed:", error);
    return null;
  }
}

async function findHandleOccupant(
  username: string,
  excludeUserId: string,
  currentEmail?: string | null,
): Promise<HandleOccupant | null> {
  const select = {
    id: true,
    email: true,
    passwordHash: true,
    accountStatus: true,
  } as const;

  try {
    const row = await withTransientDatabaseRetry(
      () =>
        prisma.user.findFirst({
          where: {
            username: { equals: username, mode: "insensitive" },
            NOT: { id: excludeUserId },
          },
          select,
        }),
      { label: "profile handle occupant lookup" },
    );
    if (!row) return null;
    const counts = await loadOccupantCounts(row.id);
    const safeToAssumeEmpty =
      counts !== null ||
      isUnclaimedAccount(row) ||
      emailsShareInbox(currentEmail, row.email);
    return {
      ...row,
      capperProfile: {
        _count: safeToAssumeEmpty
          ? (counts ?? emptyOccupantCounts)
          : { ...emptyOccupantCounts, plays: 1 },
      },
    };
  } catch (error) {
    console.error("[profile] handle occupant lookup failed:", error);
    // Never block a rename on a lookup failure — uniqueness is enforced by
    // the username write (P2002). That is what left @mtndegwn stuck.
    return null;
  }
}

function revalidateProfileSurfaces(
  previousUsername: string | null | undefined,
  nextUsername: string,
) {
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
}

export async function updateProfileAction(
  input: ProfileInput,
): Promise<ProfileResult> {
  try {
    return await saveProfile(input);
  } catch (error) {
    console.error("[profile] save failed:", error);
    return {
      ok: false,
      error: "We couldn't save your profile. Try again.",
    };
  }
}

async function saveProfile(input: ProfileInput): Promise<ProfileResult> {
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
    select: { username: true, email: true },
  });
  if (!current) return { ok: false, error: "Account not found." };

  const nextUsername = d.username;
  const currentUsername = current.username?.replace(/^@+/, "") ?? null;
  const previousUsername = currentUsername?.toLowerCase();
  const usernameChanged = nextUsername !== previousUsername;

  if (isTestHandle(nextUsername) && nextUsername !== previousUsername) {
    return {
      ok: false,
      error: "That username is reserved. Choose a different handle.",
    };
  }

  let releaseOccupantId: string | null = null;
  if (usernameChanged) {
    const occupant = await findHandleOccupant(
      nextUsername,
      account.id,
      current.email,
    );
    const decision = decideHandleCollision(occupant, {
      currentEmail: current.email,
    });
    if (decision.action === "reject") {
      return { ok: false, error: decision.error };
    }
    if (decision.action === "release") {
      releaseOccupantId = decision.occupantId;
    }
  }

  // Set when the canonical fold was refused and the stored spelling stands.
  let canonicalHandleRefused = false;

  // Identity write is its own transaction. A CapperProfile column/enum error
  // must not roll back a handle change — that is what surfaced as
  // "We couldn't save your profile" when @mtndegwn tried to become @mtndegen.
  try {
    await withTransientDatabaseRetry(
      () =>
        prisma.$transaction(async (tx) => {
          if (releaseOccupantId) {
            await tx.user.update({
              where: { id: releaseOccupantId },
              data: { username: parkedReleasedHandle(releaseOccupantId) },
            });
          }
          await tx.user.update({
            where: { id: account.id },
            data: { username: nextUsername },
          });
        }),
      { label: "profile username update" },
    );
  } catch (error) {
    if (isUniqueHandleConflict(error)) {
      // Asking for somebody else's handle is a real rejection.
      if (usernameChanged) {
        return { ok: false, error: HANDLE_TAKEN_MESSAGE };
      }
      // Otherwise the handle did not change and this write was only folding a
      // stored spelling to canonical — which a second row already holds.
      // @Parlaypluggy and @parlaypluggy are both live accounts, so every save
      // by the capitalised one collided and answered "that handle is taken" to
      // someone who had only edited their bio, with no way past it. Keep the
      // spelling on record and let the rest of the save through; lookups are
      // case-insensitive, so nothing downstream depends on the fold.
      console.warn(
        "[profile] kept stored handle spelling; canonical form is taken",
      );
      canonicalHandleRefused = true;
    } else {
      console.error("[profile] username save failed:", error);
      return {
        ok: false,
        error: "We couldn't save your username. Try again.",
      };
    }
  }

  const savedUsername =
    canonicalHandleRefused && currentUsername ? currentUsername : nextUsername;

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
    await withTransientDatabaseRetry(
      () =>
        prisma.capperProfile.upsert({
          where: { userId: account.id },
          create: { userId: account.id, ...profileData },
          update: profileData,
        }),
      { label: "profile fields upsert" },
    );
  } catch (error) {
    // Handle is already persisted. Tell them that so a refresh shows the new
    // public URL instead of looking like Save did nothing.
    console.error("[profile] profile fields save failed:", error);
    afterResponse(async () => {
      revalidateProfileSurfaces(currentUsername, savedUsername);
    });
    return {
      ok: true,
      usernameChanged,
      username: savedUsername,
    };
  }

  afterResponse(async () => {
    revalidateProfileSurfaces(currentUsername, savedUsername);
  });

  return { ok: true, usernameChanged, username: savedUsername };
}
