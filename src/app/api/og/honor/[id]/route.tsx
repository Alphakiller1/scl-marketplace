import { ImageResponse } from "next/og";
import sharp from "sharp";

import { SCL_PUBLIC_DOMAIN } from "@/lib/brand";
import {
  HONOR_GRAPHIC_WIDTHS,
  HONOR_OG_SIZE,
  HonorOgCard,
} from "@/lib/og/honor-og-card";
import { getHonorAwardById } from "@/lib/queries/honors";

const FONT_BARLOW =
  "https://cdn.jsdelivr.net/fontsource/fonts/barlow-condensed@5.2.5/latin-700-normal.ttf";
const FONT_INTER =
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@5.2.5/latin-500-normal.ttf";

// Awards for completed periods never change, so the image can cache long.
const CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";

async function font(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Honor OG font fetch failed: ${res.status}`);
  return res.arrayBuffer();
}

type RouteParams = { params: Promise<{ id: string }> };

/**
 * A smaller copy of the graphic for on-site display, or null for the full
 * PNG. Only the listed widths are served, so the cache holds a fixed set.
 *
 * The site shows these instead of routing the PNG through next/image: Vercel's
 * optimizer mis-routes a dynamic-route source like this one (the request lands
 * on `/_next/image?nxtPid=<id>` and fails), which left cards blank. Satori
 * cannot scale the card either — a transformed root renders clipped — so the
 * full render is resized here.
 */
function displayWidth(params: URLSearchParams): number | null {
  const w = Number(params.get("w"));
  return (HONOR_GRAPHIC_WIDTHS as readonly number[]).includes(w) ? w : null;
}

/** 1080×1350 (4:5) share graphic for one SCL Honors award. */
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const [award, barlow, inter] = await Promise.all([
    getHonorAwardById(decodeURIComponent(id)),
    font(FONT_BARLOW),
    font(FONT_INTER),
  ]);
  if (!award) return new Response("Award not found", { status: 404 });

  const search = new URL(req.url).searchParams;
  const download = search.has("download");
  const image = new ImageResponse(
    <HonorOgCard award={award} host={SCL_PUBLIC_DOMAIN} />,
    {
      ...HONOR_OG_SIZE,
      emoji: "twemoji",
      fonts: [
        {
          name: "Barlow Condensed",
          data: barlow,
          style: "normal",
          weight: 700,
        },
        { name: "Inter", data: inter, style: "normal", weight: 500 },
      ],
      headers: {
        "Cache-Control": CACHE,
        ...(download
          ? {
              "Content-Disposition": `attachment; filename="scl-honors-${award.id}.png"`,
            }
          : {}),
      },
    },
  );

  const width = download ? null : displayWidth(search);
  if (width == null) return image;
  const png = Buffer.from(await image.arrayBuffer());
  const webp = await sharp(png)
    .resize({ width, kernel: "lanczos3" })
    .webp({ quality: 88, smartSubsample: true })
    .toBuffer();
  return new Response(new Uint8Array(webp), {
    headers: { "Content-Type": "image/webp", "Cache-Control": CACHE },
  });
}
