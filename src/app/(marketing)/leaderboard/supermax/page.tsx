import Link from "next/link";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";
import { getSupermaxLeaderboard } from "@/lib/queries/supermax";

export const metadata = { title: "Supermax Leaderboard" };
export default async function SupermaxLeaderboardPage() {
  const rows = await getSupermaxLeaderboard();
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <p className="scl-eyebrow">One 20u straight per day</p>
      <h1 className="scl-page-title">Supermax Leaderboard</h1>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
        A separate view of Supermax record, units, ROI, and win percentage.
        Every play remains attributed to its sport and is counted only once
        overall.
      </p>
      <div className="mt-6 space-y-2">
        {rows.length ? (
          rows.map((row, index) => (
            <article
              key={row.capperId}
              className="border-border bg-card grid grid-cols-[auto_1fr] gap-3 rounded-xl border p-3 sm:grid-cols-[auto_minmax(0,1fr)_repeat(4,minmax(5rem,auto))] sm:items-center"
            >
              <span className="scl-data font-bold tabular-nums">
                #{index + 1}
              </span>
              <Link
                href={`/cappers/${row.handle}`}
                className="flex min-h-10 items-center gap-2 font-semibold"
              >
                <CapperAvatar name={row.handle} src={row.avatarUrl} size="sm" />
                @{row.handle}
              </Link>
              {[
                ["Record", formatRecord(row.wins, row.losses, row.pushes)],
                ["Units", formatUnits(row.units)],
                ["ROI", formatRoi(row.roi)],
                ["Win%", `${row.winPct.toFixed(1)}%`],
              ].map(([label, value]) => (
                <div key={label} className="text-right">
                  <span className="text-muted-foreground block text-[0.65rem] uppercase">
                    {label}
                  </span>
                  <span className="scl-data font-bold tabular-nums">
                    {value}
                  </span>
                </div>
              ))}
            </article>
          ))
        ) : (
          <p className="border-border bg-card text-muted-foreground rounded-xl border p-5 text-sm">
            No graded Supermax plays yet.
          </p>
        )}
      </div>
    </main>
  );
}
