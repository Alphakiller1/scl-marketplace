"use client";

import { useMemo, useState, useTransition } from "react";
import type { StoreConnection, StoreProvider } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { StoreStatusPanel } from "@/components/scl/store-status-panel";
import { StorefrontConversationPanel } from "@/components/scl/storefront-conversation-panel";
import { ProviderBadge } from "@/components/scl/provider-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  markInstructionsViewedAction,
  submitStoreConnectionAction,
} from "@/lib/actions/store.action";
import {
  SCL_AFFILIATE_EMAIL,
  SCL_WHOP_AFFILIATE_COMMISSION,
  SCL_WHOP_AFFILIATE_PAGE_URL,
  SCL_WHOP_AFFILIATE_USERNAME,
  WHOP_CAPPER_REFERRAL_URL,
  WINIBLE_CAPPER_REFERRAL_URL,
  WINIBLE_INVITE_VALUES,
  isPendingStoreStatus,
  providerLabel,
  selectInitialStoreConnection,
} from "@/lib/store-connection";
import { cn } from "@/lib/utils";

const STEPS = [
  "Choose platform",
  "Why connect",
  "Setup steps",
  "Confirm",
  "Status",
] as const;

const SUPPORTED_PROVIDERS = ["WINIBLE", "WHOP"] as const;

const PLATFORM_SELECTION_COPY = [
  [
    "WINIBLE",
    "Winible",
    "Invite SCL as an affiliate. SCL accepts the relationship, reviews the package details, and manually publishes approved links.",
  ],
  [
    "WHOP",
    "Whop",
    "Already sell picks on Whop? Add SCL as an affiliate, connect SCL on Whop, then submit — our team reviews and publishes your approved packages.",
  ],
  [
    "NONE",
    "None yet",
    "Don’t have a platform yet to sell your picks? We’ll help you get set up with Winible or Whop.",
  ],
] as const;

function platformSelectionGuidance(
  provider: StoreProvider | "NONE" | null,
): string | null {
  switch (provider) {
    case "WINIBLE":
      return "Complete the Winible affiliate invite, then submit — SCL accepts the relationship and manually publishes your package links.";
    case "WHOP":
      return "Add SCL as a Whop affiliate, connect SCL on Whop, then submit — SCL reviews and publishes your approved packages.";
    case "NONE":
      return "We’ll help you create a Winible or Whop storefront and connect it to SCL.";
    default:
      return null;
  }
}

function storefrontConnectionBenefits(provider: StoreProvider): string[] {
  const label = providerLabel(provider);
  return [
    "No monthly SCL platform fees.",
    `Add SCL as an affiliate on ${label}. After you submit, our team verifies the relationship and manually publishes your approved package links on your SCL profile.`,
    `You keep selling on ${label} — checkout, subscriptions, and payments stay on ${label}.`,
    "When SCL refers a subscriber to your storefront, we earn an affiliate commission from the platform. That’s how SCL stays free for cappers.",
  ];
}

type Conn = Pick<
  StoreConnection,
  "id" | "provider" | "status" | "packageImportStatus" | "submittedAt"
>;

type ThreadMessage = {
  id: string;
  body: string;
  senderRole: "ADMIN" | "CAPPER";
  createdAt: string;
  sender: {
    displayName: string | null;
    username: string | null;
    email: string;
  };
};

