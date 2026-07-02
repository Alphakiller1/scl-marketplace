"use client";

import { useState } from "react";
import { Gavel } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { gradePlayAction } from "@/lib/actions/grading.action";
import { GRADEABLE_OUTCOMES } from "@/lib/schemas/grading.schema";

type Gradeable = (typeof GRADEABLE_OUTCOMES)[number];

const OUTCOME_LABEL: Record<Gradeable, string> = {
  WIN: "Win",
  LOSS: "Loss",
  PUSH: "Push",
  VOID: "Void",
};

/** Admin control: assign a WIN/LOSS/PUSH/VOID result to a pending play, with reason. */
export function PlayGradeControl({ playId }: { playId: string }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Gradeable | "">("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function grade() {
    if (!outcome) {
      toast.error("Select an outcome to grade.");
      return;
    }
    setPending(true);
    const result = await gradePlayAction({ playId, outcome, reason });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Play graded.");
    setOutcome("");
    setReason("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="sr-only" htmlFor={`outcome-${playId}`}>
        Outcome
      </label>
      <select
        id={`outcome-${playId}`}
        value={outcome}
        onChange={(e) => setOutcome(e.target.value as Gradeable | "")}
        disabled={pending}
        className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-lg border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none sm:w-28"
      >
        <option value="" disabled>
          Result…
        </option>
        {GRADEABLE_OUTCOMES.map((o) => (
          <option key={o} value={o}>
            {OUTCOME_LABEL[o]}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`reason-${playId}`}>
        Reason
      </label>
      <Input
        id={`reason-${playId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
        disabled={pending}
        className="h-10 sm:max-w-56"
      />
      <Button
        type="button"
        onClick={grade}
        disabled={pending || !outcome}
        className="shrink-0"
      >
        <Gavel className="size-4" />
        {pending ? "Grading…" : "Grade"}
      </Button>
    </div>
  );
}
