"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Outcome } from "@prisma/client";
import { AlertTriangle, Gavel, Users } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/scl/badges";
import { Button } from "@/components/ui/button";
import { applyBulkCorrectionAction } from "@/lib/actions/bulk-correction.action";
import {
  outcomeAllowedForMatch,
  planCorrection,
  type CorrectionOutcome,
  type CorrectionPlay,
  type Settlement,
} from "@/lib/bulk-correction";
import { formatOdds, formatUnits } from "@/lib/format";
import {
  matchupLabel,
  propMarketDisplayLabel,
  selectionWithMarket,
} from "@/lib/pick-identity";
import {
  CORRECTION_REASON_MIN,
  GRADEABLE_OUTCOMES,
} from "@/lib/schemas/grading.schema";
import { cn } from "@/lib/utils";

const OUTCOME_LABEL: Record<CorrectionOutcome, string> = {
  WIN: "Win",
  LOSS: "Loss",
  PUSH: "Push",
  VOID: "Void",
};

const OUTCOME_TO_STATUS = {
  PENDING: "pending",
  WIN: "win",
  LOSS: "loss",
  PUSH: "push",
  VOID: "void",
} as const satisfies Record<Outcome, string>;

const SELECT_CLASS =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-10 w-full rounded-lg border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none";

export type BulkCorrectionSource = {
  /** The straight play, or one leg of the ticket on this page. */
  sourceId: string;
  /** "Lakers -3.5" or "Leg 2: Over 8.5". */
  label: string;
  exact: CorrectionPlay[];
  related: CorrectionPlay[];
  truncated: boolean;
};

type Scope = "one" | "all";

function settlementText(settlement: Settlement): string {
  return settlement.profitUnits == null
    ? "Open"
    : formatUnits(settlement.profitUnits);
}

function SettlementPair({
  before,
  after,
}: {
  before: Settlement;
  after: Settlement;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <StatusBadge status={OUTCOME_TO_STATUS[before.outcome]} />
      <span className="scl-data text-xs tabular-nums">
        {settlementText(before)}
      </span>
      <span aria-hidden className="text-muted-foreground">
        →
      </span>
      <span className="sr-only">becomes</span>
      <StatusBadge status={OUTCOME_TO_STATUS[after.outcome]} />
      <span className="scl-data text-xs tabular-nums">
        {settlementText(after)}
      </span>
    </span>
  );
}

function positionLabel(play: CorrectionPlay): string {
  return play.parlay
    ? `Leg of ${play.parlay.legs.length}-leg parlay`
    : "Straight bet";
}

