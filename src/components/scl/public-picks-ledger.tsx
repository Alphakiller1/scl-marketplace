"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, Filter, ReceiptText } from "lucide-react";

import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperIdentityLabel } from "@/components/scl/capper-identity-label";
import { PickTierBadge, SportTag, StatusBadge } from "@/components/scl/badges";
import { LeagueRef, TeamRef } from "@/components/scl/entity-marks";
import { ProofReceipt } from "@/components/scl/proof-receipt";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bookLabel } from "@/lib/books";
import { SPORTS } from "@/lib/constants";
import { formatOdds, formatUnits } from "@/lib/format";
import type { TodayPick } from "@/lib/mock";
import { profitUnitsForOutcome } from "@/lib/odds";
import {
  DEFAULT_PUBLIC_PICKS_FILTERS,
  isPublicPickGraded,
  publicPickProofState,
  type PublicPicksLedgerFilters,
  type PublicPicksStatus,
  type PublicPicksWindow,
} from "@/lib/public-picks-ledger";
import { cn } from "@/lib/utils";
import { isVerifiedTier } from "@/lib/verification";

type PublicPicksLedgerProps = {
  picks: TodayPick[];
  initialFilters: PublicPicksLedgerFilters;
  initialReceiptId?: string | null;
  gradingHealthy: boolean;
};

const CAPTURE_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const PUBLIC_SPORT_OPTIONS = [
  ["all", "All"],
  ...SPORTS.map((sport) => [sport.key, sport.key] as const),
] as const;

function formatCaptureTime(value: Date): string {
  return `${CAPTURE_FORMAT.format(new Date(value))} ET`;
}

function embargoMessage(pick: TodayPick): string {
  return pick.embargoedUntil
    ? `Selection unlocks ${formatCaptureTime(pick.embargoedUntil)}`
    : "Selection unlocks after the event start is confirmed";
}

function receiptUnits(pick: TodayPick): string {
  const graded = isPublicPickGraded(pick);
  const outcome =
    pick.status === "loss"
      ? "LOSS"
      : pick.status === "push"
        ? "PUSH"
        : pick.status === "void"
          ? "VOID"
          : "WIN";
  const value =
    pick.profitUnits ??
    profitUnitsForOutcome(outcome, pick.oddsAmerican, pick.units);
  return value == null ? "—" : formatUnits(value, true, graded);
}

