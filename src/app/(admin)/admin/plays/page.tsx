import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { PickTierBadge, SportTag, StatusBadge } from "@/components/scl/badges";
import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adminPublishedPlaysHref,
  parseAdminPublishedPlayFilters,
} from "@/lib/admin-published-plays";
import { SPORTS } from "@/lib/constants";
import { formatOdds, formatUnits } from "@/lib/format";
import { deriveLifecycle } from "@/lib/lifecycle";
import { getAdminPublishedPlays } from "@/lib/queries/admin-published-plays";

export const metadata = { title: "Published plays" };

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminPublishedPlaysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseAdminPublishedPlayFilters(await searchParams);
  const result = await getAdminPublishedPlays(filters);

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={ClipboardList}
        title="Published Plays"
        subtitle={`${result.total.toLocaleString()} committed public ${filters.recordType === "parlay" ? "parlay" : "straight play"}${result.total === 1 ? "" : "s"}`}
        href="/picks"
        hrefLabel="Open public ledger"
      />

      <form
        method="get"
        className="border-border bg-card grid gap-3 rounded-xl border p-4 md:grid-cols-[minmax(0,1fr)_9rem_9rem_9rem_auto]"
      >
        <Input
          type="search"
          name="search"
          defaultValue={filters.search}
          placeholder="Search capper, selection, or market"
          aria-label="Search published plays"
          maxLength={80}
        />
        <select
          name="type"
          defaultValue={filters.recordType}
          aria-label="Filter by record type"
          className="border-input bg-background min-h-10 rounded-lg border px-3 text-sm"
        >
          <option value="straight">Straight plays</option>
          <option value="parlay">Parlays</option>
        </select>
        <select
          name="sport"
          defaultValue={filters.sport}
          aria-label="Filter by sport"
          className="border-input bg-background min-h-10 rounded-lg border px-3 text-sm"
        >
          <option value="all">All sports</option>
          {SPORTS.map((sport) => (
            <option key={sport.key} value={sport.key}>
              {sport.label}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={filters.status}
          aria-label="Filter by settlement"
          className="border-input bg-background min-h-10 rounded-lg border px-3 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="graded">Graded</option>
        </select>
        <Button type="submit">Apply filters</Button>
      </form>

      {result.rows.length ? (
        <div className="border-border overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-2">
                <TableHead>Published</TableHead>
                <TableHead>Capper</TableHead>
                <TableHead>Play</TableHead>
                <TableHead>Line</TableHead>
                <TableHead>Proof</TableHead>
                <TableHead>Settlement</TableHead>
                <TableHead>Analysis</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((play) => {
                const username = play.username;
                const lifecycle = deriveLifecycle({
                  outcome: play.outcome,
                  eventStartsAt: play.eventStartsAt,
                });
                return (
                  <TableRow key={play.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      <time dateTime={play.createdAt.toISOString()}>
                        {dateTime.format(play.createdAt)}
                      </time>
                    </TableCell>
                    <TableCell>
                      {username ? (
                        <Link
                          href={`/cappers/${username.replace(/^@/, "")}`}
                          className="scl-link font-medium"
                        >
                          @{username.replace(/^@/, "")}
                        </Link>
                      ) : (
                        "Unavailable"
                      )}
                    </TableCell>
                    <TableCell className="max-w-80 whitespace-normal">
                      <div className="flex items-start gap-2">
                        {play.sports.length === 1 ? (
                          <SportTag sport={play.sports[0]} markOnly />
                        ) : (
                          <span className="bg-surface-3 text-muted-foreground rounded-md px-2 py-1 text-[0.65rem] font-semibold uppercase">
                            {play.sports.join(" / ")}
                          </span>
                        )}
                        <div>
                          <p className="font-medium">{play.selection}</p>
                          <p className="text-muted-foreground text-xs">
                            {play.market}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="scl-data tabular-nums">
                      {play.oddsAmerican == null
                        ? "—"
                        : formatOdds(play.oddsAmerican)}
                      <span className="text-muted-foreground ml-2">
                        {formatUnits(play.units, true, false)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <PickTierBadge tier={play.verificationTier} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={lifecycle} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {play.kind === "parlay"
                        ? "N/A"
                        : !play.notes
                          ? "None"
                          : play.notesPublic
                            ? "Public"
                            : "Hidden"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        render={
                          <Link href={`/admin/plays/${play.kind}/${play.id}`} />
                        }
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                      >
                        {play.outcome === "PENDING" ? "Review" : "Correct"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No Published Plays"
          description="No committed public-ledger plays match these filters."
        />
      )}

      {result.totalPages > 1 ? (
        <nav
          className="flex items-center justify-between gap-3"
          aria-label="Published plays pagination"
        >
          <Button
            render={
              <Link
                href={adminPublishedPlaysHref(filters, result.page - 1)}
                aria-disabled={result.page <= 1}
              />
            }
            nativeButton={false}
            variant="outline"
            className={
              result.page <= 1 ? "pointer-events-none opacity-50" : undefined
            }
          >
            Previous
          </Button>
          <p className="text-muted-foreground text-sm tabular-nums">
            Page {result.page} of {result.totalPages}
          </p>
          <Button
            render={
              <Link
                href={adminPublishedPlaysHref(filters, result.page + 1)}
                aria-disabled={result.page >= result.totalPages}
              />
            }
            nativeButton={false}
            variant="outline"
            className={
              result.page >= result.totalPages
                ? "pointer-events-none opacity-50"
                : undefined
            }
          >
            Next
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
