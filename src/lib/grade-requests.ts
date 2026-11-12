/**
 * Capper grading requests — "Request Regrade" and "Request Injury Protection".
 *
 * Pure: no Prisma, no server-only. Shared by the capper form, the server
 * action, the notification email and the admin queue so every surface names a
 * request, and describes the pick it is about, the same way.
 */
import type {
  GradeRequestStatus,
  GradeRequestType,
  Outcome,
} from "@prisma/client";

import { bookLabel } from "@/lib/books";
import { formatOdds, formatUnits } from "@/lib/format";
import { matchupLabel } from "@/lib/pick-identity";

export const GRADE_REQUEST_TYPES = ["REGRADE", "INJURY_PROTECTION"] as const;

/** URL slug ⇄ enum. The slug is what the My Picks buttons link with. */
export const GRADE_REQUEST_SLUG: Record<GradeRequestType, string> = {
  REGRADE: "regrade",
  INJURY_PROTECTION: "injury-protection",
};

export function gradeRequestTypeFromSlug(
  slug: string | null | undefined,
): GradeRequestType | null {
  if (slug === "regrade") return "REGRADE";
  if (slug === "injury-protection") return "INJURY_PROTECTION";
  return null;
}

/** The pre-populated subject line, exactly as the owners specified it. */
export const GRADE_REQUEST_SUBJECT: Record<GradeRequestType, string> = {
  REGRADE: "Regrade Request",
  INJURY_PROTECTION: "Injury Protection Request",
};

/** Button / heading label on the capper side. */
export const GRADE_REQUEST_ACTION_LABEL: Record<GradeRequestType, string> = {
  REGRADE: "Request Regrade",
  INJURY_PROTECTION: "Request Injury Protection",
};

/** Chip shown on a pick while a request of that type is waiting for SCL. */
export const GRADE_REQUEST_PENDING_LABEL: Record<GradeRequestType, string> = {
  REGRADE: "Regrade requested",
  INJURY_PROTECTION: "Injury protection requested",
};

export const GRADE_REQUEST_STATUS_LABEL: Record<GradeRequestStatus, string> = {
  OPEN: "Open",
  RESOLVED: "Resolved",
  DECLINED: "Declined",
};

/** What the commentary box asks for, per type — the evidence an admin needs. */
export const GRADE_REQUEST_COMMENTARY_PROMPT: Record<GradeRequestType, string> =
  {
    REGRADE:
      "Explain what the correct result is and why — for example the final score, the box-score stat, or a league stat correction. Include a link to the source if you have one.",
    INJURY_PROTECTION:
      "Explain which player was injured, when they left the game, and how it affected this pick. Include a link to the box score or injury report if you have one.",
  };

export const GRADE_REQUEST_COMMENTARY_MIN = 20;
export const GRADE_REQUEST_COMMENTARY_MAX = 4000;
export const GRADE_REQUEST_RESOLUTION_NOTE_MAX = 500;

/** Kinds of pick a request can be about. Matches the admin `/admin/plays/[kind]` route. */
export type GradeRequestPickKind = "straight" | "parlay";

export function isGradedOutcome(outcome: Outcome): boolean {
  return outcome !== "PENDING";
}

/**
 * Which request buttons a pick offers.
 *
 * Only graded picks get them ("next to each graded play"). Injury protection
 * asks for a void, so a pick that is already void has nothing to protect.
 */
export function availableGradeRequestTypes(
  outcome: Outcome,
): GradeRequestType[] {
  if (!isGradedOutcome(outcome)) return [];
  return outcome === "VOID" ? ["REGRADE"] : ["REGRADE", "INJURY_PROTECTION"];
}

export function myPicksRequestHref(input: {
  type: GradeRequestType;
  kind: GradeRequestPickKind;
  id: string;
}): string {
  return `/dashboard/picks/${input.kind}/${encodeURIComponent(input.id)}/request?type=${GRADE_REQUEST_SLUG[input.type]}`;
}

/** Key that ties a request to the pick row it was made from on My Picks. */
export function gradeRequestPickKey(
  kind: GradeRequestPickKind,
  id: string,
): string {
  return `${kind}:${id}`;
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  PENDING: "Pending",
  WIN: "Win",
  LOSS: "Loss",
  PUSH: "Push",
  VOID: "Void",
};

export function outcomeLabel(outcome: Outcome): string {
  return OUTCOME_LABEL[outcome];
}

/** "Loss · -1.00U", "Void · 0.00U", or "Pending" — the record as it stands. */
export function resultLabel(
  outcome: Outcome,
  profitUnits: number | null,
): string {
  if (outcome === "PENDING") return "Pending";
  if (profitUnits == null) return OUTCOME_LABEL[outcome];
  return `${OUTCOME_LABEL[outcome]} · ${formatUnits(profitUnits)}`;
}

const GAME_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const GAME_DATE_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

