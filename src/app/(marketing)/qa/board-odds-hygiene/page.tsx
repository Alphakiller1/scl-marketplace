import { notFound } from "next/navigation";

import { QaBoardOddsHygiene } from "@/components/scl/qa-board-odds-hygiene";

/**
 * Local / Claude visual-gate fixture for board odds hygiene (PR #224).
 * Production 404 unless ALLOW_QA_SHOTS=1 (never linked from nav).
 * Seeded in-component — no Odds API fetch, no public DB writes.
 */
export default function BoardOddsHygieneQaPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_QA_SHOTS !== "1"
  ) {
    notFound();
  }

  return (
    <div className="overflow-x-hidden pb-10 sm:pb-12" data-visual-mode="proof">
      <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
        <QaBoardOddsHygiene />
      </div>
    </div>
  );
}