function CandidateRow({
  play,
  checked,
  disabled,
  onToggle,
  showSelection,
  isSource,
}: {
  play: CorrectionPlay;
  checked: boolean;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
  showSelection: boolean;
  isSource: boolean;
}) {
  const id = useId();
  return (
    <li
      className={cn(
        "flex items-start gap-3 px-3 py-2.5",
        disabled && "opacity-60",
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onToggle(event.target.checked)}
        className="accent-primary mt-1 size-4 shrink-0"
      />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-sm">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{play.capperLabel}</span>
          {isSource ? (
            <span className="bg-surface-2 rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase">
              This pick
            </span>
          ) : null}
          <span className="text-muted-foreground text-xs">
            {positionLabel(play)}
          </span>
        </span>
        {showSelection ? (
          <span className="mt-0.5 block font-medium break-words">
            {selectionWithMarket(play)}
            {propMarketDisplayLabel(play.market) ? null : (
              <span className="text-muted-foreground font-normal">
                {` · ${play.market}`}
              </span>
            )}
          </span>
        ) : null}
        <span className="text-muted-foreground scl-data mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
          <span>{formatOdds(play.oddsAmerican)}</span>
          <span>{formatUnits(play.units, true, false)}</span>
          <span className="inline-flex items-center gap-1">
            Now <StatusBadge status={OUTCOME_TO_STATUS[play.outcome]} />
          </span>
        </span>
      </label>
    </li>
  );
}

export function AdminBulkCorrection({
  sources,
  initialSourceId,
  kind,
  initialOutcome,
}: {
  sources: BulkCorrectionSource[];
  initialSourceId: string;
  kind: "straight" | "parlay";
  /** VOID when the page was opened for an injury-protection request. */
  initialOutcome?: CorrectionOutcome;
}) {
  const router = useRouter();
  const outcomeId = useId();
  const reasonId = useId();
  const sourceSelectId = useId();
  const [sourceId, setSourceId] = useState(
    sources.some((source) => source.sourceId === initialSourceId)
      ? initialSourceId
      : (sources[0]?.sourceId ?? ""),
  );
  const source =
    sources.find((entry) => entry.sourceId === sourceId) ?? sources[0];
  const sourcePlay = source?.exact[0];
  const defaultOutcome: CorrectionOutcome =
    initialOutcome ??
    (sourcePlay && sourcePlay.outcome !== "PENDING"
      ? sourcePlay.outcome
      : "WIN");
  const [outcome, setOutcome] = useState<CorrectionOutcome>(defaultOutcome);
  const [scope, setScope] = useState<Scope>("one");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(sourcePlay ? [sourcePlay.id] : []),
  );
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();

  const allCandidates = useMemo(
    () => [...(source?.exact ?? []), ...(source?.related ?? [])],
    [source],
  );
  const relatedIds = useMemo(
    () => new Set(source?.related.map((play) => play.id) ?? []),
    [source],
  );
  const targets = allCandidates.filter((play) => selected.has(play.id));
  const plan = planCorrection(outcome, targets);
  const otherCappers = new Set(
    (source?.exact ?? [])
      .filter((play) => play.capperId !== sourcePlay?.capperId)
      .map((play) => play.capperId),
  ).size;

  if (!source || !sourcePlay) return null;

  function chooseSource(nextId: string) {
    const next = sources.find((entry) => entry.sourceId === nextId);
    setSourceId(nextId);
    setScope("one");
    setSelected(new Set(next?.exact[0] ? [next.exact[0].id] : []));
    setConfirmed(false);
  }

  function chooseScope(next: Scope) {
    setScope(next);
    setConfirmed(false);
    setSelected(
      new Set(
        next === "one"
          ? [sourcePlay!.id]
          : source!.exact.map((play) => play.id),
      ),
    );
  }

  function chooseOutcome(next: CorrectionOutcome) {
    setOutcome(next);
    setConfirmed(false);
    // A win, loss or push depends on the line: drop picks at another line.
    if (next !== "VOID") {
      setSelected(
        (current) =>
          new Set([...current].filter((playId) => !relatedIds.has(playId))),
      );
    }
  }

  function toggle(playId: string, checked: boolean) {
    setConfirmed(false);
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(playId);
      else next.delete(playId);
      return next;
    });
  }

  const reasonReady = reason.trim().length >= CORRECTION_REASON_MIN;
  const canSubmit =
    plan.changedPlayCount > 0 && reasonReady && confirmed && !pending;

  function apply() {
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        const result = await applyBulkCorrectionAction({
          sourcePlayId: sourcePlay!.id,
          outcome,
          reason,
          confirmedPublicImpact: confirmed,
          targets: targets.map((play) => ({
            playId: play.id,
            expectedOutcome: play.outcome,
          })),
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(
          `${OUTCOME_LABEL[outcome]} applied to ${result.changedPlays} ${result.changedPlays === 1 ? "play" : "plays"} across ${result.cappersAffected} ${result.cappersAffected === 1 ? "capper" : "cappers"}` +
            (result.parlaysResettled
              ? `; ${result.parlaysResettled} ${result.parlaysResettled === 1 ? "parlay" : "parlays"} re-settled`
              : "") +
            (result.requestsResolved
              ? `; ${result.requestsResolved} ${result.requestsResolved === 1 ? "request" : "requests"} resolved`
              : "") +
            ".",
        );
        setReason("");
        setConfirmed(false);
        router.refresh();
      } catch {
        toast.error("The correction could not be saved. Try again.");
      }
    });
  }

  const changedEntries = [
    ...plan.straights.filter((entry) => entry.changed),
    ...plan.parlays.filter((entry) => entry.changed),
  ];

  return (
    <div className="border-border bg-card space-y-5 rounded-xl border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="bg-neg/15 text-neg flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Users className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold">
            Correct for one capper or every capper
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
            Set the correct result, then apply it to this pick only or to every
            capper who logged the same pick. Straight bets and parlays are
            re-settled together, in one save.
          </p>
        </div>
      </div>

      {kind === "parlay" ? (
        <div>
          <label
            htmlFor={sourceSelectId}
            className="mb-1.5 block text-sm font-medium"
          >
            Leg to correct
          </label>
          <select
            id={sourceSelectId}
            value={sourceId}
            onChange={(event) => chooseSource(event.target.value)}
            disabled={pending}
            className={SELECT_CLASS}
          >
            {sources.map((entry) => (
              <option key={entry.sourceId} value={entry.sourceId}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="border-border bg-surface-2 rounded-lg border p-3 text-sm">
        <p className="font-semibold break-words">
          {selectionWithMarket(sourcePlay)}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs break-words">
          {[sourcePlay.market, sourcePlay.sport, matchupLabel(sourcePlay)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div>
        <label htmlFor={outcomeId} className="mb-1.5 block text-sm font-medium">
          Correct result
        </label>
        <select
          id={outcomeId}
          value={outcome}
          onChange={(event) =>
            chooseOutcome(event.target.value as CorrectionOutcome)
          }
          disabled={pending}
          className={SELECT_CLASS}
        >
          {GRADEABLE_OUTCOMES.map((value) => (
            <option key={value} value={value}>
              {OUTCOME_LABEL[value]}
              {value === "VOID" ? " (injury protection / no action)" : ""}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium">Apply to</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              {
                value: "one" as const,
                title: `Only this pick (${sourcePlay.capperLabel})`,
                detail:
                  kind === "parlay"
                    ? "This leg on this ticket only."
                    : "This capper's play only.",
              },
              {
                value: "all" as const,
                title: `Every capper with this pick (${source.exact.length})`,
                detail:
                  otherCappers > 0
                    ? `Also ${otherCappers} other ${otherCappers === 1 ? "capper" : "cappers"} — straight bets and parlay legs.`
                    : "No other capper logged this exact pick.",
              },
            ] satisfies { value: Scope; title: string; detail: string }[]
          ).map((option) => (
            <label
              key={option.value}
              className={cn(
                "border-border flex min-h-10 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm",
                scope === option.value && "border-foreground/50 bg-surface-2",
              )}
            >
              <input
                type="radio"
                name={`scope-${source.sourceId}`}
                value={option.value}
                checked={scope === option.value}
                onChange={() => chooseScope(option.value)}
                disabled={pending}
                className="accent-primary mt-0.5 size-4 shrink-0"
              />
              <span>
                <span className="block font-medium">{option.title}</span>
                <span className="text-muted-foreground text-xs">
                  {option.detail}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <p className="text-sm font-medium">
          Same pick ({source.exact.length}) — {selected.size} selected
        </p>
        <ul className="divide-border border-border max-h-80 divide-y overflow-auto rounded-lg border">
          {source.exact.map((play, index) => (
            <CandidateRow
              key={play.id}
              play={play}
              checked={selected.has(play.id)}
              disabled={pending}
              onToggle={(checked) => toggle(play.id, checked)}
              showSelection={false}
              isSource={index === 0}
            />
          ))}
        </ul>
      </div>

      {source.related.length ? (
        <details className="space-y-2">
          <summary className="min-h-10 cursor-pointer text-sm font-medium">
            Same game, different line or side ({source.related.length})
          </summary>
          <p className="text-muted-foreground mt-2 text-xs">
            {outcome === "VOID"
              ? "A void can cover these too — tick any that the same ruling voids (for example every prop on an injured player)."
              : "Only a void can be applied to a pick at another line or side. Choose Void to select these."}
          </p>
          <ul className="divide-border border-border mt-2 max-h-80 divide-y overflow-auto rounded-lg border">
            {source.related.map((play) => (
              <CandidateRow
                key={play.id}
                play={play}
                checked={selected.has(play.id)}
                disabled={
                  pending || !outcomeAllowedForMatch(outcome, "related")
                }
                onToggle={(checked) => toggle(play.id, checked)}
                showSelection
                isSource={false}
              />
            ))}
          </ul>
        </details>
      ) : null}

      {source.truncated ? (
        <p className="text-neg text-xs">
          This game has an unusually large number of plays and the list may be
          incomplete. Correct in smaller batches and re-check.
        </p>
      ) : null}

      <div
        className="border-border bg-surface-2 space-y-2 rounded-lg border p-3"
        aria-live="polite"
      >
        <p className="text-sm font-semibold">Preview</p>
        {plan.changedPlayCount === 0 ? (
          <p className="text-muted-foreground text-sm">
            {selected.size === 0
              ? "Select at least one play."
              : `Every selected play is already ${OUTCOME_LABEL[outcome]} — nothing to change.`}
          </p>
        ) : (
          <>
            <p className="text-sm">
              {OUTCOME_LABEL[outcome]} on {plan.changedPlayCount}{" "}
              {plan.changedPlayCount === 1 ? "play" : "plays"} ·{" "}
              {plan.straights.filter((entry) => entry.changed).length} straight{" "}
              {plan.straights.filter((entry) => entry.changed).length === 1
                ? "bet"
                : "bets"}{" "}
              · {plan.parlays.filter((entry) => entry.changed).length}{" "}
              {plan.parlays.filter((entry) => entry.changed).length === 1
                ? "parlay"
                : "parlays"}{" "}
              re-settled · {plan.affectedCapperCount}{" "}
              {plan.affectedCapperCount === 1 ? "capper" : "cappers"} · net{" "}
              <span className="scl-data tabular-nums">
                {formatUnits(plan.profitDelta)}
              </span>
              {plan.unchangedPlayCount > 0
                ? ` · ${plan.unchangedPlayCount} already ${OUTCOME_LABEL[outcome]}`
                : ""}
            </p>
            <ul className="divide-border border-border bg-card max-h-72 divide-y overflow-auto rounded-lg border text-sm">
              {changedEntries.map((entry) => (
                <li
                  key={"playId" in entry ? entry.playId : entry.parlayId}
                  className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{entry.capperLabel}</span>{" "}
                    <span className="text-muted-foreground text-xs">
                      {"playId" in entry
                        ? "Straight bet"
                        : `${entry.legCount}-leg parlay · ${entry.legChanges.length} ${entry.legChanges.length === 1 ? "leg" : "legs"} → ${OUTCOME_LABEL[outcome]}`}
                    </span>
                  </span>
                  <SettlementPair before={entry.before} after={entry.after} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div>
        <label htmlFor={reasonId} className="mb-1.5 block text-sm font-medium">
          Correction reason
        </label>
        <textarea
          id={reasonId}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={280}
          rows={3}
          disabled={pending}
          aria-describedby={`${reasonId}-help`}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full resize-y rounded-lg border px-3 py-2 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
          placeholder="Source of truth — e.g. official stat correction, or injury protection: player left in the 1st quarter."
        />
        <p
          id={`${reasonId}-help`}
          className="text-muted-foreground mt-1 flex justify-between gap-3 text-xs"
        >
          <span>
            {`Minimum ${CORRECTION_REASON_MIN} characters. Saved on every play's audit history.`}
          </span>
          <span className="tabular-nums">{reason.length}/280</span>
        </p>
      </div>

      <label className="border-border bg-surface-2 flex min-h-10 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          disabled={pending}
          className="accent-primary mt-0.5 size-4 shrink-0"
        />
        <span>
          I confirm this correction should immediately update the public record,
          leaderboard, statistics and grading history of{" "}
          {plan.affectedCapperCount === 1
            ? "this capper"
            : `all ${plan.affectedCapperCount} cappers`}
          .
        </span>
      </label>

      <div className="border-neg/30 bg-neg/10 text-neg flex items-start gap-2 rounded-lg border p-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        All selected plays are saved together or not at all. Previous results,
        the administrator and the reason are kept in each play&apos;s audit
        history.
      </div>

      <Button
        type="button"
        variant="destructive"
        onClick={apply}
        disabled={!canSubmit}
        className="w-full sm:w-auto"
      >
        <Gavel className="size-4" />
        {pending
          ? "Applying correction…"
          : plan.changedPlayCount > 0
            ? `Apply to ${plan.changedPlayCount} ${plan.changedPlayCount === 1 ? "play" : "plays"}`
            : "Apply correction"}
      </Button>
    </div>
  );
}
