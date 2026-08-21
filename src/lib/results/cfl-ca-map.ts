import type { SettledGame } from "@/lib/results/settled-game";

/** CFL.ca heading abbreviations → Odds API / board club names. */
const CFL_ABBR: Record<string, string> = {
  BC: "BC Lions",
  "B.C.": "BC Lions",
  CGY: "Calgary Stampeders",
  EDM: "Edmonton Elks",
  HAM: "Hamilton Tiger-Cats",
  MTL: "Montreal Alouettes",
  OTT: "Ottawa Redblacks",
  SSK: "Saskatchewan Roughriders",
  TOR: "Toronto Argonauts",
  WPG: "Winnipeg Blue Bombers",
};

function firstMatch(block: string, pattern: RegExp): string | null {
  const match = block.match(pattern);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

function clubName(
  abbr: string | null,
  city: string | null,
  nick: string | null,
): string | null {
  if (abbr && CFL_ABBR[abbr.toUpperCase()])
    return CFL_ABBR[abbr.toUpperCase()]!;
  if (city && nick) {
    const cityName = city.replace(/\s+/g, " ").trim();
    const nickName = nick.replace(/\s+/g, " ").trim();
    if (!cityName || !nickName) return null;
    const titled = (s: string) =>
      s
        .toLowerCase()
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    return `${titled(cityName)} ${titled(nickName)}`;
  }
  return null;
}

/**
 * Map CFL.ca's season schedule HTML into settled games.
 *
 * ESPN's CFL calendar is frozen on the 2022 Grey Cup, so dated scoreboard
 * fetches return nothing. The league schedule page is the free finals feed.
 */
export function mapCflScheduleHtml(html: string): SettledGame[] {
  const out: SettledGame[] = [];
  const blocks = html.split(/id="div-game-id-/i);
  for (const raw of blocks.slice(1)) {
    const idMatch = raw.match(/^(\d+)/);
    if (!idMatch) continue;
    const gameId = idMatch[1]!;
    const status = firstMatch(
      raw,
      /<span class="status">\s*([^<]+?)\s*<\/span>/i,
    );
    if (!status || !/^final$/i.test(status)) continue;

    const awayScoreRaw = firstMatch(
      raw,
      /<span class="visitor-score">\s*(\d+)\s*<\/span>/i,
    );
    const homeScoreRaw = firstMatch(
      raw,
      /<span class="host-score">\s*(\d+)\s*<\/span>/i,
    );
    const awayScore = awayScoreRaw == null ? NaN : Number(awayScoreRaw);
    const homeScore = homeScoreRaw == null ? NaN : Number(homeScoreRaw);
    if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) continue;

    const awayAbbr = firstMatch(
      raw,
      /<span class="visitor">[\s\S]*?<span class="text">\s*([A-Z.]{2,4})\s*<\/span>/i,
    );
    const homeAbbr = firstMatch(
      raw,
      /<span class="host">[\s\S]*?<span class="text">\s*([A-Z.]{2,4})\s*<\/span>/i,
    );
    const awayCity = firstMatch(
      raw,
      /js-data-team_2_location">\s*([^<]+?)\s*</i,
    );
    const awayNick = firstMatch(
      raw,
      /js-data-team_2_nickname">\s*([^<]+?)\s*</i,
    );
    const homeCity = firstMatch(
      raw,
      /js-data-team_1_location">\s*([^<]+?)\s*</i,
    );
    const homeNick = firstMatch(
      raw,
      /js-data-team_1_nickname">\s*([^<]+?)\s*</i,
    );

    const away = clubName(awayAbbr, awayCity, awayNick);
    const home = clubName(homeAbbr, homeCity, homeNick);
    if (!away || !home) continue;

    const unix = firstMatch(raw, /int_timestamp\s*=\s*Number\((\d+)\)/i);
    const startsAt = unix ? new Date(Number(unix) * 1000) : undefined;

    out.push({
      sport: "CFL",
      home,
      away,
      homeScore,
      awayScore,
      completed: true,
      eventId: `cflca:${gameId}`,
      startsAt:
        startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : undefined,
    });
  }
  return out;
}
