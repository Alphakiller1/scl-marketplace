"use client";

import { useState } from "react";
import type { Outcome } from "@prisma/client";
import { AlertTriangle, CheckCircle2, Gavel } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { StatusBadge } from "@/components/scl/badges";
import { Button } from "@/components/ui/button";
import { gradePlayAction } from "@/lib/actions/grading.action";
import { gradeParlayAction } from "@/lib/actions/parlay.action";
import { formatUnits } from "@/lib/format";
import {
  previewParlayCorrection,
  previewStraightCorrection,
  type SettlementSnapshot,
} from "@/lib/grading-correction";
import {
  CORRECTION_REASON_MIN,
  GRADEABLE_OUTCOMES,
} from "@/lib/schemas/grading.schema";

type GradeableOutcome = (typeof GRADEABLE_OUTCOMES)[number];

type StraightCorrectionProps = {
  kind: "straight";
  id: string;
  outcome: GradeableOutcome;
  profitUnits: number | null;
  oddsAmerican: number;
  units: number;
};

type ParlayCorrectionProps = {
  kind: "parlay";
  id: string;
  outcome: GradeableOutcome;
  profitUnits: number | null;
  units: number;
  legs: {
    id: string;
    selection: string;
    market: string;
    oddsAmerican: number;
    outcome: Outcome;
  }[];
};

type AdminGradeCorrectionProps =
  StraightCorrectionProps | ParlayCorrectionProps;

const OUTCOME_LABEL: Record<GradeableOutcome, string> = {
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
} as const satisfies Record<
  Outcome,
  "pending" | "win" | "loss" | "push" | "void"
>;

const SELECT_CLASS =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-11 w-full rounded-lg border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none";

function isGradeableOutcome(value: Outcome): value is GradeableOutcome {
  return value !== "PENDING";
}

