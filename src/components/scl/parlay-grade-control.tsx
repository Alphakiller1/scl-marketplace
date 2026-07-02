"use client";

import { useState } from "react";
import { Gavel } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SportTag } from "@/components/scl/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { gradeParlayAction } from "@/lib/actions/parlay.action";
import { formatOdds } from "@/lib/format";
import type { ParlayQueueItem } from "@/lib/queries/grading";
import { GRADEABLE_OUTCOMES } from "@/lib/schemas/grading.schema";

type Gradeable = (typeof GRADEABLE_OUTCOMES)[number];

const OUTCOME_LABEL: Record<Gradeable, string> = {
  WIN: "Win",
  LOSS: "Loss",
  PUSH: "Push",
  VOID: "Void",
};

const SELECT_CLASS =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-24 shrink-0 rounded-lg border bg-transparent px-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none";

/** Grade a parlay by assigning each leg an outcome; the parlay settles from the legs. */
export function ParlayGradeControl({ parlay }: { parlay: ParlayQueueItem }) {
  const router = useRouter();
  const [grades, setGrades] = useState<Record<string, Gradeable | "">>({});
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function grade() {
    const legs = Object.entries(grades)
      .filter(([, o]) => o !== "")
      .map(([playId, outcome]) => ({ playId, outcome: outcome as Gradeable }));
    if (legs.length === 0) {
      toast.error("Grade at least one leg.");
      return;
    }
    setPending(true);
    const result = await gradeParlayAction({
      parlayId: parlay.id,
      legs,
      reason,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Parlay graded.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <ul className="divide-border divide-y">
        {parlay.legs.map((leg, i) => (
          <li
            key={leg.id}
            className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <SportTag sport={leg.sport} />
                <span className="text-muted-foreground text-xs">
                  Leg {i + 1}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium break-words">
                {leg.selection}
              </p>
              <p className="text-muted-foreground text-xs">
                {leg.market} ·{" "}
                <span className="nums tabular-nums">
                  {formatOdds(leg.oddsAmerican)}
                </span>
              </p>
            </div>
            <select
              aria-label={`Result for leg ${i + 1}`}
              value={grades[leg.id] ?? ""}
              disabled={pending}
              onChange={(e) =>
                setGrades((g) => ({
                  ...g,
                  [leg.id]: e.target.value as Gradeable | "",
                }))
              }
              className={SELECT_CLASS}
            >
              <option value="">Result…</option>
              {GRADEABLE_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_LABEL[o]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor={`parlay-reason-${parlay.id}`}>
          Reason
        </label>
        <Input
          id={`parlay-reason-${parlay.id}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required)"
          disabled={pending}
          className="h-10 sm:max-w-72"
        />
        <Button
          type="button"
          onClick={grade}
          disabled={pending}
          className="shrink-0"
        >
          <Gavel className="size-4" />
          {pending ? "Grading…" : "Grade parlay"}
        </Button>
      </div>
    </div>
  );
}