export function PublicPicksLedger({
  picks,
  initialFilters,
  initialReceiptId = null,
  gradingHealthy,
}: PublicPicksLedgerProps) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(initialReceiptId);
  const [isPending, startTransition] = useTransition();
  const filters = initialFilters;
  const filtered = picks;
  const defaultScope =
    filters.window === "all" &&
    filters.sport === "all" &&
    filters.status === "all";

  function replaceQuery(
    nextFilters: PublicPicksLedgerFilters,
    nextReceiptId: string | null,
  ) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value, defaultValue] of [
      ["window", nextFilters.window, DEFAULT_PUBLIC_PICKS_FILTERS.window],
      ["sport", nextFilters.sport, DEFAULT_PUBLIC_PICKS_FILTERS.sport],
      ["status", nextFilters.status, DEFAULT_PUBLIC_PICKS_FILTERS.status],
    ] as const) {
      if (value === defaultValue) params.delete(key);
      else params.set(key, value);
    }
    if (nextReceiptId) params.set("receipt", nextReceiptId);
    else params.delete("receipt");
    const query = params.toString();
    router.replace(query ? `/picks?${query}` : "/picks", { scroll: false });
  }

  function updateFilters(nextFilters: PublicPicksLedgerFilters) {
    setOpenId(null);
    startTransition(() => replaceQuery(nextFilters, null));
  }

  function toggleReceipt(id: string) {
    const nextId = openId === id ? null : id;
    setOpenId(nextId);
    replaceQuery(filters, nextId);
  }

  return (
    <section
      className="mt-5"
      aria-labelledby="public-picks-ledger-heading"
      aria-busy={isPending}
    >
      <h2 id="public-picks-ledger-heading" className="sr-only">
        Public picks ledger
      </h2>

      <div className="border-border bg-surface-2/45 flex flex-col gap-3 border-y px-3 py-3 sm:px-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-end gap-2.5">
          <div className="mr-1 hidden min-h-10 items-center gap-2 text-sm font-medium lg:flex">
            <Filter
              className="size-4 text-[color:var(--scl-blue)]"
              aria-hidden
            />
            Scope
          </div>
          <ScopeSelect
            label="Window"
            value={filters.window}
            onValueChange={(value) =>
              updateFilters({ ...filters, window: value as PublicPicksWindow })
            }
            options={[
              ["all", "All"],
              ["7d", "7 Days"],
              ["30d", "30 Days"],
            ]}
          />
          <ScopeSelect
            label="Sport"
            value={filters.sport}
            onValueChange={(value) =>
              updateFilters({ ...filters, sport: value })
            }
            options={PUBLIC_SPORT_OPTIONS}
          />
          <ScopeSelect
            label="Status"
            value={filters.status}
            onValueChange={(value) =>
              updateFilters({ ...filters, status: value as PublicPicksStatus })
            }
            options={[
              ["all", "All"],
              ["pending", "Ungraded"],
              ["live", "In progress"],
              ["graded", "Graded"],
            ]}
          />
        </div>
        <div className="flex min-h-10 items-center justify-between gap-3 lg:justify-end">
          <p className="text-muted-foreground text-xs" role="status">
            {isPending
              ? "Updating scope…"
              : "Open one row to inspect its receipt."}
          </p>
        </div>
      </div>

      {filtered.length ? (
        <>
          <div className="border-border hidden border-b lg:block">
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">
                Chronological public picks. Open a row to inspect its Proof
                Receipt.
              </caption>
              <colgroup>
                <col className="w-28" />
                <col className="w-48" />
                <col className="w-20" />
                <col />
                <col className="w-20" />
                <col className="w-20" />
                <col className="w-32" />
                <col className="w-28" />
                <col className="w-14" />
              </colgroup>
              <thead className="border-border bg-surface-2/30 border-b">
                <tr>
                  {[
                    "Captured",
                    "Capper",
                    "Sport",
                    "Pick",
                    "Odds",
                    "Stake",
                    "Status",
                    "Proof",
                    "",
                  ].map((label, index) => (
                    <th
                      key={`${label}-${index}`}
                      scope="col"
                      className="scl-eyebrow h-10 px-3 text-left"
                    >
                      {label || (
                        <span className="sr-only">Inspect receipt</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((pick) => (
                  <DesktopLedgerRows
                    key={pick.id}
                    pick={pick}
                    open={openId === pick.id}
                    gradingHealthy={gradingHealthy}
                    onToggle={() => toggleReceipt(pick.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-border border-b lg:hidden">
            {filtered.map((pick) => (
              <MobileLedgerRow
                key={pick.id}
                pick={pick}
                open={openId === pick.id}
                gradingHealthy={gradingHealthy}
                onToggle={() => toggleReceipt(pick.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="border-border border-b px-4 py-14 text-center">
          <ReceiptText
            className="mx-auto size-5 text-[color:var(--scl-muted-data)]"
            aria-hidden
          />
          <h3 className="scl-display text-foreground mt-3 text-lg font-semibold">
            {defaultScope ? "No Public Picks Yet" : "No Records In This Scope"}
          </h3>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-relaxed">
            {defaultScope
              ? "Public Records appear here after cappers log tracked plays. Nothing is fabricated to fill the ledger."
              : "No tracked public picks match these filters. Adjust the scope to inspect other records."}
          </p>
        </div>
      )}
    </section>
  );
}

function ScopeSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onValueChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 flex-1 sm:flex-none">
      <span className="scl-eyebrow mb-1 block">{label}</span>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue != null) onValueChange(nextValue);
        }}
      >
        <SelectTrigger className="bg-background min-h-10 w-full min-w-0 text-base sm:w-40 sm:text-sm">
          <SelectValue>
            {options.find(([optionValue]) => optionValue === value)?.[1] ??
              value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function DesktopLedgerRows({
  pick,
  open,
  gradingHealthy,
  onToggle,
}: {
  pick: TodayPick;
  open: boolean;
  gradingHealthy: boolean;
  onToggle: () => void;
}) {
  const panelId = `receipt-${pick.id}`;
  return (
    <>
      <tr
        className={cn(
          "border-border hover:bg-surface-2/35 border-b",
          open && "bg-[color:var(--scl-pink)]/[0.045]",
        )}
      >
        <td
          className={cn(
            "px-3 py-3",
            open && "border-l-2 border-l-[color:var(--scl-pink)] pl-2.5",
          )}
        >
          <time
            className="scl-data text-muted-foreground text-xs tabular-nums"
            dateTime={new Date(pick.postedAt).toISOString()}
          >
            {formatCaptureTime(pick.postedAt)}
          </time>
        </td>
        <td className="px-3 py-3">
          <Link
            href={`/cappers/${pick.capper.handle}`}
            className="focus-visible:ring-ring flex min-h-10 min-w-0 items-center gap-2 rounded-lg outline-none hover:underline focus-visible:ring-2"
          >
            <CapperAvatar
              name={pick.capper.name}
              src={pick.capper.avatarUrl}
              size="sm"
            />
            <CapperIdentityLabel
              capper={pick.capper}
              compact
              primaryClassName="truncate text-sm"
            />
          </Link>
        </td>
        <td className="px-3 py-3">
          <SportTag sport={pick.sport} markOnly />
        </td>
        <td className="min-w-0 px-3 py-3">
          <p className="text-foreground truncate text-sm font-semibold">
            {pick.selection}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {pick.isEmbargoed ? embargoMessage(pick) : pick.event}
          </p>
        </td>
        <td className="scl-data text-foreground px-3 py-3 text-sm font-semibold tabular-nums">
          {pick.isEmbargoed ? "—" : formatOdds(pick.oddsAmerican)}
        </td>
        <td className="scl-data text-foreground px-3 py-3 text-sm font-semibold tabular-nums">
          {formatUnits(pick.units, true, false)}
        </td>
        <td className="px-3 py-3">
          <StatusBadge status={pick.status} />
        </td>
        <td className="px-3 py-3">
          <PickTierBadge tier={pick.verificationTier ?? "SELF_REPORTED"} />
        </td>
        <td className="px-1 py-2 text-right">
          <button
            type="button"
            className="focus-visible:ring-ring hover:bg-surface-3 inline-flex size-11 items-center justify-center rounded-lg outline-none focus-visible:ring-2"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${open ? "Close" : "Inspect"} receipt for ${pick.selection}`}
            onClick={onToggle}
          >
            <ChevronDown
              className={cn("size-4", open && "rotate-180")}
              aria-hidden
            />
          </button>
        </td>
      </tr>
      {open ? (
        <tr>
          <td
            colSpan={9}
            className="border-border bg-surface-2/20 border-b p-0"
          >
            <ExpandedEvidence
              id={panelId}
              pick={pick}
              gradingHealthy={gradingHealthy}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function MobileLedgerRow({
  pick,
  open,
  gradingHealthy,
  onToggle,
}: {
  pick: TodayPick;
  open: boolean;
  gradingHealthy: boolean;
  onToggle: () => void;
}) {
  const panelId = `receipt-mobile-${pick.id}`;
  return (
    <article
      className={cn(
        "border-border border-b last:border-b-0",
        open && "bg-[color:var(--scl-pink)]/[0.035]",
      )}
    >
      <button
        type="button"
        className={cn(
          "focus-visible:ring-ring grid min-h-10 w-full grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-4",
          open &&
            "border-l-2 border-l-[color:var(--scl-pink)] pl-2.5 sm:pl-3.5",
        )}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <SportTag sport={pick.sport} markOnly />
            <span className="text-foreground truncate text-sm font-semibold">
              {pick.selection}
            </span>
          </span>
          <span className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-muted-foreground truncate text-xs">
              @{pick.capper.handle}
            </span>
            <span className="scl-data text-foreground text-sm font-semibold tabular-nums">
              {pick.isEmbargoed ? "Odds hidden" : formatOdds(pick.oddsAmerican)}
            </span>
            <span className="scl-data text-muted-foreground text-xs tabular-nums">
              {formatUnits(pick.units, true, false)}
            </span>
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={pick.status} />
            <PickTierBadge tier={pick.verificationTier ?? "SELF_REPORTED"} />
          </span>
        </span>
        <span className="flex min-h-10 flex-col items-end justify-between gap-2">
          <time
            className="scl-data text-muted-foreground text-[0.7rem] tabular-nums"
            dateTime={new Date(pick.postedAt).toISOString()}
          >
            {formatCaptureTime(pick.postedAt)}
          </time>
          <ChevronDown
            className={cn("size-4", open && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>
      {open ? (
        <ExpandedEvidence
          id={panelId}
          pick={pick}
          gradingHealthy={gradingHealthy}
          compact
        />
      ) : null}
    </article>
  );
}

function ExpandedEvidence({
  id,
  pick,
  gradingHealthy,
  compact = false,
}: {
  id: string;
  pick: TodayPick;
  gradingHealthy: boolean;
  compact?: boolean;
}) {
  if (pick.isEmbargoed) {
    return (
      <div
        id={id}
        className="border-border bg-surface-2/30 border-y px-5 py-8 text-center"
      >
        <p className="scl-eyebrow text-[color:var(--scl-blue)]">
          Paid pick protected
        </p>
        <h3 className="scl-display text-foreground mt-2 text-lg font-semibold">
          The selection is temporarily hidden
        </h3>
        <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm leading-relaxed">
          {embargoMessage(pick)}. SCL publishes the complete selection, line,
          odds, and receipt 90 minutes after the scheduled start.
        </p>
        <p className="text-muted-foreground mt-3 text-xs">
          {pick.sport} · {pick.event} · Captured{" "}
          {formatCaptureTime(pick.postedAt)}
        </p>
      </div>
    );
  }

  const boardVerified = Boolean(
    pick.verificationTier && isVerifiedTier(pick.verificationTier),
  );
  return (
    <div
      id={id}
      className={cn(
        "grid min-w-0 gap-5 px-3 py-5 sm:px-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(360px,1.2fr)] lg:items-start lg:px-7 lg:py-7",
        compact && "lg:grid-cols-1",
      )}
    >
      <div className="min-w-0 lg:pt-1">
        <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
          Audit trail
        </p>
        <dl className="border-border mt-2 border-t">
          <AuditRow label="Captured" value={formatCaptureTime(pick.postedAt)} />
          <AuditRow
            label="Source"
            value={pick.book ? bookLabel(pick.book) : "Live board"}
          />
          <AuditRow
            label="Submission Proof"
            value={boardVerified ? "Odds verified" : "Odds not verified"}
          />
          <AuditRow
            label="Settlement"
            value={<StatusBadge status={pick.status} />}
          />
        </dl>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Submission Proof describes how the pick was recorded. Settlement is
          shown separately.
        </p>
      </div>

      <ProofReceipt
        selectionTitle={pick.selection}
        leadingMark={
          <TeamRef name={pick.side} sport={pick.sport} size="md" knownOnly />
        }
        eventLine={
          <span className="inline-flex flex-wrap items-center gap-1.5 tracking-normal normal-case">
            <LeagueRef sport={pick.sport} />
            {pick.event ? (
              <span className="scl-data tracking-[0.06em] uppercase">
                {pick.event}
              </span>
            ) : null}
          </span>
        }
        odds={formatOdds(pick.oddsAmerican)}
        stake={formatUnits(pick.units, true, false)}
        toWin={receiptUnits(pick)}
        capturedAt={new Date(pick.postedAt).toISOString()}
        book={pick.book}
        gradingHealthy={gradingHealthy}
        state={publicPickProofState(pick)}
        density="expanded-paper"
        verificationDominant
        boardVerified={boardVerified}
        closingOddsAmerican={pick.closingOddsAmerican ?? null}
        clvPts={pick.clvPts ?? null}
        evidenceId={pick.id}
        eventStartsAt={pick.eventStartsAt ?? null}
        analysis={pick.notesPublic === false ? null : (pick.notes ?? null)}
        footerAction={
          <Link
            href={`/cappers/${pick.capper.handle}`}
            className="focus-visible:ring-ring text-foreground inline-flex min-h-10 items-center text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-2"
          >
            Inspect @{pick.capper.handle}&apos;s public record
          </Link>
        }
      />
    </div>
  );
}

function AuditRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-border grid min-h-10 grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 border-b py-2.5">
      <dt className="scl-eyebrow">{label}</dt>
      <dd className="scl-data text-foreground min-w-0 text-sm font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}
