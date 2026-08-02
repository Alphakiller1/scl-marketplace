import type { StoreConnectionStatus, StoreProvider } from "@prisma/client";

import { ProviderBadge } from "@/components/scl/provider-badge";
import { StoreStatusChip } from "@/components/scl/store-status-chip";
import { isPendingStoreStatus, providerLabel } from "@/lib/store-connection";
import { cn } from "@/lib/utils";

function timeline(
  provider: StoreProvider,
  status: StoreConnectionStatus,
): { label: string; state: "done" | "current" | "todo" }[] {
  const steps =
    provider === "WHOP"
      ? [
          "Choose Whop and review the connection process",
          "Add Sports Cappers Leaderboard as an affiliate on Whop",
          "SCL verifies the connection and manually adds the approved package links",
          "Your packages go live on your SCL profile",
        ]
      : [
          "Choose Winible and review the connection process",
          "Complete the Winible affiliate setup",
          "SCL verifies the connection and manually adds the approved package links",
          "Your packages go live on your SCL profile",
        ];

  let current = 0;
  if (status === "INSTRUCTIONS_VIEWED") current = 1;
  else if (isPendingStoreStatus(status)) current = 2;
  else if (status === "LINKS_RECEIVED" || status === "PACKAGES_IMPORTED")
    current = 3;
  else if (status === "LIVE") current = 4;
  else if (status === "NEEDS_ACTION" || status === "DISABLED") current = 2;

  return steps.map((label, i) => ({
    label,
    state: i < current ? "done" : i === current ? "current" : "todo",
  }));
}

function messageFor(
  provider: StoreProvider,
  status: StoreConnectionStatus,
): { title: string; body: string } {
  if (status === "LIVE") {
    return {
      title: `Your ${providerLabel(provider)} storefront is live`,
      body: "Your packages are visible on your SCL profile. Fans leave SCL to check out on your storefront.",
    };
  }
  if (status === "PENDING_SCL_ACCEPTANCE") {
    return {
      title: "Affiliate request submitted",
      body: "Thanks for submitting your Winible affiliate request. Our team will verify the relationship, review the package details available in Winible, manually add the approved links to SCL, and contact you if anything else is needed.",
    };
  }
  if (status === "PENDING_SCL_LINK_IMPORT") {
    return {
      title: "Pending SCL review",
      body: "Thanks — you’ve added SCL as an affiliate on Whop. SCL will verify the relationship, review the package details available in Whop, and manually publish the approved links on your profile. No further action is required unless we contact you.",
    };
  }
  if (status === "NEEDS_ACTION") {
    return {
      title: "Storefront needs attention",
      body: "There’s an issue with this store connection. SCL will contact you with next steps.",
    };
  }
  if (status === "DISABLED") {
    return {
      title: "Storefront suspended",
      body: "This storefront and its packages are not publicly available on SCL. Contact SCL to resolve the review issue before it can be restored.",
    };
  }
  if (status === "LINKS_RECEIVED" || status === "PACKAGES_IMPORTED") {
    return {
      title: "Storefront approved",
      body: "SCL has approved the connection and is completing its package review. The storefront will appear publicly only after the final live approval.",
    };
  }
  return {
    title: "Storefront setup",
    body: "Connect a storefront so fans can purchase your packages from your SCL profile.",
  };
}

export function StoreStatusPanel({
  provider,
  status,
  className,
}: {
  provider: StoreProvider;
  status: StoreConnectionStatus;
  className?: string;
}) {
  const copy = messageFor(provider, status);
  const steps = timeline(provider, status);
  const pending = isPendingStoreStatus(status);

  return (
    <section
      className={cn(
        "border-border bg-card rounded-xl border p-5",
        pending && "border-amber-500/35",
        status === "LIVE" && "border-pos/35",
        (status === "NEEDS_ACTION" || status === "DISABLED") && "border-neg/35",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StoreStatusChip status={status} />
        <ProviderBadge provider={provider} />
      </div>
      <h2 className="scl-display mt-3 text-lg font-semibold tracking-[0.02em] normal-case">
        {copy.title}
      </h2>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
        {copy.body}
      </p>
      <ol className="mt-4 space-y-2.5">
        {steps.map((step) => (
          <li key={step.label} className="flex gap-2.5 text-sm">
            <span
              className={cn(
                "mt-1.5 size-2.5 shrink-0 rounded-full",
                step.state === "done" && "bg-pos",
                step.state === "current" &&
                  "bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.25)]",
                step.state === "todo" && "bg-border",
              )}
              aria-hidden
            />
            <span
              className={cn(
                step.state === "todo"
                  ? "text-muted-foreground"
                  : "text-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
