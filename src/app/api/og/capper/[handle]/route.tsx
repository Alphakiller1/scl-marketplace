import { ImageResponse } from "next/og";

import { CapperOgCard } from "@/lib/og/capper-og-card";
import { OG, type CapperOgPayload } from "@/lib/og/tokens";

/**
 * Dynamic Open Graph card for public capper profiles (Edge + next/og).
 * Stats load from the sibling `/payload` Node route (Prisma).
 */
export const runtime = "edge";

const FONT_BARLOW =
  "https://cdn.jsdelivr.net/fontsource/fonts/barlow-condensed@5.2.5/latin-700-normal.ttf";
const FONT_PLEX =
  "https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-mono@5.2.5/latin-500-normal.ttf";

const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

async function loadFonts() {
  const [barlow, plex] = await Promise.all([
    fetch(FONT_BARLOW).then((r) => {
      if (!r.ok) {
        throw new Error(`Barlow Condensed font fetch failed: ${r.status}`);
      }
      return r.arrayBuffer();
    }),
    fetch(FONT_PLEX).then((r) => {
      if (!r.ok) {
        throw new Error(`IBM Plex Mono font fetch failed: ${r.status}`);
      }
      return r.arrayBuffer();
    }),
  ]);
  return { barlow, plex };
}

async function loadPayload(
  handle: string,
  req: Request,
): Promise<CapperOgPayload | null> {
  const url = new URL(
    `/api/og/capper/${encodeURIComponent(handle)}/payload`,
    req.url,
  );
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`OG payload fetch failed: ${res.status}`);
  }
  return (await res.json()) as CapperOgPayload;
}

type RouteParams = { params: Promise<{ handle: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const { handle } = await params;
  const [data, fonts] = await Promise.all([
    loadPayload(handle, req),
    loadFonts(),
  ]);
  const fontFaces = [
    {
      name: "Barlow Condensed",
      data: fonts.barlow,
      style: "normal" as const,
      weight: 700 as const,
    },
    {
      name: "IBM Plex Mono",
      data: fonts.plex,
      style: "normal" as const,
      weight: 500 as const,
    },
  ];

  if (!data) {
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: OG.bg,
          color: OG.mutedData,
          fontFamily: "Barlow Condensed",
          fontSize: 48,
          fontWeight: 700,
        }}
      >
        Capper not found
      </div>,
      {
        width: 1200,
        height: 630,
        fonts: fontFaces,
        headers: { "Cache-Control": CACHE },
      },
    );
  }

  return new ImageResponse(<CapperOgCard data={data} />, {
    width: 1200,
    height: 630,
    fonts: fontFaces,
    headers: { "Cache-Control": CACHE },
  });
}
