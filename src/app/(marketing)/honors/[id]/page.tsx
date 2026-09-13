import { notFound } from "next/navigation";
import Link from "next/link";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";
import { getHonorAwardById } from "@/lib/queries/honors";

export default async function ShareableHonorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const award = await getHonorAwardById(id);
  if (!award) notFound();
  const result =
    award.metric === "units"
      ? formatUnits(award.winner.units)
      : formatRoi(award.winner.roi);
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-10">
      <article className="scl-card-gradient border-border w-full rounded-2xl border p-6 text-center shadow-xl sm:p-10">
        <span className="text-5xl" aria-hidden>
          {award.icon}
        </span>
        <p className="scl-eyebrow mt-4">{award.abbreviation}</p>
        <h1 className="scl-display mt-2 text-3xl font-bold sm:text-5xl">
          {award.name}
        </h1>
        <p className="text-muted-foreground mt-2">
          {award.sport} · {award.period} · minimum {award.minimumPicks} picks
        </p>
        <Link
          href={`/cappers/${award.winner.handle}`}
          className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-xl"
        >
          <CapperAvatar
            name={award.winner.name}
            src={award.winner.avatarUrl}
            size="lg"
          />
          <span className="text-left">
            <span className="block text-lg font-bold">
              @{award.winner.handle}
            </span>
            <span className="text-pos scl-data block font-bold tabular-nums">
              {result}
            </span>
            <span className="text-muted-foreground scl-data block text-sm tabular-nums">
              {formatRecord(
                award.winner.record.w,
                award.winner.record.l,
                award.winner.record.p,
              )}
            </span>
          </span>
        </Link>
        <p className="text-muted-foreground mt-8 text-xs">
          SCL Honors · results use settled leaderboard positions
        </p>
      </article>
    </main>
  );
}
