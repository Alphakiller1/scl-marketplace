import type { OddsEvent } from "@/lib/odds-board";

export type OddsEventIdentity = {
  version: 1;
  sport: string;
  eventId: string;
  home: string;
  away: string;
  commenceTime: string;
  savedAt: number;
};

export function oddsEventIdentityKey(sport: string, eventId: string): string {
  return `event-identity:v1:${sport.toUpperCase()}:${eventId}`;
}

export function oddsEventIdentityFromBoard(
  event: Pick<OddsEvent, "id" | "sport" | "home" | "away" | "commenceTime">,
  savedAt = Date.now(),
): OddsEventIdentity {
  return {
    version: 1,
    sport: event.sport.toUpperCase(),
    eventId: event.id,
    home: event.home,
    away: event.away,
    commenceTime: event.commenceTime,
    savedAt,
  };
}

export function parseOddsEventIdentity(
  value: unknown,
  sport: string,
  eventId: string,
): OddsEventIdentity | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    row.version !== 1 ||
    row.sport !== sport.toUpperCase() ||
    row.eventId !== eventId ||
    typeof row.home !== "string" ||
    !row.home.trim() ||
    typeof row.away !== "string" ||
    !row.away.trim() ||
    typeof row.commenceTime !== "string" ||
    !Number.isFinite(Date.parse(row.commenceTime)) ||
    typeof row.savedAt !== "number" ||
    !Number.isFinite(row.savedAt)
  ) {
    return null;
  }
  return row as OddsEventIdentity;
}

function capturedIdentity(
  sport: string,
  eventId: string,
  away: string,
  home: string,
  commenceTime: string,
): OddsEventIdentity {
  return {
    version: 1,
    sport,
    eventId,
    away,
    home,
    commenceTime,
    savedAt: Date.parse("2026-08-10T23:26:15.732Z"),
  };
}

/**
 * Immutable identities from SCL's retained Aug. 10 live-board verification.
 *
 * These provider hashes predate server-owned Play.homeTeam/awayTeam and the
 * durable identity archive below. Keeping the complete captured slate lets the
 * grader repair every row from that legacy window without matching by clock or
 * guessing between simultaneous games. New slates are archived automatically.
 */
const LEGACY_EVENT_IDENTITIES = new Map<string, OddsEventIdentity>(
  [
    capturedIdentity(
      "MLB",
      "2acdb349dc48b0b151d3ecf05b134e88",
      "Cleveland Guardians",
      "Detroit Tigers",
      "2026-08-11T22:41:00Z",
    ),
    capturedIdentity(
      "MLB",
      "f0a09a749d56c0e6a61574359233e36a",
      "Pittsburgh Pirates",
      "Miami Marlins",
      "2026-08-11T22:41:00Z",
    ),
    capturedIdentity(
      "MLB",
      "9032dbaaa6088fc03938418d3939db3c",
      "Chicago Cubs",
      "Washington Nationals",
      "2026-08-11T22:46:00Z",
    ),
    capturedIdentity(
      "MLB",
      "ecc0c12601956f4d4217883a9c7ca7ca",
      "Seattle Mariners",
      "New York Yankees",
      "2026-08-11T23:06:00Z",
    ),
    capturedIdentity(
      "MLB",
      "9c82c4f0b33ba5e7ab520128ca969014",
      "Boston Red Sox",
      "Toronto Blue Jays",
      "2026-08-11T23:08:00Z",
    ),
    capturedIdentity(
      "MLB",
      "6da2466049f8fac0d952ce018080b949",
      "New York Mets",
      "Atlanta Braves",
      "2026-08-11T23:16:00Z",
    ),
    capturedIdentity(
      "MLB",
      "08024ab4d6a4704a87dcd8fa1253890c",
      "Baltimore Orioles",
      "Minnesota Twins",
      "2026-08-11T23:41:00Z",
    ),
    capturedIdentity(
      "MLB",
      "bd7e76db673b0ad81d62b744ba2d18d1",
      "Cincinnati Reds",
      "Chicago White Sox",
      "2026-08-11T23:41:00Z",
    ),
    capturedIdentity(
      "MLB",
      "fc1d0b97ed35a31e5f1f60df77f6b377",
      "Philadelphia Phillies",
      "St. Louis Cardinals",
      "2026-08-11T23:46:00Z",
    ),
    capturedIdentity(
      "MLB",
      "bbf1e6cb506f7bad49e73490f15d2a14",
      "Texas Rangers",
      "Los Angeles Angels",
      "2026-08-12T01:39:00Z",
    ),
    capturedIdentity(
      "MLB",
      "ec7b83371ca62b477633373d340e589b",
      "Colorado Rockies",
      "Arizona Diamondbacks",
      "2026-08-12T01:41:00Z",
    ),
    capturedIdentity(
      "MLB",
      "a8daa29e08e678a1372a40bf9b3e2279",
      "Tampa Bay Rays",
      "Athletics",
      "2026-08-12T01:41:00Z",
    ),
    capturedIdentity(
      "MLB",
      "76aa8ee5b6dc041221d46b2517b118e4",
      "Milwaukee Brewers",
      "San Diego Padres",
      "2026-08-12T01:41:00Z",
    ),
    capturedIdentity(
      "MLB",
      "d428d967c67e52c95494a607b868366d",
      "Houston Astros",
      "San Francisco Giants",
      "2026-08-12T01:46:00Z",
    ),
    capturedIdentity(
      "MLB",
      "2e165d36c5dd97967e8e9d1e53290d71",
      "Kansas City Royals",
      "Los Angeles Dodgers",
      "2026-08-12T02:11:00Z",
    ),
    capturedIdentity(
      "WNBA",
      "92e369aa70824ac85f725db03a3a2be0",
      "Toronto Tempo",
      "Atlanta Dream",
      "2026-08-11T00:00:00Z",
    ),
    capturedIdentity(
      "WNBA",
      "381926a79915a74b2c089625ca320d82",
      "Chicago Sky",
      "Seattle Storm",
      "2026-08-11T02:00:00Z",
    ),
    capturedIdentity(
      "WNBA",
      "7f6be8b73fe0d176884f6aee616e3006",
      "New York Liberty",
      "Indiana Fever",
      "2026-08-11T23:30:00Z",
    ),
    capturedIdentity(
      "WNBA",
      "d2ac2c666293e102417b78a5093d2aec",
      "Washington Mystics",
      "Las Vegas Aces",
      "2026-08-12T02:00:00Z",
    ),
    capturedIdentity(
      "WNBA",
      "38b0b03d1b7fb6593df20834189cb081",
      "Phoenix Mercury",
      "Los Angeles Sparks",
      "2026-08-12T02:00:00Z",
    ),
  ].map((identity) => [
    oddsEventIdentityKey(identity.sport, identity.eventId),
    identity,
  ]),
);

export function legacyOddsEventIdentity(
  sport: string,
  eventId: string,
): OddsEventIdentity | null {
  return (
    LEGACY_EVENT_IDENTITIES.get(oddsEventIdentityKey(sport, eventId)) ?? null
  );
}
