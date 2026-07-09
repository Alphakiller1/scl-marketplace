"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { runAutoGradeAction } from "@/lib/actions/auto-grade.action";

/** Admin control: run the auto-grader over pending positions. */
export function AutoGradeButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    const result = await runAutoGradeAction();
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.graded === 0) {
      toast.info(
        result.skipped === 0
          ? "No pending positions to grade."
          : `Nothing auto-gradable yet — ${result.skipped} left for manual review.`,
      );
    } else {
      toast.success(
        `Auto-graded ${result.graded} · ${result.skipped} left for manual review.`,
      );
    }
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={run}
      disabled={pending}
      className="shrink-0"
    >
      <Wand2 className="size-4" />
      {pending ? "Grading…" : "Run auto-grade"}
    </Button>
  );
}
