"use client";

import { useState, useTransition } from "react";
import { Clock3, MailCheck, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveEmailAutomationConfigAction } from "@/lib/actions/email-automation.action";
import { cn } from "@/lib/utils";

type RuleProps = {
  id: string;
  title: string;
  description: string;
  eligibility: string;
  enabled: boolean;
  delayHours: number;
  activationLabel: string | null;
  onEnabledChange: (enabled: boolean) => void;
  onDelayChange: (hours: number) => void;
};

function AutomationRule({
  id,
  title,
  description,
  eligibility,
  enabled,
  delayHours,
  activationLabel,
  onEnabledChange,
  onDelayChange,
}: RuleProps) {
  return (
    <article
      className={cn(
        "border-border rounded-xl border p-4 transition-colors",
        enabled ? "bg-primary/5 border-primary/30" : "bg-surface-2/50",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{title}</h3>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                enabled
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {enabled ? "Active" : "Off"}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {description}
          </p>
        </div>
        <label
          className={cn(
            "border-border bg-background flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium",
            enabled && "border-primary/40 text-primary",
          )}
        >
          <input
            id={`${id}-enabled`}
            type="checkbox"
            className="border-input accent-primary size-4 rounded"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <span>{enabled ? "Enabled" : "Enable"}</span>
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor={`${id}-delay`}>Wait time (hours)</Label>
          <Input
            id={`${id}-delay`}
            type="number"
            min={24}
            max={720}
            step={1}
            value={delayHours}
            onChange={(event) => onDelayChange(Number(event.target.value))}
          />
        </div>
        <div className="border-border bg-background rounded-lg border p-3 text-xs leading-relaxed">
          <p className="font-medium">Who qualifies</p>
          <p className="text-muted-foreground mt-1">{eligibility}</p>
        </div>
      </div>

      <p className="text-muted-foreground mt-3 text-xs">
        {activationLabel
          ? `Current cohort began ${activationLabel}. Turning this off and on starts a fresh cohort.`
          : "When first enabled, only cappers who join afterward can qualify—there is no historical blast."}
      </p>
    </article>
  );
}

export function AdminEmailAutomationControls({
  initial,
  storageReady,
  sentRollingDay,
  capacityUsedRollingDay,
}: {
  initial: {
    verificationReminderEnabled: boolean;
    verificationReminderDelayHours: number;
    verificationReminderActivatedAt: string | null;
    noPlaysNudgeEnabled: boolean;
    noPlaysNudgeDelayHours: number;
    noPlaysNudgeActivatedAt: string | null;
    dailyLimit: number;
  };
  storageReady: boolean;
  sentRollingDay: number;
  capacityUsedRollingDay: number;
}) {
  const router = useRouter();
  const [verificationEnabled, setVerificationEnabled] = useState(
    initial.verificationReminderEnabled,
  );
  const [verificationDelay, setVerificationDelay] = useState(
    initial.verificationReminderDelayHours,
  );
  const [noPlaysEnabled, setNoPlaysEnabled] = useState(
    initial.noPlaysNudgeEnabled,
  );
  const [noPlaysDelay, setNoPlaysDelay] = useState(
    initial.noPlaysNudgeDelayHours,
  );
  const [dailyLimit, setDailyLimit] = useState(initial.dailyLimit);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveEmailAutomationConfigAction({
        verificationReminderEnabled: verificationEnabled,
        verificationReminderDelayHours: verificationDelay,
        noPlaysNudgeEnabled: noPlaysEnabled,
        noPlaysNudgeDelayHours: noPlaysDelay,
        dailyLimit,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Automation settings saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="border-border bg-surface-2 rounded-xl border p-3">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
            <MailCheck className="size-4" aria-hidden />
            Last 24 hours
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {capacityUsedRollingDay}
            <span className="text-muted-foreground text-sm font-normal">
              {` / ${dailyLimit} capacity used`}
            </span>
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {sentRollingDay} confirmed delivered
          </p>
        </div>
        <div className="border-border bg-surface-2 rounded-xl border p-3 md:col-span-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
            <ShieldCheck className="size-4" aria-hidden />
            Delivery safety
          </div>
          <p className="mt-2 text-sm leading-relaxed">
            One send per capper, duplicate-safe retries, test and legacy
            accounts excluded, and a shared rolling limit that leaves provider
            capacity for account and owner email.
          </p>
        </div>
      </div>

      {!storageReady ? (
        <p className="border-destructive/40 bg-destructive/5 rounded-lg border p-3 text-sm">
          Automation storage is not ready. Both jobs remain safely off and
          settings cannot be saved until the migration is applied.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <AutomationRule
          id="verification-reminder"
          title="Unverified account reminder"
          description="Sends a fresh, secure confirmation link when a new capper still has not verified their email."
          eligibility="New, non-test capper; still unverified; account is not suspended or disabled. This operational email is not blocked by marketing opt-out."
          enabled={verificationEnabled}
          delayHours={verificationDelay}
          activationLabel={
            initial.verificationReminderActivatedAt
              ? new Date(
                  initial.verificationReminderActivatedAt,
                ).toLocaleString()
              : null
          }
          onEnabledChange={setVerificationEnabled}
          onDelayChange={setVerificationDelay}
        />
        <AutomationRule
          id="no-plays-nudge"
          title="No-plays getting-started email"
          description="Encourages a newly verified capper to post their first pick and explains the value of an SCL record."
          eligibility="New, verified, active capper with zero straight plays and zero parlays. Marketing opt-outs, test accounts, and legacy imports are excluded."
          enabled={noPlaysEnabled}
          delayHours={noPlaysDelay}
          activationLabel={
            initial.noPlaysNudgeActivatedAt
              ? new Date(initial.noPlaysNudgeActivatedAt).toLocaleString()
              : null
          }
          onEnabledChange={setNoPlaysEnabled}
          onDelayChange={setNoPlaysDelay}
        />
      </div>

      <div className="border-border flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl space-y-2">
          <Label htmlFor="automation-daily-limit">
            Automated email limit (rolling 24 hours)
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="automation-daily-limit"
              type="number"
              min={1}
              max={50}
              value={dailyLimit}
              onChange={(event) => setDailyLimit(Number(event.target.value))}
              className="w-28"
            />
            <span className="text-muted-foreground text-sm">Maximum 50</span>
          </div>
          <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
            <Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            The scheduler checks hourly. Reaching this limit pauses lifecycle
            sends until capacity returns; eligible cappers stay queued.
          </p>
        </div>
        <Button onClick={save} disabled={pending || !storageReady}>
          {pending ? "Saving…" : "Save automation settings"}
        </Button>
      </div>
    </div>
  );
}
