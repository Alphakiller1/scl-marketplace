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

/**
 * Pick-form source books. One `regions=us` fetch already includes these;
 * Best and the book tabs read only this set so extra US books never surface.
 * Order matches the owner rail: MGM, Caesars, DraftKings, FanDuel, Fanatics.
 */
export const PICK_BOARD_BOOKS = [
  "betmgm",
  "williamhill_us",
  "draftkings",
  "fanduel",
  "fanatics",
] as const satisfies readonly BookKey[];

export type PickBoardBook = (typeof PICK_BOARD_BOOKS)[number];

const PICK_BOARD_BOOK_SET = new Set<string>(PICK_BOARD_BOOKS);

export function isPickBoardBook(value: string): value is PickBoardBook {
  return PICK_BOARD_BOOK_SET.has(value);
}

/**
 * Sports whose board may take a price from outside the five pick-form books.
 *
 * The rail exists so the board shows prices a capper can actually bet. But a
 * market NO rail book posts is dropped selection by selection
 * (`preferredThenAll` returns null and `normalizeUpcomingEvent` skips the
 * group), and for these two sports that silently guts the board:
 *
 * - TENNIS: game spreads and totals are on Bovada/BetRivers; the five usually
 *   post moneyline only.
 * - SOCCER: rail coverage varies fixture by fixture across ten competitions, so
 *   one match came back moneyline-only and the next totals-only — the same
 *   match, the same league, different books having posted. The `regions=us`
 *   response already carries the missing prices; they were fetched, billed, and
 *   then discarded for want of a rail book.
 *
 * Falling back costs nothing and loses no integrity: the price still comes from
 * a covered US book, verification bounds a claim against that same `regions=us`
 * set, and the board labels which book it came from.
 */
const RAIL_FALLBACK_SPORTS = new Set(["TENNIS", "SOCCER"]);

export function pickFormFallsBackOutsideRail(sport?: string): boolean {
  return RAIL_FALLBACK_SPORTS.has(sport?.trim().toUpperCase() ?? "");
}

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
 * Capture + source line for Ticket (§4 / recipe 1d).
 *
 * `capturedAt` remains part of the receipt/audit data, but is intentionally not
 * rendered. Users only need to see that the odds were captured, where they
 * came from, and whether the pick grades automatically.
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
  return `ODDS CAPTURED · SOURCE: ${source} · ${gradeBit}`;
}
