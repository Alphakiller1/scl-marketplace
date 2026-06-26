import type { Metadata } from "next";
import { Users } from "lucide-react";

import { SectionHeader } from "@/components/scl/section";
import { CapperCard } from "@/components/scl/capper-card";
import { MOCK_CAPPERS } from "@/lib/mock";

export const metadata: Metadata = {
  title: "Cappers",
  description:
    "Discover verified sports handicappers by record, ROI, and form.",
};

export default function CappersPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <SectionHeader
        icon={Users}
        title="Cappers"
        subtitle="Discover verified handicappers (preview data)"
      />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_CAPPERS.map((c) => (
          <CapperCard key={c.id} capper={c} />
        ))}
      </div>
    </div>
  );
}
