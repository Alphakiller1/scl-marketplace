"use client";

import { useMemo, useState } from "react";

import { MarketChip } from "@/components/scl/market-chip";
import { TeamMark } from "@/components/scl/team-mark";
import { Card } from "@/components/ui/card";
import { formatOdds } from "@/lib/format";
import {
  dedupeOddsEvents,
  isExtremeAmericanOdds,
  type OddsEvent,
  type OddsSelection,
} from "@/lib/odds-board";
import { getTeamIdentity } from "@/lib/teams";
import { cn } from "@/lib/utils";

const COMMENCE = "2026-07-18T23:10:00Z";
const CAPTURED = "2026-07-18T18:42:00Z";

/** Thin duplicate row (one book) — should lose to the rich twin. */
const THIN_PIT_CLE: OddsEvent = {
  id: "evt-thin",
  sport: "MLB",
  commenceTime: COMMENCE,
  home: "Cleveland Guardians",
  away: "Pittsburgh Pirates",
  selections: [
    {
      label: "Pirates ML",
      market: "Moneyline",
      selection: "Pittsburgh Pirates",
      side: "Pittsburgh Pirates",
      featured: true,
      oddsAmerican: 940,
      book: "draftkings",
      bookPrices: { draftkings: 940 },
      oddsCapturedAt: CAPTURED,
    },
  ],
};

/** Most-complete twin of the same matchup — preferred by dedupeOddsEvents. */
const RICH_PIT_CLE: OddsEvent = {
  id: "evt-rich",
  sport: "MLB",
  commenceTime: COMMENCE,
  home: "Cleveland Guardians",
  away: "Pittsburgh Pirates",
  selections: [
    {
      label: "Pirates ML",
      market: "Moneyline",
      selection: "Pittsburgh Pirates",
      side: "Pittsburgh Pirates",
      featured: true,
      oddsAmerican: 150,
      book: "fanduel",
      bookPrices: { draftkings: 145, fanduel: 150, betmgm: 140 },
      oddsCapturedAt: CAPTURED,
    },
    {
      label: "Guardians ML",
      market: "Moneyline",
      selection: "Cleveland Guardians",
      side: "Cleveland Guardians",
      featured: true,
      oddsAmerican: -175,
      book: "fanduel",
      bookPrices: { draftkings: -170, fanduel: -175 },
      oddsCapturedAt: CAPTURED,
    },
  ],
};

const OTHER_GAME: OddsEvent = {
  id: "evt-other",
  sport: "MLB",
  commenceTime: COMMENCE,
  home: "New York Yankees",
  away: "Boston Red Sox",
  selections: [
    {
      label: "Yankees ML",
      market: "Moneyline",
      selection: "New York Yankees",
      side: "New York Yankees",
      featured: true,
      oddsAmerican: -130,
      book: "draftkings",
      bookPrices: { draftkings: -130 },
      oddsCapturedAt: CAPTURED,
    },
  ],
};

/** Seeded feed that intentionally duplicates Pirates @ Guardians. */
export const QA_DUP_FEED: OddsEvent[] = [
  THIN_PIT_CLE,
  RICH_PIT_CLE,
  OTHER_GAME,
  { ...THIN_PIT_CLE, id: "evt-thin-2" },
];

const EXTREME_CHIPS: OddsSelection[] = [
  {
    label: "Pirates ML",
    market: "Moneyline",
    selection: "Pittsburgh Pirates",
    side: "Pittsburgh Pirates",
    featured: true,
    oddsAmerican: 940,
    book: "draftkings",
    bookPrices: { draftkings: 940 },
    oddsCapturedAt: CAPTURED,
  },
  {
    label: "Guardians ML",
    market: "Moneyline",
    selection: "Cleveland Guardians",
    side: "Cleveland Guardians",
    featured: true,
    oddsAmerican: -3100,
    book: "fanduel",
    bookPrices: { fanduel: -3100 },
    oddsCapturedAt: CAPTURED,
  },
  {
    label: "Yankees -1.5",
    market: "Spread",
    selection: "New York Yankees -1.5",
    side: "New York Yankees",
    line: -1.5,
    featured: true,
    oddsAmerican: -110,
    book: "draftkings",
    bookPrices: { draftkings: -110 },
    oddsCapturedAt: CAPTURED,
  },
];