function SettlementComparison({
  before,
  after,
}: {
  before: SettlementSnapshot;
  after: SettlementSnapshot;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="bg-surface-2 border-border rounded-lg border p-3">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          Current public result
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <StatusBadge status={OUTCOME_TO_STATUS[before.outcome]} />
          <span className="scl-data tabular-nums">
            {before.profitUnits == null
              ? "Open"
              : formatUnits(before.profitUnits)}
          </span>
        </div>
      </div>
      <div className="bg-surface-2 border-border rounded-lg border p-3">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          Result after correction
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <StatusBadge status={OUTCOME_TO_STATUS[after.outcome]} />
          <span className="scl-data tabular-nums">
            {after.profitUnits == null
              ? "Open"
              : formatUnits(after.profitUnits)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AdminGradeCorrection(props: AdminGradeCorrectionProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [straightOutcome, setStraightOutcome] = useState<GradeableOutcome>(
    props.outcome,
  );
  const [legOutcomes, setLegOutcomes] = useState<Record<string, Outcome>>(
    props.kind === "parlay"
      ? Object.fromEntries(props.legs.map((leg) => [leg.id, leg.outcome]))
      : {},
  );

  const current = {
    outcome: props.outcome,
    profitUnits: props.profitUnits,
  };
  const parlayPreview =
    props.kind === "parlay"
      ? previewParlayCorrection({
          current,
          units: props.units,
          legs: props.legs,
          nextOutcomes: legOutcomes,
        })
      : null;
  const preview =
    props.kind === "straight"
      ? previewStraightCorrection({
          current,
          nextOutcome: straightOutcome,
          oddsAmerican: props.oddsAmerican,
          units: props.units,
        })
      : parlayPreview!;
  const hasPendingLeg =
    props.kind === "parlay" &&
    props.legs.some((leg) => !isGradeableOutcome(legOutcomes[leg.id]));
  const reasonReady = reason.trim().length >= CORRECTION_REASON_MIN;
  const canSubmit =
    preview.changed && reasonReady && confirmed && !hasPendingLeg && !pending;

  async function applyCorrection() {
    if (!canSubmit) return;
    setPending(true);

    try {
      const result =
        props.kind === "straight"
          ? await gradePlayAction({
              playId: props.id,
              outcome: straightOutcome,
              reason,
              expectedOutcome: props.outcome,
              expectedProfitUnits: props.profitUnits,
              confirmedPublicImpact: confirmed,
            })
          : await gradeParlayAction({
              parlayId: props.id,
              reason,
              expectedOutcome: props.outcome,
              expectedProfitUnits: props.profitUnits,
              confirmedPublicImpact: confirmed,
              legs: props.legs.flatMap((leg) => {
                const outcome = legOutcomes[leg.id];
                return outcome && isGradeableOutcome(outcome)
                  ? [
                      {
                        playId: leg.id,
                        outcome,
                        expectedOutcome: leg.outcome,
                      },
                    ]
                  : [];
              }),
            });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Settlement corrected and audit history recorded.");
      router.refresh();
    } catch {
      toast.error("The correction could not be saved. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-border bg-card space-y-5 rounded-xl border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="bg-neg/15 text-neg flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Gavel className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold">Correct settled result</h2>
          <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
            Review the calculated change, document why it is needed, and confirm
            the public impact before saving.
          </p>
        </div>
      </div>

      {props.kind === "straight" ? (
        <div>
          <label
            htmlFor={`correct-outcome-${props.id}`}
            className="mb-1.5 block text-sm font-medium"
          >
            Correct outcome
          </label>
          <select
            id={`correct-outcome-${props.id}`}
            value={straightOutcome}
            onChange={(event) =>
              setStraightOutcome(event.target.value as GradeableOutcome)
            }
            disabled={pending}
            className={SELECT_CLASS}
          >
            {GRADEABLE_OUTCOMES.map((outcome) => (
              <option key={outcome} value={outcome}>
                {OUTCOME_LABEL[outcome]}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">
            Correct individual leg outcomes
          </legend>
          <div className="divide-border border-border divide-y overflow-hidden rounded-lg border">
            {props.legs.map((leg, index) => (
              <div
                key={leg.id}
                className="bg-surface-2 grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_8rem] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="font-medium break-words">
                    Leg {index + 1}: {leg.selection}
                  </p>
                  <p className="text-muted-foreground text-xs">{leg.market}</p>
                </div>
                <label className="grid gap-1 text-xs">
                  <span className="sr-only">Outcome for {leg.selection}</span>
                  <select
                    value={legOutcomes[leg.id]}
                    onChange={(event) =>
                      setLegOutcomes((currentOutcomes) => ({
                        ...currentOutcomes,
                        [leg.id]: event.target.value as Outcome,
                      }))
                    }
                    disabled={pending}
                    className={SELECT_CLASS}
                  >
                    {leg.outcome === "PENDING" ? (
                      <option value="PENDING" disabled>
                        Pending — select result
                      </option>
                    ) : null}
                    {GRADEABLE_OUTCOMES.map((outcome) => (
                      <option key={outcome} value={outcome}>
                        {OUTCOME_LABEL[outcome]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
        </fieldset>
      )}

      <SettlementComparison before={preview.before} after={preview.after} />

      {parlayPreview ? (
        <p className="text-muted-foreground text-xs">
          {parlayPreview.changedLegCount} changed{" "}
          {parlayPreview.changedLegCount === 1 ? "leg" : "legs"}; parent
          settlement is recalculated from every leg.
        </p>
      ) : null}

      {!preview.changed ? (
        <div className="border-border bg-surface-2 flex items-start gap-2 rounded-lg border p-3 text-sm">
          <CheckCircle2
            className="text-pos mt-0.5 size-4 shrink-0"
            aria-hidden
          />
          The selected result already matches the stored outcome and profit.
        </div>
      ) : null}

      <div>
        <label
          htmlFor={`correction-reason-${props.id}`}
          className="mb-1.5 block text-sm font-medium"
        >
          Correction reason
        </label>
        <textarea
          id={`correction-reason-${props.id}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={280}
          rows={4}
          disabled={pending}
          aria-describedby={`correction-reason-help-${props.id}`}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 w-full resize-y rounded-lg border px-3 py-2 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
          placeholder="Explain the source of truth and why the existing settlement is wrong."
        />
        <p
          id={`correction-reason-help-${props.id}`}
          className="text-muted-foreground mt-1 flex justify-between gap-3 text-xs"
        >
          <span>Minimum {CORRECTION_REASON_MIN} characters.</span>
          <span className="tabular-nums">{reason.length}/280</span>
        </p>
      </div>

      <label className="border-border bg-surface-2 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          disabled={pending}
          className="accent-primary mt-0.5 size-4 shrink-0"
        />
        <span>
          I confirm this correction should immediately update the public record,
          leaderboard, capper statistics, and grading history.
        </span>
      </label>

      <div className="border-neg/30 bg-neg/10 text-neg flex items-start gap-2 rounded-lg border p-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        This does not erase the previous result. SCL preserves both values,
        administrator identity, timestamp, and reason in the audit history.
      </div>

      <Button
        type="button"
        variant="destructive"
        onClick={applyCorrection}
        disabled={!canSubmit}
        className="w-full sm:w-auto"
      >
        <Gavel className="size-4" />
        {pending ? "Applying correction…" : "Apply correction"}
      </Button>
    </div>
  );
}
