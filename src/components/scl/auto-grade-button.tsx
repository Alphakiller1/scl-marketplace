"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { runAutoGradeAction } from "@/lib/actions/auto-grade.action";

/** Admin backup: force-settle completed events the cron stack may have missed. */
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
          ? "No pending plays to grade."
          : `No completed event could be settled — ${result.skipped} still need a final or a market we don't auto-grade.`,
      );
    } else {
      toast.success(
        `Force-graded ${result.graded} completed event${result.graded === 1 ? "" : "s"} · ${result.skipped} still pending.`,
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
      {pending ? "Grading…" : "Grade completed"}
    </Button>
  );
}
