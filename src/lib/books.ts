/**
 * Curated sportsbooks for CapperProfile.books — keys match The Odds API
 * `bookmakers` query param (US / US2 regions).
 * @see https://the-odds-api.com/sports-odds-data/bookmaker-apis.html
 */

export const SUPPORTED_BOOKS = [
  { key: "draftkings", label: "DraftKings", short: "DK" },
  { key: "fanduel", label: "FanDuel", short: "FD" },
  { key: "betmgm", label: "BetMGM", short: "MGM" },
  { key: "williamhill_us", label: "Caesars", short: "CZR" },
  { key: "fanatics", label: "Fanatics", short: "FAN" },
  { key: "espnbet", label: "ESPN BET", short: "ESPN" },
  { key: "hardrockbet", label: "Hard Rock Bet", short: "HRB" },
  { key: "betrivers", label: "BetRivers", short: "BRV" },
  { key: "bovada", label: "Bovada", short: "BOV" },
  { key: "betonlineag", label: "BetOnline", short: "BOL" },
] as const;

export type BookKey = (typeof SUPPORTED_BOOKS)[number]["key"];

export const BOOK_KEYS = SUPPORTED_BOOKS.map((b) => b.key) as BookKey[];

const BY_KEY = new Map(SUPPORTED_BOOKS.map((b) => [b.key, b]));

export function isBookKey(value: string): value is BookKey {
  return BY_KEY.has(value as BookKey);
}

export function bookLabel(key: string): string {
  return BY_KEY.get(key as BookKey)?.label ?? key;
}

export function bookShort(key: string): string {
  return BY_KEY.get(key as BookKey)?.short ?? key;
}

/** Comma-separated Odds API `bookmakers=` value; empty → omit (use regions=us). */
export function bookmakersQueryParam(books: readonly string[]): string | null {
  const keys = books.filter(isBookKey);
  return keys.length ? keys.join(",") : null;
}

/**
 * Ticket / feed source board label (M5 §4).
 * Book set → "<BookLabel> BOARD"; null/unknown → "LIVE BOARD".
 */
export function oddsSourceBoardLabel(book?: string | null): string {
  if (book == null || book === "") return "LIVE BOARD";
  if (isBookKey(book)) return `${bookLabel(book)} BOARD`;
  return `${book} BOARD`;
}

/**
 * Capture + source line for Ticket (§4 / recipe 1d):
 * `ODDS CAPTURED <ts> ET / SOURCE: <BOOK|LIVE> BOARD · GRADES AUTOMATICALLY`
 */
export function formatOddsCaptureSourceLine(opts: {
  capturedAt?: string | null;
  book?: string | null;
  /** When false, do not promise automatic grading (cron unhealthy / delayed). */
  gradingHealthy?: boolean;
}): string {
  const source = oddsSourceBoardLabel(opts.book);
  const gradeBit =
    opts.gradingHealthy === false
      ? "GRADING DELAYED — CHECK BACK SOON"
      : "GRADES AUTOMATICALLY";
  if (!opts.capturedAt) {
    return `ODDS CAPTURED · SOURCE: ${source} · ${gradeBit}`;
  }
  const date = new Date(opts.capturedAt);
  if (Number.isNaN(date.getTime())) {
    return `ODDS CAPTURED · SOURCE: ${source} · ${gradeBit}`;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const stamp = `${get("month")}·${get("day")}·${get("year")} ${get("hour")}:${get("minute")}:${get("second")} ET`;
  return `ODDS CAPTURED ${stamp} / SOURCE: ${source} · ${gradeBit}`;
}
