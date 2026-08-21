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
import { sclUsernameSchema } from "@/lib/schemas/auth.schema";
import { profileSchema, type ProfileInput } from "@/lib/schemas/profile.schema";
import { getCurrentAccount } from "@/lib/session";

type ProfileResult =
  | {
      ok: true;
      usernameChanged: boolean;
      username: string;
      previousUsername?: string;
    }
  | { ok: false; error: string };

type ProfileEditor = NonNullable<Awaited<ReturnType<typeof getCurrentAccount>>>;

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

async function loadProfileEditor(): Promise<
  { ok: true; account: ProfileEditor } | { ok: false; error: string }
> {
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
  return { ok: true, account };
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
  previousUsername: string | undefined,
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

/**
 * Bust caches before the client `router.refresh()` runs. `afterResponse` is a
 * backup so a revalidate exception cannot fail a handle that already wrote.
 */
function scheduleProfileRevalidation(
  previousUsername: string | undefined,
  nextUsername: string,
) {
  try {
    revalidateProfileSurfaces(previousUsername, nextUsername);
  } catch (error) {
    console.error("[profile] revalidate failed:", error);
  }
  afterResponse(async () => {
    revalidateProfileSurfaces(previousUsername, nextUsername);
  });
}

async function persistUsername(
  accountId: string,
  nextUsername: string,
): Promise<ProfileResult> {
  const current = await prisma.user.findUnique({
    where: { id: accountId },
    select: { username: true, email: true },
  });
  if (!current) return { ok: false, error: "Account not found." };

  const previousUsername = current.username?.replace(/^@+/, "").toLowerCase();
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
      accountId,
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

  // Identity write is its own transaction. A CapperProfile column/enum error
  // must not roll back a handle change — that is what surfaced as
  // "We couldn't save your profile" when @mtndegwn tried to become @mtndegen.
  try {
    await withTransientDatabaseRetry(
      () =>
        prisma.$transaction(async (tx) => {
          if (releaseOccupantId) {
            let parked = false;
            for (let attempt = 0; attempt < 5 && !parked; attempt += 1) {
              try {
                await tx.user.update({
                  where: { id: releaseOccupantId },
                  data: {
                    username: parkedReleasedHandle(releaseOccupantId, attempt),
                  },
                });
                parked = true;
              } catch (error) {
                if (!isUniqueHandleConflict(error) || attempt === 4) {
                  throw error;
                }
              }
            }
          }
          await tx.user.update({
            where: { id: accountId },
            data: { username: nextUsername },
          });
        }),
      { label: "profile username update" },
    );
  } catch (error) {
    if (isUniqueHandleConflict(error)) {
      return { ok: false, error: HANDLE_TAKEN_MESSAGE };
    }
    console.error("[profile] username save failed:", error);
    return {
      ok: false,
      error: "We couldn't save your username. Try again.",
    };
  }

  console.info(
    `[profile] username write user=${accountId} ${previousUsername ?? "(none)"} -> ${nextUsername} changed=${usernameChanged}`,
  );

  return {
    ok: true,
    usernameChanged,
    username: nextUsername,
    previousUsername,
  };
}

function parseUsernameInput(
  username: string,
): { ok: true; username: string } | { ok: false; error: string } {
  const parsed = sclUsernameSchema.safeParse(username);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Enter a valid username.",
    };
  }
  return { ok: true, username: parsed.data };
}

/**
 * Persist only the public @handle. The rest of the profile form must not be
 * able to block a rename — password managers and unrelated field errors were
 * swallowing username changes on Save.
 */
export async function updateUsernameAction(
  username: string,
): Promise<ProfileResult> {
  try {
    const editor = await loadProfileEditor();
    if (!editor.ok) return editor;
    const parsed = parseUsernameInput(username);
    if (!parsed.ok) return parsed;
    const result = await persistUsername(editor.account.id, parsed.username);
    if (result.ok) {
      scheduleProfileRevalidation(result.previousUsername, result.username);
    }
    return result;
  } catch (error) {
    console.error("[profile] username action failed:", error);
    return {
      ok: false,
      error: "We couldn't save your username. Try again.",
    };
  }
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
  const editor = await loadProfileEditor();
  if (!editor.ok) return editor;

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
  const usernameResult = await persistUsername(editor.account.id, d.username);
  if (!usernameResult.ok) return usernameResult;

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
          where: { userId: editor.account.id },
          create: { userId: editor.account.id, ...profileData },
          update: profileData,
        }),
      { label: "profile fields upsert" },
    );
  } catch (error) {
    // Handle is already persisted. Tell them that so a refresh shows the new
    // public URL instead of looking like Save did nothing.
    console.error("[profile] profile fields save failed:", error);
    scheduleProfileRevalidation(
      usernameResult.previousUsername,
      usernameResult.username,
    );
    return usernameResult;
  }

  scheduleProfileRevalidation(
    usernameResult.previousUsername,
    usernameResult.username,
  );

  return usernameResult;
}
