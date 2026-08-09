import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { getCurrentUser } from "@/lib/session";
import {
  getCapperParlays,
  getCapperPlays,
  mergeRecordEntries,
} from "@/lib/queries/plays";
import { NewPickButton } from "@/components/scl/new-pick-button";
import { EmptyState } from "@/components/scl/states";
import { SectionHeader } from "@/components/scl/section";
import { ParlayListItem, PlayListItem } from "@/components/scl/play-list-item";
import type { RecordEntry } from "@/lib/queries/plays";

export const metadata = { title: "My Picks" };

type PickSort = "recent" | "roi" | "winPct" | "units";

function sortEntries(entries: RecordEntry[], sort: PickSort) {
  return [...entries].sort((a, b) => {
    if (sort === "recent") return b.createdAt.getTime() - a.createdAt.getTime();
    if (sort === "units") return (b.profitUnits ?? 0) - (a.profitUnits ?? 0);
    if (sort === "roi") {
      return (b.profitUnits ?? 0) / b.units - (a.profitUnits ?? 0) / a.units;
    }
    const score = (entry: RecordEntry) =>
      entry.outcome === "WIN" ? 1 : entry.outcome === "PUSH" ? 0.5 : 0;
    return score(b) - score(a);
  });
}

const SORT_OPTIONS: { key: PickSort; label: string }[] = [
  { key: "recent", label: "Most recent" },
  { key: "roi", label: "ROI" },
  { key: "winPct", label: "Win rate" },
  { key: "units", label: "Units won" },
];

export default async function MyPicksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const sort: PickSort = SORT_OPTIONS.some((option) => option.key === requested)
    ? (requested as PickSort)
    : "recent";
  const user = await getCurrentUser();
  const [plays, parlays] = user
    ? await Promise.all([getCapperPlays(user.id), getCapperParlays(user.id)])
    : [[], []];
  const entries = sortEntries(mergeRecordEntries(plays, parlays), sort);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="My Picks"
        subtitle={
          entries.length
            ? `${entries.length} submitted ${entries.length === 1 ? "Ticket" : "Tickets"} — pending until graded`
            : "Your public record is built from board-checked Tickets"
        }
      />
      {entries.length ? (
        <div className="space-y-3">
          <nav className="flex flex-wrap gap-2" aria-label="Sort my picks">
            {SORT_OPTIONS.map((option) => (
              <Link
                key={option.key}
                href={
                  option.key === "recent"
                    ? "/dashboard/picks"
                    : `/dashboard/picks?sort=${option.key}`
                }
                aria-current={sort === option.key ? "page" : undefined}
                className={
                  sort === option.key
                    ? "bg-primary text-primary-foreground inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold"
                    : "border-border bg-card text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-semibold"
                }
              >
                {option.label}
              </Link>
            ))}
          </nav>
          <div className="space-y-2">
            {entries.map((e) =>
              e.kind === "parlay" ? (
                <ParlayListItem key={`parlay-${e.id}`} parlay={e} />
              ) : (
                <PlayListItem key={`play-${e.id}`} play={e} dashboard />
              ),
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No Plays Yet"
          description="Submit a board-checked play to start an inspectable record. Nothing appears here until you log a Ticket."
          action={<NewPickButton variant="outline" />}
        />
      )}
    </div>
  );
}
