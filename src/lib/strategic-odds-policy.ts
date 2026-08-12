export type StrategicCompetition = {
  id: string;
  label: string;
  sclSport: "MLB" | "WNBA" | "NFL" | "SOCCER" | "TENNIS";
  providerKey?: string;
  catalogMatch?: RegExp;
  league?: string;
  markets: readonly string[];
  slots: readonly RefreshSlot[];
};

export type RefreshSlot =
  | { kind: "daily"; id: string }
  | { kind: "fixed-et"; id: string; hour: number; minute?: number }
  | { kind: "before-first"; id: string; leadMinutes: number };

const BASIC = ["h2h", "spreads", "totals"] as const;

/** Owner-approved leagues and cost profiles. Props remain lazy per event. */
export const STRATEGIC_ODDS_COMPETITIONS: readonly StrategicCompetition[] = [
  {
    id: "mlb",
    label: "MLB",
    sclSport: "MLB",
    providerKey: "baseball_mlb",
    markets: BASIC,
    slots: [
      { kind: "before-first", id: "pre-first", leadMinutes: 120 },
      { kind: "fixed-et", id: "2200", hour: 22 },
    ],
  },
  {
    id: "wnba",
    label: "WNBA",
    sclSport: "WNBA",
    providerKey: "basketball_wnba",
    markets: BASIC,
    slots: [
      { kind: "fixed-et", id: "0800", hour: 8 },
      { kind: "before-first", id: "pre-first", leadMinutes: 120 },
    ],
  },
  {
    id: "leagues-cup",
    label: "Leagues Cup",
    sclSport: "SOCCER",
    providerKey: "soccer_concacaf_leagues_cup",
    league: "LEAGUES_CUP",
    markets: BASIC,
    slots: [{ kind: "before-first", id: "pre-first", leadMinutes: 60 }],
  },
  {
    id: "liga-mx",
    label: "Mexico National League (Liga MX)",
    sclSport: "SOCCER",
    providerKey: "soccer_mexico_ligamx",
    league: "LIGA_MX",
    markets: BASIC,
    slots: [{ kind: "before-first", id: "pre-first", leadMinutes: 60 }],
  },
  {
    id: "mls",
    label: "MLS",
    sclSport: "SOCCER",
    providerKey: "soccer_usa_mls",
    league: "MLS",
    markets: BASIC,
    slots: [{ kind: "before-first", id: "pre-first", leadMinutes: 60 }],
  },
  {
    id: "europa-clq",
    label: "Europa CLQ",
    sclSport: "SOCCER",
    providerKey: "soccer_uefa_europa_conference_league",
    league: "EUROPA_CLQ",
    markets: BASIC,
    slots: [{ kind: "before-first", id: "pre-first", leadMinutes: 60 }],
  },
  {
    id: "nfl-preseason",
    label: "NFL Preseason",
    sclSport: "NFL",
    providerKey: "americanfootball_nfl_preseason",
    league: "AMERICANFOOTBALL_NFL_PRESEASON",
    markets: BASIC,
    slots: [
      { kind: "daily", id: "daily" },
      { kind: "before-first", id: "pre-first", leadMinutes: 180 },
    ],
  },
  {
    id: "atp-quals",
    label: "ATP Quals",
    sclSport: "TENNIS",
    catalogMatch: /tennis.*atp.*qual|atp.*qual/i,
    league: "ATP_QUALS",
    markets: BASIC,
    slots: [{ kind: "before-first", id: "pre-first", leadMinutes: 60 }],
  },
  {
    id: "atp-montreal",
    label: "ATP Montreal",
    sclSport: "TENNIS",
    providerKey: "tennis_atp_canadian_open",
    league: "ATP_MONTREAL",
    markets: BASIC,
    slots: [{ kind: "before-first", id: "pre-first", leadMinutes: 60 }],
  },
  {
    id: "wta-toronto",
    label: "WTA Toronto",
    sclSport: "TENNIS",
    providerKey: "tennis_wta_canadian_open",
    league: "WTA_TORONTO",
    markets: BASIC,
    slots: [{ kind: "before-first", id: "pre-first", leadMinutes: 60 }],
  },
] as const;

const ET_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function etDate(date: Date): string {
  return ET_DATE.format(date);
}

function etClock(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24,
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
  };
}

export function dueRefreshSlots(
  competition: StrategicCompetition,
  eventStarts: readonly Date[],
  completedSlotKeys: ReadonlySet<string>,
  now = new Date(),
): string[] {
  const today = etDate(now);
  const starts = eventStarts
    .filter((date) => Number.isFinite(date.getTime()) && date > now)
    .sort((a, b) => a.getTime() - b.getTime());
  const due: string[] = [];

  for (const slot of competition.slots) {
    if (slot.kind === "daily") {
      const key = `${competition.id}:${today}:${slot.id}`;
      if (!completedSlotKeys.has(key)) due.push(key);
      continue;
    }
    if (slot.kind === "fixed-et") {
      const key = `${competition.id}:${today}:${slot.id}`;
      const clock = etClock(now);
      const currentMinutes = clock.hour * 60 + clock.minute;
      const targetMinutes = slot.hour * 60 + (slot.minute ?? 0);
      if (currentMinutes >= targetMinutes && !completedSlotKeys.has(key)) {
        due.push(key);
      }
      continue;
    }

    // One pre-first refresh per competition, per event day. Future-day events
    // are handled naturally, so tomorrow's NFL window is not spent today.
    const firstByDay = new Map<string, Date>();
    for (const start of starts) {
      const day = etDate(start);
      const prior = firstByDay.get(day);
      if (!prior || start < prior) firstByDay.set(day, start);
    }
    for (const [day, first] of firstByDay) {
      const key = `${competition.id}:${day}:${slot.id}`;
      const target = first.getTime() - slot.leadMinutes * 60_000;
      if (
        now.getTime() >= target &&
        now.getTime() < first.getTime() &&
        !completedSlotKeys.has(key)
      ) {
        due.push(key);
      }
    }
  }
  return due;
}
