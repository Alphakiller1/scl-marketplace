import type { Metadata } from "next";
import Link from "next/link";
import { PackageOpen } from "lucide-react";

import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Packages",
  description: "Browse approved capper packages published through SCL.",
};

export default function PackagesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <SectionHeader
        icon={PackageOpen}
        title="Packages"
        subtitle="Approved capper offers published through SCL"
      />

      <EmptyState
        className="mt-6"
        icon={PackageOpen}
        title="No packages live yet"
        description="Approved offers will appear here. Browse capper profiles to review tracked records and storefront details."
        action={
          <Button render={<Link href="/cappers" />} size="sm">
            Browse cappers
          </Button>
        }
      />
    </div>
  );
}
