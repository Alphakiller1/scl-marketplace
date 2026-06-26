import type { Metadata } from "next";
import { Zap } from "lucide-react";

import { SectionHeader } from "@/components/scl/section";
import { PickCard } from "@/components/scl/pick-card";
import { MOCK_TODAY_PICKS } from "@/lib/mock";

export const metadata: Metadata = {
  title: "Today's Picks",
  description: "Live and pending plays from ranked sports cappers.",
};

export default function PicksPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <SectionHeader
        icon={Zap}
        title="Today's picks"
        subtitle="Live and pending plays from ranked cappers (preview data)"
      />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MOCK_TODAY_PICKS.map((p) => (
          <PickCard key={p.id} pick={p} />
        ))}
      </div>
    </div>
  );
}
