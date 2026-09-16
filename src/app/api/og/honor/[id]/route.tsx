import { ImageResponse } from "next/og";

import { appUrl } from "@/lib/app-url";
import { HONOR_OG_SIZE, HonorOgCard } from "@/lib/og/honor-og-card";
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

/** 1080×1350 (4:5) share graphic for one SCL Honors award. */
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const [award, barlow, inter] = await Promise.all([
    getHonorAwardById(decodeURIComponent(id)),
    font(FONT_BARLOW),
    font(FONT_INTER),
  ]);
  if (!award) return new Response("Award not found", { status: 404 });

  const download = new URL(req.url).searchParams.has("download");
  return new ImageResponse(
    <HonorOgCard award={award} host={new URL(appUrl()).host} />,
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
}
