"use client";

import { useMemo, useState, useTransition } from "react";
import type { StoreConnection, StoreProvider } from "@prisma/client";
import { toast } from "sonner";

import { StoreStatusPanel } from "@/components/scl/store-status-panel";
import { ProviderBadge } from "@/components/scl/provider-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  markInstructionsViewedAction,
  submitStoreConnectionAction,
} from "@/lib/actions/store.action";
import {
  SCL_AFFILIATE_EMAIL,
  WINIBLE_INVITE_VALUES,
  isPendingStoreStatus,
  providerLabel,
} from "@/lib/store-connection";
import { cn } from "@/lib/utils";

const STEPS = [
  "Choose platform",
  "Why affiliate",
  "Setup steps",
  "Confirm",
  "Status",
] as const;

type Conn = Pick<
  StoreConnection,
  "id" | "provider" | "status" | "packageImportStatus" | "submittedAt"
>;

export function MonetizationWizard({ connections }: { connections: Conn[] }) {
  const active =
    connections.find(
      (c) =>
        c.status !== "DISABLED" &&
        c.status !== "NOT_STARTED" &&
        c.status !== "INSTRUCTIONS_VIEWED",
    ) ||
    connections.find((c) => c.status === "INSTRUCTIONS_VIEWED") ||
    null;

  const [step, setStep] = useState(() =>
    active &&
    (isPendingStoreStatus(active.status) ||
      active.status === "LIVE" ||
      active.status === "NEEDS_ACTION" ||
      active.status === "LINKS_RECEIVED" ||
      active.status === "PACKAGES_IMPORTED")
      ? 4
      : 0,
  );
  const [provider, setProvider] = useState<StoreProvider | "NONE" | null>(
    active?.provider ?? null,
  );
  const [ack, setAck] = useState(false);
  const [connection, setConnection] = useState<Conn | null>(active);
  const [pending, startTransition] = useTransition();

  const showStatus =
    connection &&
    (step >= 4 ||
      isPendingStoreStatus(connection.status) ||
      connection.status === "LIVE" ||
      connection.status === "NEEDS_ACTION" ||
      connection.status === "LINKS_RECEIVED" ||
      connection.status === "PACKAGES_IMPORTED");

  const ackCopy = useMemo(() => {
    if (provider === "WHOP") {
      return `I understand that connecting my Whop store to SCL requires adding Sports Cappers Leaderboard (${SCL_AFFILIATE_EMAIL}) as an affiliate on Whop. I understand that Whop controls its own affiliate attribution and commission rules, and that SCL will use product-specific affiliate links from our Whop dashboard on my SCL profile and package pages.`;
    }
    return `I understand that connecting my Winible store to SCL requires designating Sports Cappers Leaderboard as an affiliate partner in Winible. I understand that Winible controls its own affiliate attribution and commission rules, and that SCL will use the affiliate links provided by Winible on my SCL profile and package pages.`;
  }, [provider]);

  function continueFromChooser() {
    if (!provider || provider === "NONE") return;
    startTransition(async () => {
      const res = await markInstructionsViewedAction({ provider });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStep(1);
    });
  }

  function submit() {
    if (!provider || provider === "NONE" || !ack) return;
    startTransition(async () => {
      const res = await submitStoreConnectionAction({
        provider,
        acknowledged: true,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Store setup submitted to SCL");
      setConnection({
        id: connection?.id || "local",
        provider,
        status:
          provider === "WHOP"
            ? "PENDING_SCL_LINK_IMPORT"
            : "PENDING_SCL_ACCEPTANCE",
        packageImportStatus: "NOT_STARTED",
        submittedAt: new Date(),
      });
      setStep(4);
    });
  }

  return (
    <div className="space-y-5">
      <nav
        className="border-border flex flex-wrap gap-x-4 gap-y-2 border-b pb-4"
        aria-label="Setup progress"
      >
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-2 text-xs font-semibold tracking-wide uppercase",
              i === step
                ? "text-foreground"
                : i < step
                  ? "text-foreground"
                  : "text-muted-foreground",
            )}
          >
            <span className="flex size-5 items-center justify-center rounded-full border border-current text-[0.65rem]">
              {i + 1}
            </span>
            {label}
          </div>
        ))}
      </nav>

      {showStatus && connection ? (
        <StoreStatusPanel
          provider={connection.provider}
          status={connection.status}
        />
      ) : null}

      {!showStatus && step === 0 ? (
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="scl-display text-base font-bold tracking-[0.05em] uppercase">
              Do you have a current operating platform?
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Winible and Whop share one framework — only instructions and
              pending status differ.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                [
                  "WINIBLE",
                  "Winible",
                  "Invite SCL as an affiliate. SCL accepts via email, then imports package links.",
                ],
                [
                  "WHOP",
                  "Whop",
                  "Add SCL as an affiliate. Whop may email SCL; package links appear in our Whop dashboard either way.",
                ],
                [
                  "NONE",
                  "None",
                  "Start selling through Winible with SCL’s referral path.",
                ],
              ] as const
            ).map(([id, title, body]) => (
              <button
                key={id}
                type="button"
                onClick={() => setProvider(id)}
                aria-pressed={provider === id}
                className={cn(
                  "border-border bg-surface-2 rounded-xl border p-4 text-left transition-colors",
                  provider === id && "border-brand ring-brand/30 ring-2",
                )}
              >
                <p className="font-semibold">{title}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {body}
                </p>
              </button>
            ))}
          </div>
          {provider === "NONE" ? (
            <div className="border-border bg-surface-2 rounded-lg border p-4 text-sm">
              <p className="font-semibold">Start Selling Through Winible</p>
              <p className="text-muted-foreground mt-1">
                Create a Winible storefront, then return here and choose Winible
                to connect SCL as an affiliate.
              </p>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-xs">
              You will not paste affiliate links into SCL.
            </p>
            <Button
              className="min-h-11"
              disabled={!provider || provider === "NONE" || pending}
              onClick={continueFromChooser}
            >
              Continue
            </Button>
          </div>
        </Card>
      ) : null}

      {!showStatus && step === 1 ? (
        <Card className="space-y-4 p-5">
          <h2 className="scl-display text-base font-bold tracking-[0.05em] uppercase">
            Why SCL uses an affiliate model
          </h2>
          <div className="border-brand/30 bg-brand/10 space-y-2 rounded-lg border p-4 text-sm leading-relaxed">
            <p>
              Sports Cappers Leaderboard is free for creators. Rather than
              charging monthly platform fees, SCL is supported through affiliate
              relationships with approved third-party storefront platforms.
            </p>
            <p>
              When you connect your storefront, you designate Sports Cappers
              Leaderboard as an affiliate partner. SCL only receives
              compensation when a transaction is attributed to SCL under that
              platform’s affiliate program.
            </p>
            <p>
              Attribution rules, cookies, windows, and recurring commission
              policies are controlled by the third-party platform—not by SCL.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setStep(0)}
            >
              Back
            </Button>
            <Button className="min-h-11" onClick={() => setStep(2)}>
              Continue to setup steps
            </Button>
          </div>
        </Card>
      ) : null}

      {!showStatus && step === 2 && provider && provider !== "NONE" ? (
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="scl-display text-base font-bold tracking-[0.05em] uppercase">
              {providerLabel(provider)} setup
            </h2>
            <ProviderBadge provider={provider} />
          </div>

          {provider === "WHOP" ? (
            <div className="space-y-3 text-sm">
              <p className="border-border bg-surface-2 rounded-lg border p-3 leading-relaxed">
                Whop may send SCL an affiliate notification email in some cases.
                Either way, once the relationship is established our Whop
                dashboard shows affiliate percentage, individual package links,
                checkout links, and the company storefront — enough to manage
                Whop packages the same way as Winible.
              </p>
              <ol className="space-y-3">
                <li className="border-border rounded-lg border p-3">
                  <p className="font-semibold">1. Add SCL as an affiliate</p>
                  <p className="text-muted-foreground mt-1">
                    Add <strong>Sports Cappers Leaderboard</strong> using{" "}
                    <strong>{SCL_AFFILIATE_EMAIL}</strong>.
                  </p>
                </li>
                <li className="border-border rounded-lg border p-3">
                  <p className="font-semibold">
                    2. Prefer product-specific links
                  </p>
                  <p className="text-muted-foreground mt-1">
                    SCL will copy product-specific affiliate links so each
                    package maps to the correct Whop product.
                  </p>
                </li>
                <li className="border-border rounded-lg border p-3">
                  <p className="font-semibold">3. Recurring commissions</p>
                  <p className="text-muted-foreground mt-1">
                    When available, configure recurring commissions rather than
                    first payment only.
                  </p>
                </li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <ol className="space-y-3">
                <li className="border-border rounded-lg border p-3">
                  <p className="font-semibold">1. Open Affiliates</p>
                  <p className="text-muted-foreground mt-1">
                    In Winible, open <strong>Affiliates</strong> in the
                    left-hand menu.
                  </p>
                </li>
                <li className="border-border rounded-lg border p-3">
                  <p className="font-semibold">2. Invite Affiliate</p>
                  <p className="text-muted-foreground mt-1">
                    Under the Affiliate tab, click{" "}
                    <strong>Invite Affiliate</strong>.
                  </p>
                </li>
                <li className="border-border rounded-lg border p-3">
                  <p className="font-semibold">3. Use SCL form values</p>
                  <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                    <div className="border-border bg-surface-2 rounded-md border px-2 py-1.5">
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="font-mono">
                        {WINIBLE_INVITE_VALUES.email}
                      </dd>
                    </div>
                    <div className="border-border bg-surface-2 rounded-md border px-2 py-1.5">
                      <dt className="text-muted-foreground">Reward Type</dt>
                      <dd>{WINIBLE_INVITE_VALUES.rewardType}</dd>
                    </div>
                    <div className="border-border bg-surface-2 rounded-md border px-2 py-1.5">
                      <dt className="text-muted-foreground">Reward Amount</dt>
                      <dd>{WINIBLE_INVITE_VALUES.rewardAmount}</dd>
                    </div>
                    <div className="border-border bg-surface-2 rounded-md border px-2 py-1.5">
                      <dt className="text-muted-foreground">Plans</dt>
                      <dd>{WINIBLE_INVITE_VALUES.plans}</dd>
                    </div>
                  </dl>
                </li>
              </ol>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setStep(1)}
            >
              Back
            </Button>
            <Button className="min-h-11" onClick={() => setStep(3)}>
              I’ve finished the {providerLabel(provider)} steps
            </Button>
          </div>
        </Card>
      ) : null}

      {!showStatus && step === 3 && provider && provider !== "NONE" ? (
        <Card className="space-y-4 p-5">
          <h2 className="scl-display text-base font-bold tracking-[0.05em] uppercase">
            Confirm submission
          </h2>
          <p className="text-muted-foreground text-sm">
            Packages will not go live until SCL imports links. Do not mark this
            complete until you finished the {providerLabel(provider)} steps.
          </p>
          <label className="flex items-start gap-3 text-sm leading-relaxed">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[color:var(--scl-pink)]"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            <span>{ackCopy}</span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setStep(2)}
            >
              Back
            </Button>
            <Button
              className="min-h-11"
              disabled={!ack || pending}
              onClick={submit}
            >
              {provider === "WHOP"
                ? "I’ve Added SCL as an Affiliate"
                : "I’ve Submitted My Affiliate Request"}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
