import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";

import { SCL_PUBLIC_DOMAIN } from "@/lib/brand";
import { cachedQuery } from "@/lib/cached-query";
import type { HonorAward } from "@/lib/honors";
import {
  HONOR_GRAPHIC_WIDTHS,
  HONOR_OG_SIZE,
  HONOR_OG_VERSION,
  HonorOgCard,
} from "@/lib/og/honor-og-card";

let assets: Promise<{ barlow: Buffer; inter: Buffer; plate: string }> | null =
  null;
function loadAssets() {
  assets ??= Promise.all([
    readFile(
      join(process.cwd(), "data/og/fonts/barlow-condensed-latin-700.ttf"),
    ),
    readFile(join(process.cwd(), "data/og/fonts/inter-latin-500.ttf")),
    readFile(join(process.cwd(), "data/og/honor-neon-plate.jpg")),
  ])
    .then(([barlow, inter, plate]) => ({
      barlow,
      inter,
      plate: `data:image/jpeg;base64,${plate.toString("base64")}`,
    }))
    .catch((error: unknown) => {
      assets = null;
      throw error;
    });
  return assets;
}

// JSON-safe binary data survives Next's persistent cache and worker restarts.
// A lossless source is small enough for that cache and keeps all original pixels.
const cachedSource = cachedQuery(
  async (award: HonorAward) => {
    const { barlow, inter, plate } = await loadAssets();
    const image = new ImageResponse(
      <HonorOgCard award={award} host={SCL_PUBLIC_DOMAIN} plate={plate} />,
      {
        ...HONOR_OG_SIZE,
        emoji: "twemoji",
        fonts: [
          {
            name: "Barlow Condensed",
            data: new Uint8Array(barlow).buffer,
            style: "normal",
            weight: 700,
          },
          {
            name: "Inter",
            data: new Uint8Array(inter).buffer,
            style: "normal",
            weight: 500,
          },
        ],
      },
    );
    const png = Buffer.from(await image.arrayBuffer());
    return (
      await sharp(png).webp({ lossless: true, effort: 2 }).toBuffer()
    ).toString("base64");
  },
  ["honor-image-source-v1", HONOR_OG_VERSION],
  { revalidate: 86_400, tags: ["honors"] },
);

// Widths requested together by responsive cards share one expensive full render.
// Entries are removed on success and failure; completed bytes live in the data cache.
const inFlight = new Map<string, Promise<string>>();
function sourceFor(award: HonorAward) {
  const key = JSON.stringify(award);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const pending = cachedSource(award).finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
}

// Keep the three small display copies together. A new device width then reads
// this small bundle, rather than downloading the much larger lossless source.
const cachedDisplay = cachedQuery(
  async (award: HonorAward) => {
    const source = Buffer.from(await sourceFor(award), "base64");
    const copies = await Promise.all(
      HONOR_GRAPHIC_WIDTHS.map(async (width) => {
        const output = await sharp(source)
          .resize({ width, kernel: "lanczos3" })
          .webp({ quality: 88, smartSubsample: true })
          .toBuffer();
        return [width, output.toString("base64")] as const;
      }),
    );
    return Object.fromEntries(copies);
  },
  ["honor-image-display-bundle-v1", HONOR_OG_VERSION],
  { revalidate: 86_400, tags: ["honors"] },
);

const cachedDownload = cachedQuery(
  async (award: HonorAward) => {
    const source = Buffer.from(await sourceFor(award), "base64");
    return (
      await sharp(source)
        .png({ palette: true, quality: 100, dither: 1, effort: 8 })
        .toBuffer()
    ).toString("base64");
  },
  ["honor-image-download-v1", HONOR_OG_VERSION],
  { revalidate: 86_400, tags: ["honors"] },
);

const pendingDisplay = new Map<string, ReturnType<typeof cachedDisplay>>();

/** Responsive WebP or downloadable PNG, cached by the full award content. */
export async function getHonorImage(award: HonorAward, width: number | null) {
  if (width == null)
    return { data: await cachedDownload(award), contentType: "image/png" };
  if (!(HONOR_GRAPHIC_WIDTHS as readonly number[]).includes(width)) {
    throw new RangeError("Unsupported honor image width");
  }
  const key = JSON.stringify(award);
  let pending = pendingDisplay.get(key);
  if (!pending) {
    pending = cachedDisplay(award).finally(() => pendingDisplay.delete(key));
    pendingDisplay.set(key, pending);
  }
  return { data: (await pending)[width], contentType: "image/webp" };
}
