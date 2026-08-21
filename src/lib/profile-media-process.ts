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
  const positions = ["attention", "centre"] as const;
  let lastError: unknown;
  for (const position of positions) {
    try {
      const image = sharp(input, { limitInputPixels: 40_000_000 }).rotate();
      return kind === "avatar"
        ? await image
            .resize(512, 512, { fit: "cover", position })
            .webp({ quality: 84 })
            .toBuffer()
        : await image
            .resize(1600, 600, { fit: "cover", position })
            .webp({ quality: 82 })
            .toBuffer();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Image processing failed.");
}
