import { notFound } from "next/navigation";

import { LiveActivityTicker } from "@/components/scl/live-activity-ticker";
import type { LiveTickerItem } from "@/lib/queries/live-activity-ticker";

/**
 * Local / Claude visual-gate fixture for the live activity ticker at 375px,
 * where the label and the marquee compete for one row.
 * Production 404 unless ALLOW_QA_SHOTS=1 (never linked from nav). Seeded
 * in-component — no DB read.
 */
const ITEMS: LiveTickerItem[] = [
  {
    id: "qa-1",
    kind: "win",
    handle: "bankofdennis",
    sport: "NBA",
    at: "2026-08-05T18:00:00.000Z",
    profitUnits: 4.55,
  },
  {
    id: "qa-2",
    kind: "clv",
    handle: "mlbanalyticspro",
    sport: "MLB",
    at: "2026-08-05T17:40:00.000Z",
    clvPts: 1.5,
  },
  {
    id: "qa-3",
    kind: "posted",
    handle: "clownsportspick",
    sport: "NFL",
    at: "2026-08-05T17:20:00.000Z",
  },
  {
    id: "qa-4",
    kind: "win",
    handle: "wgsdfs",
    sport: "NHL",
    at: "2026-08-05T17:00:00.000Z",
    profitUnits: 2.1,
  },
];

export default function LiveTickerQaPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_QA_SHOTS !== "1"
  ) {
    notFound();
  }

  return (
    <div className="overflow-x-hidden pb-10" data-visual-mode="proof">
      <LiveActivityTicker items={ITEMS} />
      <div className="mt-8">
        <LiveActivityTicker items={[]} />
      </div>
    </div>
  );
}
