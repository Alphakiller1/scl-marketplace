import Link from "next/link";
import type { Outcome } from "@prisma/client";
import { ListChecks } from "lucide-react";

import { SportTag } from "@/components/scl/badges";
import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";
import { formatOdds, formatUnits } from "@/lib/format";
import { getAdminPublishedPlays } from "@/lib/queries/admin-plays";

export const metadata = { title: "Published plays" };

type PageProps = {
  searchParams: Promise<{
    outcome?: string;
    sport?: string;
    q?: string;
  }>;
};

const OUTCOMES: Array<Outcome | "ALL"> = [
  "ALL",
  "PENDING",
  "WIN",
  "LOSS",
  "PUSH",
  "VOID",
];

export default async function AdminPlaysPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const outcome = (params.outcome?.toUpperCase() ?? "ALL") as Outcome | "ALL";
  const sport = params.sport ?? "";
  const search = params.q ?? "";

  const plays = await getAdminPublishedPlays({
    outcome: OUTCOMES.includes(outcome) ? outcome : "ALL",
    sport,
    search,
  });

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={ListChecks}
        title="Published Plays"
        subtitle="Search and filter committed straight plays across the platform"
      />

      <form className="border-border bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-4">
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground font-medium">Search</span>
          <input
            name="q"
            defaultValue={search}
            placeholder="Capper, selection, market"
            className="border-input bg-background min-h-10 rounded-lg border px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground font-medium">Sport</span>
          <input
            name="sport"
            defaultValue={sport}
            placeholder="MLB"
            className="border-input bg-background min-h-10 rounded-lg border px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground font-medium">Outcome</span>
          <select
            name="outcome"
            defaultValue={outcome}
            className="border-input bg-background min-h-10 rounded-lg border px-2.5 text-sm"
          >
            {OUTCOMES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="bg-brand text-brand-foreground min-h-10 rounded-lg px-4 text-sm font-semibold sm:col-span-4 sm:max-w-fit"
        >
          Apply filters
        </button>
      </form>

      {plays.length ? (
        <div className="border-border overflow-hidden rounded-xl border">
          <div className="border-border bg-surface-2 text-muted-foreground hidden grid-cols-[7rem_minmax(0,1fr)_1fr_5rem_5rem_5rem] gap-4 border-b px-4 py-2 text-xs font-semibold uppercase lg:grid">
            <span>Date</span>
            <span>Capper</span>
            <span>Play</span>
            <span>Odds</span>
            <span>Units</span>
            <span>Result</span>
          </div>
          <div className="divide-border divide-y">
            {plays.map((play) => (
              <article
                key={play.id}
                className="bg-card grid gap-3 p-4 lg:grid-cols-[7rem_minmax(0,1fr)_1fr_5rem_5rem_5rem] lg:items-center"
              >
                <div className="text-muted-foreground text-sm">
                  {play.createdAt.toLocaleDateString()}
                </div>
                <div className="min-w-0 truncate font-medium">
                  {play.capperName}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <SportTag sport={play.sport} />
                    <span className="truncate font-semibold">
                      {play.selection}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {play.market}
                  </p>
                </div>
                <div className="nums text-sm tabular-nums">
                  {formatOdds(play.oddsAmerican)}
                </div>
                <div className="nums text-sm tabular-nums">
                  {formatUnits(play.units, true, false)}
                </div>
                <div>
                  {play.outcome === "PENDING" ? (
                    <Link
                      href="/admin/grading"
                      className="text-brand text-sm font-medium"
                    >
                      Grade
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold">
                      {play.outcome}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={ListChecks}
          title="No Matching Plays"
          description="Try clearing filters or wait for cappers to submit plays."
        />
      )}
    </div>
  );
}