function EventRow({ event }: { event: OddsEvent }) {
  const away = getTeamIdentity(event.away, event.sport);
  const home = getTeamIdentity(event.home, event.sport);
  const timeLabel = new Date(event.commenceTime).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <li className="border-border bg-card flex items-center gap-3 rounded-[14px] border px-3 py-2.5">
      <span className="flex shrink-0 items-center -space-x-1.5" aria-hidden>
        <TeamMark team={away} size="md" />
        <TeamMark team={home} size="md" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="scl-display block truncate text-[15px] font-semibold tracking-[0.02em]">
          {away.shortName}{" "}
          <span className="text-[color:var(--scl-muted-data)]">@</span>{" "}
          {home.shortName}
        </span>
        <span className="scl-data mt-0.5 block text-[0.65rem] tracking-[0.1em] text-[color:var(--scl-muted-label)] uppercase">
          {timeLabel} ET · id {event.id}
        </span>
      </span>
      <span className="scl-data text-muted-foreground shrink-0 text-[0.65rem] tracking-[0.08em] uppercase">
        {event.selections.length} lines ·{" "}
        {Object.keys(event.selections[0]?.bookPrices ?? {}).length} books
      </span>
    </li>
  );
}

/**
 * In-component seeded board states for Claude visual gate (PR #224).
 * Never fetches odds or writes to the database.
 */
export function QaBoardOddsHygiene() {
  const raw = QA_DUP_FEED;
  const deduped = useMemo(() => dedupeOddsEvents(raw), [raw]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  return (
    <div className="space-y-10">
      <section id="qa-board-dedupe" className="scroll-mt-6 space-y-3">
        <header>
          <p className="text-muted-foreground text-xs tracking-[0.08em] uppercase">
            QA fixture · board dedupe
          </p>
          <h1 className="scl-display mt-1 text-xl font-bold tracking-[0.03em] uppercase">
            Duplicate feed → one row per matchup
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            Seeded Pirates @ Guardians arrives twice (thin + rich).{" "}
            <code className="text-foreground">dedupeOddsEvents</code> keeps the
            most-complete row. No live Odds API / no DB writes.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-2 p-4">
            <h2 className="scl-display text-sm font-semibold tracking-[0.08em] uppercase">
              Raw feed ({raw.length} rows)
            </h2>
            <ul className="space-y-2" data-qa="raw-board">
              {raw.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </ul>
          </Card>
          <Card className="space-y-2 p-4">
            <h2 className="scl-display text-sm font-semibold tracking-[0.08em] uppercase">
              After dedupe ({deduped.length} rows)
            </h2>
            <ul className="space-y-2" data-qa="deduped-board">
              {deduped.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </ul>
            <p className="scl-data text-muted-foreground pt-1 text-[0.65rem] tracking-[0.08em] uppercase">
              Kept{" "}
              <span className="text-foreground">
                {deduped.find((e) => e.id === "evt-rich")?.id ?? "—"}
              </span>{" "}
              for Pirates @ Guardians (most books)
            </p>
          </Card>
        </div>
      </section>

      <section id="qa-board-extreme" className="scroll-mt-6 space-y-3">
        <header>
          <p className="text-muted-foreground text-xs tracking-[0.08em] uppercase">
            QA fixture · extreme odds review
          </p>
          <h1 className="scl-display mt-1 text-xl font-bold tracking-[0.03em] uppercase">
            Extreme prices flagged, still selectable
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            American ≥+900 or ≤−2000 shows a quiet Review mark + book/capture
            clock. Normal −110 is unmarked. Tap an extreme chip — it selects
            (never blocked). Submit would set{" "}
            <code className="text-foreground">needsReview</code> (soft-degrades
            when the column is missing).
          </p>
        </header>

        <Card className="space-y-3 p-4">
          <div className="grid gap-2 sm:grid-cols-3" data-qa="extreme-chips">
            {EXTREME_CHIPS.map((s) => {
              const key = `${s.selection}|${s.oddsAmerican}`;
              const extreme = isExtremeAmericanOdds(s.oddsAmerican);
              const selected = selectedKey === key;
              return (
                <MarketChip
                  key={key}
                  label={s.label}
                  oddsAmerican={s.oddsAmerican}
                  book={s.book}
                  selected={selected}
                  onClick={() => setSelectedKey(key)}
                  className={cn(!extreme && "ring-0")}
                />
              );
            })}
          </div>
          <dl className="scl-data text-muted-foreground grid gap-1 text-[0.7rem] tracking-[0.06em] uppercase sm:grid-cols-3">
            {EXTREME_CHIPS.map((s) => {
              const extreme = isExtremeAmericanOdds(s.oddsAmerican);
              return (
                <div key={`${s.selection}-meta`}>
                  <dt className="text-foreground">
                    {formatOdds(s.oddsAmerican)}
                  </dt>
                  <dd>
                    {extreme
                      ? `Review · needsReview=true · ${s.book}`
                      : "Normal · needsReview=false"}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p
            className="text-muted-foreground text-xs"
            data-qa="extreme-selection"
          >
            {selectedKey
              ? `Selected (allowed): ${selectedKey}`
              : "No selection yet — chips remain clickable."}
          </p>
        </Card>
      </section>
    </div>
  );
}
