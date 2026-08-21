import convert from "heic-convert";
import sharp from "sharp";

import { isHeicBuffer } from "@/lib/profile-media-format";
import type { ProfileMediaKind } from "@/lib/schemas/profile-media.schema";

/** Decode any accepted upload into a WebP buffer for Supabase Storage. */
export async function optimizeProfileMediaImage(
  input: Buffer,
  kind: ProfileMediaKind,
): Promise<Buffer> {
  let decoded = input;

  try {
    return await renderProfileMediaWebp(decoded, kind);
  } catch (error) {
    if (!isHeicBuffer(input)) throw error;

    const jpeg = await convert({
      buffer: input,
      format: "JPEG",
      quality: 0.88,
    });
    decoded = Buffer.from(jpeg);
    return renderProfileMediaWebp(decoded, kind);
  }
}

async function renderProfileMediaWebp(
  input: Buffer,
  kind: ProfileMediaKind,
): Promise<Buffer> {
  const image = sharp(input, { limitInputPixels: 40_000_000 }).rotate();
  return kind === "avatar"
    ? image
        .resize(512, 512, { fit: "cover", position: "attention" })
        .webp({ quality: 84 })
        .toBuffer()
    : image
        .resize(1600, 600, { fit: "cover", position: "attention" })
        .webp({ quality: 82 })
        .toBuffer();
}
