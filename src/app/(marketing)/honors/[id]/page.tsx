import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getHonorAwardById } from "@/lib/queries/honors";

type PageProps = { params: Promise<{ id: string }> };

async function loadAward(params: PageProps["params"]) {
  const { id } = await params;
  return getHonorAwardById(decodeURIComponent(id));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const award = await loadAward(params);
  if (!award) return { title: "SCL Honors" };
  const image = `/api/og/honor/${award.id}`;
  const title = `${award.name} — @${award.winner.handle}`;
  return {
    title,
    description: `SCL Honors: ${award.name}, awarded to @${award.winner.handle}.`,
    openGraph: {
      title,
      images: [{ url: image, width: 1080, height: 1350 }],
    },
    twitter: { card: "summary_large_image", title, images: [image] },
  };
}

/** Shareable 4:5 award graphic, with a download for social posts. */
export default async function ShareableHonorPage({ params }: PageProps) {
  const award = await loadAward(params);
  if (!award) notFound();
  const image = `/api/og/honor/${award.id}`;
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-8">
      <h1 className="sr-only">{award.name}</h1>
      {/* The graphic is generated server-side; a plain img keeps it a PNG. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        width={1080}
        height={1350}
        alt={`${award.name}, awarded to @${award.winner.handle}`}
        className="border-border aspect-[4/5] h-auto w-full rounded-2xl border shadow-xl"
      />
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          render={<a href={`${image}?download=1`} download />}
          nativeButton={false}
          className="min-h-10"
        >
          <Download className="size-4" aria-hidden />
          Download graphic
        </Button>
        <Button
          render={<Link href={`/cappers/${award.winner.handle}`} />}
          nativeButton={false}
          variant="outline"
          className="min-h-10"
        >
          View @{award.winner.handle}
        </Button>
      </div>
    </main>
  );
}