/** "Tue, Nov 11, 2026" in Eastern time — the slate the pick belongs to. */
export function formatRequestGameDate(value: Date | null): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  return GAME_DATE.format(value);
}

/** "Nov 11, 2026, 7:10 PM EST" — used for submitted/logged timestamps. */
export function formatRequestDateTime(value: Date | null): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  return GAME_DATE_TIME.format(value);
}

export type GradeRequestLeg = {
  id: string;
  sport: string;
  market: string;
  selection: string;
  oddsAmerican: number;
  outcome: Outcome;
  eventLabel: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  eventStartsAt: Date | null;
};

/**
 * Everything the request form, the email and the admin queue show about the
 * pick. Built on the server from the stored row — never from anything the
 * browser sends — so a capper cannot dress up the pick they are asking about.
 */
export type GradeRequestPickDetails = {
  kind: GradeRequestPickKind;
  id: string;
  /** Headline: the selection, or "3-Leg Parlay". */
  title: string;
  sport: string | null;
  league: string | null;
  market: string | null;
  matchup: string | null;
  odds: string;
  stake: string;
  book: string | null;
  outcome: Outcome;
  profitUnits: number | null;
  /** Game time (latest leg for a parlay — the day the ticket was decided). */
  eventStartsAt: Date | null;
  loggedAt: Date;
  legs: GradeRequestLeg[];
};

export function straightPickDetails(play: {
  id: string;
  sport: string;
  league: string | null;
  market: string;
  selection: string;
  oddsAmerican: number;
  units: number;
  book: string | null;
  outcome: Outcome;
  profitUnits: number | null;
  eventLabel: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  eventStartsAt: Date | null;
  createdAt: Date;
}): GradeRequestPickDetails {
  return {
    kind: "straight",
    id: play.id,
    title: play.selection,
    sport: play.sport,
    league: play.league,
    market: play.market,
    matchup: matchupLabel(play),
    odds: formatOdds(play.oddsAmerican),
    stake: formatUnits(play.units, true, false),
    // Display name ("DraftKings"), not the stored provider key ("draftkings").
    book: play.book ? bookLabel(play.book) : null,
    outcome: play.outcome,
    profitUnits: play.profitUnits,
    eventStartsAt: play.eventStartsAt,
    loggedAt: play.createdAt,
    legs: [],
  };
}

/** The ticket is decided by its last game, so that is the date it carries. */
function latestStart(legs: { eventStartsAt: Date | null }[]): Date | null {
  let latest: Date | null = null;
  for (const leg of legs) {
    if (!leg.eventStartsAt) continue;
    if (!latest || leg.eventStartsAt.getTime() > latest.getTime()) {
      latest = leg.eventStartsAt;
    }
  }
  return latest;
}

export function parlayPickDetails(parlay: {
  id: string;
  combinedOddsAmerican: number | null;
  units: number;
  outcome: Outcome;
  profitUnits: number | null;
  createdAt: Date;
  legs: GradeRequestLeg[];
}): GradeRequestPickDetails {
  const sports = [...new Set(parlay.legs.map((leg) => leg.sport))];
  return {
    kind: "parlay",
    id: parlay.id,
    title: `${parlay.legs.length}-Leg Parlay`,
    sport: sports.length === 1 ? sports[0]! : null,
    league: null,
    market: "Parlay",
    matchup: null,
    odds:
      parlay.combinedOddsAmerican == null
        ? "—"
        : formatOdds(parlay.combinedOddsAmerican),
    stake: formatUnits(parlay.units, true, false),
    book: null,
    outcome: parlay.outcome,
    profitUnits: parlay.profitUnits,
    eventStartsAt: latestStart(parlay.legs),
    loggedAt: parlay.createdAt,
    legs: parlay.legs,
  };
}

/** A leg as one line: "Over 8.5 (Mets @ Braves) +105". */
export function legLine(leg: GradeRequestLeg): string {
  const matchup = matchupLabel(leg);
  return `${leg.selection}${matchup ? ` (${matchup})` : ""} ${formatOdds(leg.oddsAmerican)}`;
}

/**
 * One frozen line stored on the request row and used in the email subject and
 * the admin queue. Names the leg when the capper picked one.
 */
export function pickSummaryLine(
  details: GradeRequestPickDetails,
  legId?: string | null,
): string {
  if (details.kind === "parlay") {
    const leg = legId
      ? details.legs.find((candidate) => candidate.id === legId)
      : null;
    const legIndex = leg ? details.legs.indexOf(leg) + 1 : 0;
    const base = `${details.title} ${details.odds} · ${details.stake}`;
    return leg ? `${base} — Leg ${legIndex}: ${legLine(leg)}` : base;
  }
  const parts = [
    details.title,
    details.market,
    details.matchup,
    `${details.odds} · ${details.stake}`,
  ].filter((part): part is string => Boolean(part));
  return parts.join(" · ");
}

/** Truncate for an email subject without cutting mid-word where avoidable. */
export function clipForSubject(value: string, max = 90): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}
