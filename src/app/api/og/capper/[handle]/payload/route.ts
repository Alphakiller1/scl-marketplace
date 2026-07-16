import { getCapperOgPayload } from "@/lib/og/load-capper-og";

const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

type RouteParams = { params: Promise<{ handle: string }> };

/** JSON payload for the Edge OG card (Prisma stays on Node). */
export async function GET(_req: Request, { params }: RouteParams) {
  const { handle } = await params;
  const data = await getCapperOgPayload(handle);
  if (!data) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": CACHE },
    });
  }
  return Response.json(data, {
    headers: {
      "Cache-Control": CACHE,
      "Content-Type": "application/json",
    },
  });
}
