import convert from "heic-convert";
import sharp from "sharp";

import { EMAIL_IMAGE_MAX_STORED_WIDTH } from "@/lib/email-image";
import { isHeicBuffer } from "@/lib/profile-media-format";

export type ProcessedEmailImage = { data: Buffer; width: number };

/**
 * Prepare an upload for delivery to an inbox.
 *
 * Two choices here differ from profile media, and both are about mail clients
 * rather than browsers:
 *
 *   - **JPEG, not WebP.** Outlook 2016-2019 and Windows Mail render a WebP as a
 *     broken image. The web app can serve WebP happily; an email cannot.
 *   - **Flattened onto white.** Not just because JPEG has no alpha: a mail client
 *     in dark mode may paint its own dark background behind a transparent PNG,
 *     which turns black logo text invisible. A white card is legible in every
 *     theme, so transparency is resolved here rather than left to the client.
 *
 * Width is capped at 2x the email's content width — sharp on a retina phone,
 * without shipping a 4000px photo to 136 inboxes. Narrow images are never
 * enlarged, and the returned width is read back off the encoded bytes so the
 * caller sizes the `<img>` from what was actually stored.
 */
export async function optimizeEmailImage(
  input: Buffer,
): Promise<ProcessedEmailImage> {
  try {
    return await encodeEmailJpeg(input);
  } catch (error) {
    // Sharp on Vercel cannot decode patent-encumbered HEIC. The browser converts
    // first, so this is the fallback for a client that could not.
    if (!isHeicBuffer(input)) throw error;

    const jpeg = await convert({ buffer: input, format: "JPEG", quality: 0.9 });
    return encodeEmailJpeg(Buffer.from(jpeg));
  }
}

async function encodeEmailJpeg(input: Buffer): Promise<ProcessedEmailImage> {
  const data = await sharp(input, { limitInputPixels: 40_000_000 })
    // Phone photos carry their orientation in EXIF; a stripped JPEG without this
    // arrives sideways.
    .rotate()
    .resize({
      width: EMAIL_IMAGE_MAX_STORED_WIDTH,
      withoutEnlargement: true,
      fit: "inside",
    })
    .flatten({ background: "#ffffff" })
    // Quality 88: slate graphics carry small text, and JPEG ringing around
    // lettering is visible well above the quality that suffices for a photo.
    .jpeg({ quality: 88, progressive: true, mozjpeg: true })
    .toBuffer();

  const { width } = await sharp(data).metadata();
  if (!width || width < 1) {
    throw new Error("processed email image has no width");
  }

  return { data, width };
}
