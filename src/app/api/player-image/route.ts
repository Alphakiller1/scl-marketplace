import { NextRequest, NextResponse } from "next/server";

import {
  espnHeadshotUrl,
  resolvePlayerHeadshot,
  type HeadshotLeague,
} from "@/lib/player-headshots";

export const runtime = "nodejs";

const LEAGUES: HeadshotLeague[] = ["mlb", "wnba"];
const ESPN_SEARCH = "https://site.web.api.espn.com/apis/search/v2";

// Resolved headshots are effectively immutable; a miss is cached far shorter so
// a newly-called-up player starts working without a deploy.
const HIT_CACHE = "public, s-maxage=604800, stale-while-revalidate=2592000";
const MISS_CACHE = "public, s-maxage=3600";

type SearchPlayer = {
  type?: string;
  displayName?: string;
  description?: string;
  image?: { default?: string };
};

/**
 * Resolve any player name to a real ESPN headshot.
 *
 * A hardcoded roster can't cover a live odds board (and two of the ids we hand-
 * picked were simply wrong), so this looks the athlete up in ESPN's public
 * search and returns their headshot. `league` disambiguates namesakes across
 * sports — "Gunnar Henderson" is both an MLB and an NCAAF athlete.
 *
 * Responds with a redirect to the image so the browser and the CDN cache it and
 * we never proxy image bytes. 404 when unknown; the caller falls back to
 * initials rather than rendering a broken image.
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  const leagueParam = req.nextUrl.searchParams
    .get("league")
    ?.trim()
    .toLowerCase();
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const league = LEAGUES.includes(leagueParam as HeadshotLeague)
    ? (leagueParam as HeadshotLeague)
    : undefined;

  // Curated stars resolve with no network hop.
  const curated = resolvePlayerHeadshot(name, league);
  if (curated) {
    return NextResponse.redirect(
      espnHeadshotUrl(curated.league, curated.espnId),
      { status: 307, headers: { "Cache-Control": HIT_CACHE } },
    );
  }

  try {
    const url = `${ESPN_SEARCH}?query=${encodeURIComponent(name)}&limit=8`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`espn search ${res.status}`);
    const data = (await res.json()) as {
      results?: { type?: string; contents?: SearchPlayer[] }[];
    };

    const players =
      data.results?.find((r) => r.type === "player")?.contents ?? [];
    const wanted = league?.toUpperCase();
    const match =
      players.find(
        (p) =>
          p.image?.default &&
          (!wanted || p.description?.toUpperCase() === wanted),
      ) ?? (wanted ? undefined : players.find((p) => p.image?.default));

    if (!match?.image?.default) {
      return NextResponse.json(
        { error: "not found" },
        { status: 404, headers: { "Cache-Control": MISS_CACHE } },
      );
    }
    return NextResponse.redirect(match.image.default, {
      status: 307,
      headers: { "Cache-Control": HIT_CACHE },
    });
  } catch {
    // Upstream hiccup must never break a pick row.
    return NextResponse.json(
      { error: "unavailable" },
      { status: 404, headers: { "Cache-Control": "public, s-maxage=60" } },
    );
  }
}