export function MonetizationWizard({
  connections,
  messagesByConnection = {},
  activeThreadId = null,
  capperUsername = null,
}: {
  connections: Conn[];
  messagesByConnection?: Record<string, ThreadMessage[]>;
  activeThreadId?: string | null;
  capperUsername?: string | null;
}) {
  const initialActive = selectInitialStoreConnection(connections);

  const [allConnections, setAllConnections] = useState<Conn[]>(connections);

  const [step, setStep] = useState(() =>
    initialActive &&
    (isPendingStoreStatus(initialActive.status) ||
      initialActive.status === "LIVE" ||
      initialActive.status === "NEEDS_ACTION" ||
      initialActive.status === "DISABLED" ||
      initialActive.status === "LINKS_RECEIVED" ||
      initialActive.status === "PACKAGES_IMPORTED")
      ? 4
      : 0,
  );
  const [provider, setProvider] = useState<StoreProvider | "NONE" | null>(
    initialActive?.provider ?? null,
  );
  const [ack, setAck] = useState(false);
  const [connection, setConnection] = useState<Conn | null>(initialActive);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [copiedAffiliateEmail, setCopiedAffiliateEmail] = useState(false);
  const [pending, startTransition] = useTransition();

  const showStatus =
    connection &&
    (step >= 4 ||
      isPendingStoreStatus(connection.status) ||
      connection.status === "LIVE" ||
      connection.status === "NEEDS_ACTION" ||
      connection.status === "DISABLED" ||
      connection.status === "LINKS_RECEIVED" ||
      connection.status === "PACKAGES_IMPORTED");

  const connectedProviders = new Set(
    allConnections.map((item) => item.provider),
  );
  const remainingProviders = SUPPORTED_PROVIDERS.filter(
    (item) => !connectedProviders.has(item),
  );

  function startAnotherConnection() {
    const nextProvider =
      remainingProviders.length === 1 ? remainingProviders[0] : null;
    setConnection(null);
    setProvider(nextProvider);
    setAck(false);
    setStep(0);
  }

  const ackCopy = useMemo(() => {
    if (provider === "WHOP") {
      return `I understand that connecting my Whop store to SCL requires adding Sports Cappers Leaderboard (${SCL_AFFILIATE_EMAIL}) as an affiliate at ${SCL_WHOP_AFFILIATE_COMMISSION.percent}% ${SCL_WHOP_AFFILIATE_COMMISSION.duration}, then connecting SCL on my Whop storefront. I understand that Whop controls checkout and commission payouts, and that SCL will publish approved packages on my SCL profile.`;
    }
    return `I confirm that I’ve completed the Winible affiliate setup and designated Sports Cappers Leaderboard as my affiliate partner in Winible. I understand SCL will use the affiliate links provided by Winible on my SCL profile and package pages. I understand that Winible controls its own affiliate attribution and commission rules.`;
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
      const submitted: Conn = {
        id: connection?.id || "local",
        provider,
        status:
          provider === "WHOP"
            ? "PENDING_SCL_LINK_IMPORT"
            : "PENDING_SCL_ACCEPTANCE",
        packageImportStatus: "NOT_STARTED",
        submittedAt: new Date(),
      };
      setConnection(submitted);
      setAllConnections((current) => [
        ...current.filter((item) => item.provider !== provider),
        submitted,
      ]);
      setStep(4);
    });
  }

  function copyWinibleReferral() {
    void navigator.clipboard.writeText(WINIBLE_CAPPER_REFERRAL_URL);
    setCopiedReferral(true);
    window.setTimeout(() => setCopiedReferral(false), 2000);
    toast.success("Winible referral link copied");
  }

  function copyAffiliateEmail() {
    void navigator.clipboard.writeText(SCL_AFFILIATE_EMAIL);
    setCopiedAffiliateEmail(true);
    window.setTimeout(() => setCopiedAffiliateEmail(false), 2000);
    toast.success("SCL affiliate email copied");
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

      {allConnections.length ? (
        <section
          className="space-y-3"
          aria-labelledby="platform-connections-title"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="platform-connections-title" className="font-semibold">
                Your Platform Connections
              </h2>
              <p className="text-muted-foreground text-sm">
                Each platform has its own affiliate review and package status.
              </p>
            </div>
            {showStatus && remainingProviders.length ? (
              <Button
                type="button"
                variant="outline"
                onClick={startAnotherConnection}
              >
                Connect Another Platform
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {allConnections.map((item) => (
              <StoreStatusPanel
                key={item.provider}
                provider={item.provider}
                status={item.status}
                className="h-full"
              />
            ))}
          </div>
          {allConnections.some((item) => item.status !== "NOT_STARTED") ? (
            <div className="space-y-4">
              {allConnections
                .filter((item) => item.status !== "NOT_STARTED")
                .map((item) => (
                  <StorefrontConversationPanel
                    key={item.id}
                    storeConnectionId={item.id}
                    viewer="capper"
                    messages={messagesByConnection[item.id] ?? []}
                    provider={item.provider}
                    capperUsername={capperUsername}
                    highlighted={activeThreadId === item.id}
                  />
                ))}
            </div>
          ) : null}
          {showStatus && remainingProviders.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Winible and Whop are both connected. SCL reviews and publishes
              packages for each platform separately.
            </p>
          ) : null}
        </section>
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
            {PLATFORM_SELECTION_COPY.map(([id, title, body]) => {
              const existing =
                id !== "NONE"
                  ? allConnections.find((item) => item.provider === id)
                  : null;
              const unavailable = Boolean(
                existing &&
                existing.status !== "NOT_STARTED" &&
                existing.status !== "INSTRUCTIONS_VIEWED",
              );
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setProvider(id)}
                  disabled={unavailable}
                  aria-pressed={provider === id}
                  className={cn(
                    "border-border bg-surface-2 rounded-xl border p-4 text-left transition-colors",
                    provider === id && "border-brand ring-brand/30 ring-2",
                    unavailable && "cursor-not-allowed opacity-50",
                  )}
                >
                  <p className="font-semibold">{title}</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    {unavailable
                      ? "Already connected — review its status above."
                      : body}
                  </p>
                </button>
              );
            })}
          </div>
          {provider === "NONE" ? (
            <div className="space-y-3">
              <div className="border-border bg-surface-2 rounded-lg border p-4 text-sm">
                <p className="font-semibold">Get Set Up With Winible</p>
                <p className="text-muted-foreground mt-1 leading-relaxed">
                  Don’t have a platform yet? We’ll help you get set up with
                  Winible in just a few minutes so you can sell packages that
                  appear on SCL. Create your Winible storefront, then return
                  here and choose Winible to connect it.
                </p>
                <Button
                  variant="outline"
                  className="mt-3"
                  render={
                    <a
                      href={WINIBLE_CAPPER_REFERRAL_URL}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                  nativeButton={false}
                >
                  Create a Winible storefront
                  <ExternalLink className="size-4" />
                </Button>
                <p className="text-muted-foreground mt-2 text-xs">
                  This opens SCL&apos;s Winible creator-onboarding referral. It
                  is not a customer package checkout link.
                </p>
                <div className="border-border bg-background mt-3 rounded-lg border p-3">
                  <p className="text-xs font-semibold tracking-wide uppercase">
                    If the page will not open
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    Copy the referral URL below, then open it directly in your
                    browser.
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="bg-surface-2 min-w-0 flex-1 overflow-x-auto rounded-md px-2 py-1 text-xs">
                      {WINIBLE_CAPPER_REFERRAL_URL}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-10"
                      onClick={copyWinibleReferral}
                    >
                      {copiedReferral ? "Copied" : "Copy link"}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="border-border bg-surface-2 rounded-lg border p-4 text-sm">
                <p className="font-semibold">Get Set Up With Whop</p>
                <p className="text-muted-foreground mt-1 leading-relaxed">
                  Don’t have a platform yet to sell your picks? We’ll help you
                  get set up with Whop so you can sell packages that appear on
                  SCL. Create your Whop storefront, then return here and choose
                  Whop to connect it.
                </p>
                <Button
                  variant="outline"
                  className="mt-3"
                  render={
                    <a
                      href={WHOP_CAPPER_REFERRAL_URL}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                  nativeButton={false}
                >
                  Create a Whop storefront
                  <ExternalLink className="size-4" />
                </Button>
                <p className="text-muted-foreground mt-2 text-xs">
                  This opens SCL&apos;s Whop referral link. It is not a customer
                  package checkout link.
                </p>
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-xs">
              {platformSelectionGuidance(provider)}
            </p>
            <Button
              disabled={!provider || provider === "NONE" || pending}
              onClick={continueFromChooser}
            >
              Continue
            </Button>
          </div>
        </Card>
      ) : null}

      {!showStatus && step === 1 && provider && provider !== "NONE" ? (
        <Card className="space-y-4 p-5">
          <h2 className="scl-display text-base font-bold tracking-[0.05em] uppercase">
            Why Connect Your Storefront?
          </h2>
          <ul className="border-brand/30 bg-brand/10 space-y-2.5 rounded-lg border p-4 text-sm leading-relaxed">
            {storefrontConnectionBenefits(provider).map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Affiliate attribution, cookies, and commission rules are governed by{" "}
            {providerLabel(provider)}, not SCL.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button onClick={() => setStep(2)}>
              {provider === "WHOP"
                ? "Continue to Connect Whop"
                : "Continue to Connect Your Storefront"}
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
                Add Sports Cappers Leaderboard as an affiliate in Whop, then
                connect SCL to your storefront. After you submit, SCL verifies
                the relationship and publishes the approved packages on your
                profile.
              </p>
              <ol className="space-y-3">
                <li className="border-border rounded-lg border p-3">
                  <p className="font-semibold">
                    1. Open Affiliates in your Whop dashboard
                  </p>
                  <p className="text-muted-foreground mt-1">
                    From your own Whop business dashboard, go to{" "}
                    <strong>Marketing → Affiliates</strong>.
                  </p>
                  <StepShot
                    src="/whop-steps/1-affiliates-tab.png"
                    alt="Whop dashboard side menu with Affiliates highlighted under Marketing"
                  />
                </li>
                <li className="border-border rounded-lg border p-3">
                  <p className="font-semibold">2. Set SCL as an affiliate</p>
                  <p className="text-muted-foreground mt-1">
                    On the Affiliates page, choose{" "}
                    <strong>
                      Set an affiliate commission for a specific user
                    </strong>
                    — not the per-product option above it.
                  </p>
                  <StepShot
                    src="/whop-steps/2-specific-user.png"
                    alt="Whop Affiliates page with the option to set an affiliate commission for a specific user highlighted"
                  />
                </li>
                <li className="border-border rounded-lg border p-3">
                  <p className="font-semibold">3. Set the SCL commission</p>
                  <p className="text-muted-foreground mt-1">
                    Enter <strong>{SCL_AFFILIATE_EMAIL}</strong> as the user,
                    set the reward to{" "}
                    <strong>{SCL_WHOP_AFFILIATE_COMMISSION.percent}%</strong>{" "}
                    with <strong>Percent</strong> selected (not a flat amount),
                    and choose{" "}
                    <strong>
                      {SCL_WHOP_AFFILIATE_COMMISSION.duration} payments
                    </strong>{" "}
                    (not First Payment Only). Leave{" "}
                    <strong>Only allow referring to these products</strong>{" "}
                    blank so SCL can promote all eligible packages — naming
                    products there limits SCL to just those. Then click{" "}
                    <strong>Invite</strong>.
                  </p>
                  <StepShot
                    src="/whop-steps/3-invite-form.png"
                    alt="Whop Invite affiliate form filled with SCL's email, a 35 percent reward, Recurring payments, and the product filter left blank"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-10"
                      onClick={copyAffiliateEmail}
                    >
                      {copiedAffiliateEmail
                        ? "Copied"
                        : "Copy SCL affiliate email"}
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-10"
                      render={
                        <a
                          href={SCL_WHOP_AFFILIATE_PAGE_URL}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                      nativeButton={false}
                    >
                      Open Sports Cappers Leaderboard on Whop
                      <ExternalLink className="size-4" />
                    </Button>
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Whop accepts an email, Whop username, or user ID. SCL&apos;s
                    are <strong>{SCL_AFFILIATE_EMAIL}</strong> and{" "}
                    <strong>{SCL_WHOP_AFFILIATE_USERNAME}</strong> — the
                    username is not the same as the address of SCL&apos;s Whop
                    storefront. Want to confirm it&apos;s us before granting a
                    commission? Open SCL on Whop first.
                  </p>
                </li>
                <li className="border-border rounded-lg border p-3">
                  <p className="font-semibold">4. Connect SCL to your Whop</p>
                  <p className="text-muted-foreground mt-1">
                    Connect SCL to your Whop storefront so we can sync your
                    packages and publish the approved ones on your SCL profile.
                    Hiding a mapped product on Whop also takes its SCL offer
                    down. Prices remain controlled in Whop.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-2 min-h-10"
                    render={
                      <a
                        href="/api/whop/connect"
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                    nativeButton={false}
                  >
                    Connect SCL to Whop
                    <ExternalLink className="size-4" />
                  </Button>
                </li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="border-border bg-surface-2 rounded-lg border p-3 leading-relaxed">
                Invite Sports Cappers Leaderboard as an affiliate in Winible.
                After you submit here, SCL accepts the relationship in Winible,
                verifies your packages, and manually publishes the approved
                links on your profile.
              </p>
              <ol className="space-y-3">
                <li className="border-border rounded-lg border p-3">
                  <p className="font-semibold">
                    1. Open the Affiliates tab in your Winible dashboard
                  </p>
                  <p className="text-muted-foreground mt-1">
                    You&apos;ll find <strong>Affiliates</strong> in the
                    left-hand menu.
                  </p>
                  <StepShot
                    src="/winible-steps/1-affiliates-tab.png"
                    alt="Winible dashboard with the Affiliates tab highlighted in the left-hand menu"
                  />
                </li>
                <li className="border-border rounded-lg border p-3">
                  <p className="font-semibold">2. Invite affiliate</p>
                  <p className="text-muted-foreground mt-1">
                    Under the Affiliate tab, click{" "}
                    <strong>Invite Affiliate</strong>.
                  </p>
                  <StepShot
                    src="/winible-steps/2-invite-affiliate.png"
                    alt="Winible Affiliates page with the Invite Affiliate button highlighted"
                  />
                </li>
                <li className="border-border rounded-lg border p-3">
                  <p className="font-semibold">
                    3. Fill in the SCL affiliate information below
                  </p>
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
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 min-h-10"
                    onClick={copyAffiliateEmail}
                  >
                    {copiedAffiliateEmail
                      ? "Copied"
                      : "Copy SCL affiliate email"}
                  </Button>
                  <StepShot
                    src="/winible-steps/3-invite-form.png"
                    alt="Winible Invite Affiliate form filled with SCL's email, reward type, amount, and plans"
                  />
                </li>
                <li className="border-border rounded-lg border p-3">
                  <p className="font-semibold">
                    4. Wait for SCL to accept in Winible
                  </p>
                  <p className="text-muted-foreground mt-1">
                    SCL receives the invite at{" "}
                    <strong>{SCL_AFFILIATE_EMAIL}</strong>, accepts it in
                    Winible, then manually adds your package links on SCL. You
                    will see &quot;Awaiting SCL Acceptance&quot; after you
                    submit below.
                  </p>
                </li>
              </ol>
              <div className="border-border bg-surface-2 rounded-lg border p-3">
                <p className="font-semibold">
                  Don’t have a Winible storefront yet?
                </p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  Create your Winible storefront using the SCL link below, then
                  return here to connect it to SCL.
                </p>
                <Button
                  variant="outline"
                  className="mt-2 min-h-10"
                  render={
                    <a
                      href={WINIBLE_CAPPER_REFERRAL_URL}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                  nativeButton={false}
                >
                  Head to Winible to Sign Up
                  <ExternalLink className="size-4" />
                </Button>
                <p className="text-muted-foreground mt-2 text-xs">
                  Storefronts created through this link are affiliated with SCL
                  through Winible’s affiliate program.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)}>
              {provider === "WHOP"
                ? "I’ve Added SCL as an Affiliate on Whop"
                : "I’ve Submitted My Winible Affiliate Request"}
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
            Packages won’t appear on your SCL profile until SCL reviews your{" "}
            {providerLabel(provider)} affiliate relationship and manually adds
            the approved package links. Only check the box after you’ve
            completed all of the {providerLabel(provider)} steps.
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
            <Button variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button disabled={!ack || pending} onClick={submit}>
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

/**
 * Optional instructional screenshot under a setup step. Owner drops real
 * Winible screenshots into `public/winible-steps/` (1-affiliates-tab.png,
 * 2-invite-affiliate.png, 3-invite-form.png) and they render; while the file
 * is missing, the slot hides itself instead of showing a broken image.
 */
function StepShot({ src, alt }: { src: string; alt: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- optional owner-dropped asset; must hide on 404
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="border-border mt-2.5 w-full max-w-md rounded-lg border shadow-[var(--scl-shadow-card)]"
      onError={() => setMissing(true)}
    />
  );
}
