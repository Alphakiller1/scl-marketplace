import { ClipboardList } from "lucide-react";

import { EmptyState } from "@/components/scl/states";
import { SectionHeader } from "@/components/scl/section";

export const metadata = { title: "My Picks" };

export default function MyPicksPage() {
  return (
    <div className="space-y-4">
      <SectionHeader title="My Picks" subtitle="Your submitted plays" />
      <EmptyState
        icon={ClipboardList}
        title="No plays yet"
        description="Manual and bulk play entry land in an upcoming feature."
      />
    </div>
  );
}
