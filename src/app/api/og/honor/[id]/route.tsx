import { HONOR_GRAPHIC_WIDTHS } from "@/lib/og/honor-og-card";
import { getHonorImage } from "@/lib/og/honor-image";
import { getHonorAwardById } from "@/lib/queries/honors";

const CACHE =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
type RouteParams = { params: Promise<{ id: string }> };

/** Only fixed display sizes are allowed; the full PNG remains available to download. */
function displayWidth(params: URLSearchParams): number | null {
  const w = Number(params.get("w"));
  return (HONOR_GRAPHIC_WIDTHS as readonly number[]).includes(w) ? w : null;
}

export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const award = await getHonorAwardById(decodeURIComponent(id));
  if (!award) return new Response("Award not found", { status: 404 });
  const search = new URL(req.url).searchParams;
  const download = search.has("download");
  const image = await getHonorImage(
    award,
    download ? null : displayWidth(search),
  );
  return new Response(new Uint8Array(Buffer.from(image.data, "base64")), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": CACHE,
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="scl-honors-${award.id}.png"`,
          }
        : {}),
    },
  });
}
