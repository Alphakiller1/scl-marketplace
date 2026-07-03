"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

const TEAM_SLUGS: Record<string, string> = {
  "arizona diamondbacks": "ari",
  "atlanta braves": "atl",
  "baltimore orioles": "bal",
  "boston red sox": "bos",
  "chicago cubs": "chc",
  "chicago white sox": "chw",
  "cincinnati reds": "cin",
  "cleveland guardians": "cle",
  "colorado rockies": "col",
  "detroit tigers": "det",
  "houston astros": "hou",
  "kansas city royals": "kc",
  "los angeles angels": "laa",
  "los angeles dodgers": "lad",
  "miami marlins": "mia",
  "milwaukee brewers": "mil",
  "minnesota twins": "min",
  "new york mets": "nym",
  "new york yankees": "nyy",
  athletics: "ath",
  "philadelphia phillies": "phi",
  "pittsburgh pirates": "pit",
  "san diego padres": "sd",
  "san francisco giants": "sf",
  "seattle mariners": "sea",
  "st. louis cardinals": "stl",
  "tampa bay rays": "tb",
  "texas rangers": "tex",
  "toronto blue jays": "tor",
  "washington nationals": "wsh",
  "atlanta hawks": "atl",
  "boston celtics": "bos",
  "brooklyn nets": "bkn",
  "charlotte hornets": "cha",
  "chicago bulls": "chi",
  "cleveland cavaliers": "cle",
  "dallas mavericks": "dal",
  "denver nuggets": "den",
  "detroit pistons": "det",
  "golden state warriors": "gs",
  "houston rockets": "hou",
  "indiana pacers": "ind",
  "la clippers": "lac",
  "los angeles lakers": "lal",
  "memphis grizzlies": "mem",
  "miami heat": "mia",
  "milwaukee bucks": "mil",
  "minnesota timberwolves": "min",
  "new orleans pelicans": "no",
  "new york knicks": "ny",
  "oklahoma city thunder": "okc",
  "orlando magic": "orl",
  "philadelphia 76ers": "phi",
  "phoenix suns": "phx",
  "portland trail blazers": "por",
  "sacramento kings": "sac",
  "san antonio spurs": "sa",
  "toronto raptors": "tor",
  "utah jazz": "utah",
  "washington wizards": "wsh",
  "arizona cardinals": "ari",
  "atlanta falcons": "atl",
  "baltimore ravens": "bal",
  "buffalo bills": "buf",
  "carolina panthers": "car",
  "chicago bears": "chi",
  "cincinnati bengals": "cin",
  "cleveland browns": "cle",
  "dallas cowboys": "dal",
  "denver broncos": "den",
  "detroit lions": "det",
  "green bay packers": "gb",
  "houston texans": "hou",
  "indianapolis colts": "ind",
  "jacksonville jaguars": "jax",
  "kansas city chiefs": "kc",
  "las vegas raiders": "lv",
  "los angeles chargers": "lac",
  "los angeles rams": "lar",
  "miami dolphins": "mia",
  "minnesota vikings": "min",
  "new england patriots": "ne",
  "new orleans saints": "no",
  "new york giants": "nyg",
  "new york jets": "nyj",
  "philadelphia eagles": "phi",
  "pittsburgh steelers": "pit",
  "san francisco 49ers": "sf",
  "seattle seahawks": "sea",
  "tampa bay buccaneers": "tb",
  "tennessee titans": "ten",
  "washington commanders": "wsh",
  "atlanta dream": "atl",
  "chicago sky": "chi",
  "connecticut sun": "con",
  "dallas wings": "dal",
  "golden state valkyries": "gs",
  "indiana fever": "ind",
  "las vegas aces": "lv",
  "los angeles sparks": "la",
  "minnesota lynx": "min",
  "new york liberty": "ny",
  "phoenix mercury": "phx",
  "seattle storm": "sea",
  "washington mystics": "wsh",
  "anaheim ducks": "ana",
  "boston bruins": "bos",
  "buffalo sabres": "buf",
  "calgary flames": "cgy",
  "carolina hurricanes": "car",
  "chicago blackhawks": "chi",
  "colorado avalanche": "col",
  "columbus blue jackets": "cbj",
  "dallas stars": "dal",
  "detroit red wings": "det",
  "edmonton oilers": "edm",
  "florida panthers": "fla",
  "los angeles kings": "la",
  "minnesota wild": "min",
  "montreal canadiens": "mtl",
  "nashville predators": "nsh",
  "new jersey devils": "nj",
  "new york islanders": "nyi",
  "new york rangers": "nyr",
  "ottawa senators": "ott",
  "philadelphia flyers": "phi",
  "pittsburgh penguins": "pit",
  "san jose sharks": "sj",
  "seattle kraken": "sea",
  "st. louis blues": "stl",
  "tampa bay lightning": "tb",
  "toronto maple leafs": "tor",
  "utah mammoth": "utah",
  "vancouver canucks": "van",
  "vegas golden knights": "vgk",
  "washington capitals": "wsh",
  "winnipeg jets": "wpg",
};

const SPORT_PATH: Record<string, string> = {
  MLB: "mlb",
  NBA: "nba",
  NFL: "nfl",
  NHL: "nhl",
  WNBA: "wnba",
};
const TEAM_NAMES_BY_LENGTH = Object.keys(TEAM_SLUGS).sort(
  (a, b) => b.length - a.length,
);

function fallback(team: string): string {
  return team
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function TeamMark({
  team,
  sport,
  className,
}: {
  team: string;
  sport: string;
  className?: string;
}) {
  const slug = TEAM_SLUGS[team.toLowerCase()];
  const league = SPORT_PATH[sport];
  const src =
    slug && league
      ? `https://a.espncdn.com/i/teamlogos/${league}/500/${slug}.png`
      : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;

  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={cn(
          "border-border bg-surface-3 text-muted-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-lg border text-[0.65rem] font-bold",
          className,
        )}
      >
        {fallback(team)}
      </span>
    );
  }

  return (
    // ESPN's public team-mark CDN is also used by the Chase Analytics products.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${team} logo`}
      width={40}
      height={40}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className={cn("size-8 shrink-0 object-contain", className)}
    />
  );
}

export function TeamMarkFromText({
  text,
  sport,
  className,
}: {
  text: string;
  sport: string;
  className?: string;
}) {
  const normalized = text.toLowerCase();
  const team = TEAM_NAMES_BY_LENGTH.find((name) => normalized.includes(name));
  if (!team) return null;
  return <TeamMark team={team} sport={sport} className={className} />;
}
