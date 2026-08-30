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
  savedEnabled: boolean;
  delayHours: number;
  dirty: boolean;
  delayAnchor: string;
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
  savedEnabled,
  delayHours,
  dirty,
  delayAnchor,
  activationLabel,
  onEnabledChange,
  onDelayChange,
}: RuleProps) {
  const status = dirty ? "Unsaved" : enabled ? "Active" : "Off";
  const toggleLabel = enabled
    ? dirty && !savedEnabled
      ? "Will enable"
      : "Enabled"
    : dirty && savedEnabled
      ? "Will pause"
      : "Enable";
  const dayEquivalent = delayHours / 24;

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
              aria-live="polite"
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                dirty
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : enabled
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {status}
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
          <span>{toggleLabel}</span>
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
          <p className="text-muted-foreground text-xs">
            {Number.isFinite(dayEquivalent)
              ? `${delayHours} hours = ${dayEquivalent.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${dayEquivalent === 1 ? "day" : "days"}. ${delayAnchor}`
              : delayAnchor}
          </p>
        </div>
        <div className="border-border bg-background rounded-lg border p-3 text-xs leading-relaxed">
          <p className="font-medium">Who qualifies</p>
          <p className="text-muted-foreground mt-1">{eligibility}</p>
        </div>
      </div>

      <p className="text-muted-foreground mt-3 text-xs">
        {dirty
          ? "Nothing changes until you save these automation settings."
          : activationLabel
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
  mailer,
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
  mailer: {
    deliverable: boolean | null;
    senderDomain: string | null;
    reason: string | null;
  };
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
  const verificationDirty =
    verificationEnabled !== initial.verificationReminderEnabled ||
    verificationDelay !== initial.verificationReminderDelayHours;
  const noPlaysDirty =
    noPlaysEnabled !== initial.noPlaysNudgeEnabled ||
    noPlaysDelay !== initial.noPlaysNudgeDelayHours;
  const isDirty =
    verificationDirty || noPlaysDirty || dailyLimit !== initial.dailyLimit;
  const mailerBlocksEnable =
    mailer.deliverable === false && (verificationEnabled || noPlaysEnabled);

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
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
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
          <p
            className={cn(
              "mt-2 text-xs font-medium",
              mailer.deliverable === true &&
                "text-emerald-700 dark:text-emerald-300",
              mailer.deliverable === false && "text-destructive",
              mailer.deliverable === null &&
                "text-amber-700 dark:text-amber-300",
            )}
          >
            {mailer.deliverable === true
              ? `Mailer ready${mailer.senderDomain ? ` · ${mailer.senderDomain}` : ""}`
              : mailer.deliverable === false
                ? `Mailer needs attention · ${mailer.reason ?? "check the Resend configuration"}`
                : `Mailer status unavailable · ${mailer.reason ?? "try again shortly"}`}
          </p>
        </div>
      </div>

      {!storageReady ? (
        <p className="border-destructive/40 bg-destructive/5 rounded-lg border p-3 text-sm">
          Automation storage is not ready. Both jobs remain safely off and
          settings cannot be saved until the migration is applied.
        </p>
      ) : null}

      {mailerBlocksEnable ? (
        <p className="border-destructive/40 bg-destructive/5 rounded-lg border p-3 text-sm">
          Repair email delivery before enabling a job. You can still turn both
          automations off and save.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <AutomationRule
          id="verification-reminder"
          title="Unverified account reminder"
          description="Sends a fresh, secure confirmation link when a new capper still has not verified their email."
          eligibility="New, non-test capper; still unverified; account is not suspended or disabled. This operational email is not blocked by marketing opt-out."
          enabled={verificationEnabled}
          savedEnabled={initial.verificationReminderEnabled}
          delayHours={verificationDelay}
          dirty={verificationDirty}
          delayAnchor="Measured from signup."
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
          savedEnabled={initial.noPlaysNudgeEnabled}
          delayHours={noPlaysDelay}
          dirty={noPlaysDirty}
          delayAnchor="Measured from email verification."
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
        <div className="space-y-2 sm:text-right">
          {isDirty ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Unsaved changes — nothing is live yet.
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              All automation settings are saved.
            </p>
          )}
          <Button
            type="submit"
            disabled={
              pending || !storageReady || !isDirty || mailerBlocksEnable
            }
          >
            {pending ? "Saving…" : "Save automation settings"}
          </Button>
        </div>
      </div>
    </form>
  );
}
