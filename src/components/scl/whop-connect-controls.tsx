import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";

export function WhopConnectControls({
  companyId,
  compact = false,
}: {
  companyId?: string | null;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mt-3 space-y-2" : "space-y-3"}>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="min-h-10"
          render={
            <a href="/api/whop/install" target="_blank" rel="noreferrer" />
          }
          nativeButton={false}
        >
          1. Install SCL on Whop
          <ExternalLink className="size-4" />
        </Button>
      </div>
      <form
        action="/api/whop/connect"
        method="get"
        className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className="flex-1 text-xs font-semibold">
          <span className="mb-1 block">2. Whop business ID</span>
          <input
            name="companyId"
            defaultValue={companyId ?? ""}
            required
            pattern="biz_[A-Za-z0-9]+"
            placeholder="biz_xxxxxxxxxxxxxx"
            autoComplete="off"
            className="border-border bg-background text-foreground placeholder:text-muted-foreground h-10 w-full rounded-md border px-3 font-mono text-sm"
            aria-describedby="whop-company-id-help"
          />
        </label>
        <Button type="submit" variant="outline" className="min-h-10">
          Connect Whop API
          <ExternalLink className="size-4" />
        </Button>
      </form>
      <p
        id="whop-company-id-help"
        className="text-muted-foreground max-w-xl text-xs leading-relaxed"
      >
        Find the ID in your Whop dashboard URL immediately after
        <span className="font-mono"> /dashboard/</span>. It starts with
        <span className="font-mono"> biz_</span>. SCL uses it to authorize the
        exact business you selected instead of a personal Whop account.
      </p>
    </div>
  );
}
