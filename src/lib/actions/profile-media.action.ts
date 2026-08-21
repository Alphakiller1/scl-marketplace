"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { afterResponse } from "@/lib/after-response";
import { prisma } from "@/lib/prisma";
import { emailVerificationEnforced } from "@/lib/email-verification-policy";
import { getCurrentAccount } from "@/lib/session";
import {
  profileMediaSchema,
  type ProfileMediaKind,
} from "@/lib/schemas/profile-media.schema";
import {
  ensureProfileMediaBucket,
  getProfileMediaStorage,
  profileMediaPublicUrl,
  uploadProfileMediaObject,
} from "@/lib/supabase-storage";
import { optimizeProfileMediaImage } from "@/lib/profile-media-process";

type ProfileMediaResult =
  | { ok: true; kind: ProfileMediaKind; url: string }
  | { ok: false; error: string };

export async function uploadProfileMediaAction(
  formData: FormData,
): Promise<ProfileMediaResult> {
  try {
    return await saveProfileMedia(formData);
  } catch (error) {
    console.error("[profile-media] upload failed:", error);
    return {
      ok: false,
      error: "We couldn't upload that image. Try a JPG, PNG, or HEIC.",
    };
  }
}

async function saveProfileMedia(
  formData: FormData,
): Promise<ProfileMediaResult> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: "You must be logged in." };
  if (account.accountStatus !== "ACTIVE") {
    return {
      ok: false,
      error: "Your account must be active before uploading profile media.",
    };
  }
  if (emailVerificationEnforced() && !account.emailVerified) {
    return {
      ok: false,
      error: "Verify your email before uploading profile media.",
    };
  }
  if (!account.legalAcceptance) {
    return { ok: false, error: "Accept the current terms to continue." };
  }

  const parsed = profileMediaSchema.safeParse({
    kind: formData.get("kind"),
    file: formData.get("file"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Choose a valid image.",
    };
  }

  const storage = getProfileMediaStorage();
  if (!storage) {
    return {
      ok: false,
      error: "Profile media uploads are not configured yet.",
    };
  }

  const bucketReady = await ensureProfileMediaBucket(storage);
  if (!bucketReady.ok) return bucketReady;

  const { file, kind } = parsed.data;
  let optimizedImage: Buffer;
  try {
    optimizedImage = await optimizeProfileMediaImage(
      Buffer.from(await file.arrayBuffer()),
      kind,
    );
  } catch (error) {
    console.error("[profile-media] image processing failed:", error);
    return {
      ok: false,
      error:
        "That photo couldn't be processed. Try exporting it as JPG from Photos, or pick a different image.",
    };
  }

  const path = `${account.id}/${kind}.webp`;
  const uploadResult = await uploadProfileMediaObject(
    storage,
    path,
    optimizedImage,
    "image/webp",
  );
  if (!uploadResult.ok) return uploadResult;

  const versionedPublicUrl = `${profileMediaPublicUrl(storage, path)}?v=${Date.now()}`;

  let profile: { user: { username: string | null } };
  try {
    profile = await prisma.capperProfile.upsert({
      where: { userId: account.id },
      create: {
        userId: account.id,
        ...(kind === "avatar"
          ? { avatarUrl: versionedPublicUrl }
          : { bannerUrl: versionedPublicUrl }),
      },
      update:
        kind === "avatar"
          ? { avatarUrl: versionedPublicUrl }
          : { bannerUrl: versionedPublicUrl },
      select: { user: { select: { username: true } } },
    });
  } catch (error) {
    console.error("[profile-media] profile update failed:", error);
    return {
      ok: false,
      error: "We couldn't save that image to your profile. Try again.",
    };
  }

  afterResponse(async () => {
    revalidatePath("/dashboard/profile");
    revalidatePath("/cappers");
    revalidatePath("/leaderboard");
    revalidatePath("/discover");
    revalidateTag("leaderboard", { expire: 0 });
    revalidatePath("/cappers/[handle]", "page");
    if (profile.user.username) {
      revalidatePath(`/cappers/${profile.user.username}`);
    }
  });

  return { ok: true, kind, url: versionedPublicUrl };
}
