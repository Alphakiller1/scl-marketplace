"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import { getCurrentAccount } from "@/lib/session";
import {
  profileMediaSchema,
  type ProfileMediaKind,
} from "@/lib/schemas/profile-media.schema";
import {
  ensureProfileMediaBucket,
  getProfileMediaStorage,
} from "@/lib/supabase-storage";

type ProfileMediaResult =
  | { ok: true; kind: ProfileMediaKind; url: string }
  | { ok: false; error: string };

export async function uploadProfileMediaAction(
  formData: FormData,
): Promise<ProfileMediaResult> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: "You must be logged in." };
  if (account.accountStatus !== "ACTIVE" || !account.emailVerified) {
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
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 40_000_000,
    }).rotate();
    optimizedImage =
      kind === "avatar"
        ? await image
            .resize(512, 512, { fit: "cover", position: "attention" })
            .webp({ quality: 84 })
            .toBuffer()
        : await image
            .resize(1600, 600, { fit: "cover", position: "attention" })
            .webp({ quality: 82 })
            .toBuffer();
  } catch (error) {
    console.error("[profile-media] image processing failed:", error);
    return { ok: false, error: "That file is not a valid image." };
  }

  const path = `${account.id}/${kind}.webp`;
  const { error: uploadError } = await storage.client.storage
    .from(storage.bucket)
    .upload(path, optimizedImage, {
      cacheControl: "3600",
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadError) {
    console.error("[profile-media] upload failed:", uploadError);
    return { ok: false, error: "We couldn't upload that image." };
  }

  const {
    data: { publicUrl },
  } = storage.client.storage.from(storage.bucket).getPublicUrl(path);
  const versionedPublicUrl = `${publicUrl}?v=${Date.now()}`;

  const profile = await prisma.capperProfile.update({
    where: { userId: account.id },
    data:
      kind === "avatar"
        ? { avatarUrl: versionedPublicUrl }
        : { bannerUrl: versionedPublicUrl },
    select: { user: { select: { username: true } } },
  });

  revalidatePath("/dashboard/profile");
  revalidatePath("/cappers");
  revalidatePath("/leaderboard");
  if (profile.user.username) {
    revalidatePath(`/cappers/${profile.user.username}`);
  }

  return { ok: true, kind, url: versionedPublicUrl };
}
