"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { runStorefrontHealthCheckAction } from "@/lib/actions/admin-storefront-health.action";

export function StorefrontHealthPanel({
  preview,
}: {
  preview: Array<{
    capperProfileId: string;
    handle: string;
    email: string;
    issues: string[];
  }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function runCheck() {
    setPending(true);
    const result = await runStorefrontHealthCheckAction();
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Flagged ${result.updated} storefront(s) with ${result.flagged} issue set(s)`,
    );
    router.refresh();
  }

  return (
    <div className="border-border bg-card space-y-4 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="text-brand mt-0.5 size-5 shrink-0" />
        <div>
          <h3 className="font-semibold">Storefront health scan</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Flags stale reviews, missing checkout links, missing tracking
            redirects, and live packages with zero clicks after 14 days.
          </p>
        </div>
      </div>

      {preview.length ? (
        <div className="divide-border divide-y rounded-lg border">
          {preview.slice(0, 8).map((row) => (
            <article
              key={row.capperProfileId}
              className="space-y-1 p-3 text-sm"
            >
              <p className="font-semibold">{row.handle}</p>
              <ul className="text-muted-foreground list-disc pl-4">
                {row.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No storefront health issues detected right now.
        </p>
      )}

      <Button type="button" disabled={pending} onClick={() => void runCheck()}>
        Run health check and flag storefronts
      </Button>
    </div>
  );
}
