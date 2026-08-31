"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  CircleDollarSign,
  Gauge,
  Play,
  ScanSearch,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  dryRunOddsAction,
  runOddsNowAction,
  saveOddsControlSettingsAction,
} from "@/lib/actions/odds-control.action";
import {
  CADENCE_OPTIONS,
  estimatedRunCredits,
  expandedMarketGroups,
  oddsStrategyForecast,
  SOCCER_CONTROL_LEAGUES,
  SURFACE_MARKETS,
  type OddsControlSport,
} from "@/lib/odds-control";
import { formatEasternDateTime } from "@/lib/odds-control-reporting";
import type { OddsControlSettingsInput } from "@/lib/schemas/odds-control.schema";
import { cn } from "@/lib/utils";

type SportDraft = OddsControlSettingsInput["sports"][number] & {
  nextSurfaceRunAt: string | null;
  nextExpandedRunAt: string | null;
  lastSurfaceRunAt: string | null;
  lastExpandedRunAt: string | null;
};

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "border-border bg-card flex min-h-12 items-start justify-between gap-4 rounded-xl border p-3 transition-colors",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:border-border-strong cursor-pointer",
        checked && !disabled && "border-primary/40 bg-primary/5",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description ? (
          <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
            {description}
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="bg-surface-2 peer-focus-visible:ring-ring peer-checked:bg-primary after:bg-primary-foreground relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-disabled:opacity-60 after:absolute after:top-1 after:left-1 after:size-4 after:rounded-full after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}

function StepHeader({
  step,
  icon: Icon,
  title,
  description,
}: {
  step: number;
  icon: typeof Gauge;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-primary text-primary-foreground nums grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold">
        {step}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="text-primary size-4" aria-hidden />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
    </div>
  );
}

function numberValue(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function cadenceLabel(minutes: number): string {
  return (
    CADENCE_OPTIONS.find((option) => option.minutes === minutes)?.label ??
    `${minutes} min`
  );
}

function scheduleLabel(value: string | null): string {
  return formatEasternDateTime(value);
}

export function AdminOddsControlEditor({
  initialConfig,
  initialSports,
  verificationUsage,
  storageReady,
}: {
  initialConfig: Omit<OddsControlSettingsInput, "sports">;
  initialSports: SportDraft[];
  verificationUsage: { requestsToday: number; creditsToday: number };
  storageReady: boolean;
}) {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [sports, setSports] = useState(initialSports);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pending, startTransition] = useTransition();
  const forecast = oddsStrategyForecast({ ...config, sports });
  const canActivate = forecast.blockingReasons.length === 0;
  const budgetPercent =
    forecast.operatingBudget > 0
      ? Math.min(
          100,
          Math.round(
            (forecast.totalCreditsPerMonth / forecast.operatingBudget) * 100,
          ),
        )
      : 100;

  function updateSport(sport: OddsControlSport, update: Partial<SportDraft>) {
    setHasUnsavedChanges(true);
    setSports((current) =>
      current.map((row) => (row.sport === sport ? { ...row, ...update } : row)),
    );
  }

  function updateConfig(update: Partial<typeof config>) {
    setHasUnsavedChanges(true);
    setConfig((current) => ({ ...current, ...update }));
  }

  function save() {
    startTransition(async () => {
      const result = await saveOddsControlSettingsAction({
        ...config,
        sports: sports.map(
          ({
            nextSurfaceRunAt: _nextSurfaceRunAt,
            nextExpandedRunAt: _nextExpandedRunAt,
            lastSurfaceRunAt: _lastSurfaceRunAt,
            lastExpandedRunAt: _lastExpandedRunAt,
            ...sport
          }) => sport,
        ),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setHasUnsavedChanges(false);
      toast.success("API controls saved");
      router.refresh();
    });
  }

  function runNow(sport: string, tier: "surface" | "expanded", dryRun = false) {
    startTransition(async () => {
      const result = dryRun
        ? await dryRunOddsAction({ sport, tier })
        : await runOddsNowAction({ sport, tier });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.message ??
          `${sport} ${tier} ${dryRun ? "simulation completed" : "refresh completed"}`,
      );
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {!storageReady ? (
        <div
          className="border-neg/30 bg-neg/10 flex gap-3 rounded-xl border p-4 text-sm"
          role="alert"
        >
          <AlertTriangle
            className="text-neg mt-0.5 size-5 shrink-0"
            aria-hidden
          />
          <div>
            <p className="font-semibold">Preview mode—saving is disabled</p>
            <p className="text-muted-foreground mt-1">
              The database migration has not been applied. You can review the
              controls, but no setting or schedule can change.
            </p>
          </div>
        </div>
      ) : null}

      <Card className="p-4 sm:p-6">
        <div className="border-border bg-card grid gap-4 rounded-xl border p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <WalletCards className="text-primary size-4" aria-hidden />
                <h3 className="text-sm font-semibold">
                  Current strategy forecast
                </h3>
              </div>
              <Badge
                variant={canActivate ? "outline" : "destructive"}
                className={cn(
                  canActivate && "border-pos/30 bg-pos/10 text-pos",
                )}
              >
                {canActivate ? "Safe to activate" : "Needs attention"}
              </Badge>
            </div>
            <div className="bg-surface-3 mt-3 h-2 overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  canActivate ? "bg-primary" : "bg-neg",
                )}
                style={{ width: budgetPercent + "%" }}
                role="progressbar"
                aria-label="Modeled monthly API usage"
                aria-valuemin={0}
                aria-valuemax={forecast.operatingBudget}
                aria-valuenow={Math.min(
                  forecast.totalCreditsPerMonth,
                  forecast.operatingBudget,
                )}
              />
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Conservative 31-day maximum:{" "}
              <span className="nums text-foreground font-semibold">
                {forecast.totalCreditsPerMonth.toLocaleString()}
              </span>{" "}
              of{" "}
              <span className="nums text-foreground font-semibold">
                {forecast.operatingBudget.toLocaleString()}
              </span>{" "}
              spendable credits after the{" "}
              {config.reserveCredits.toLocaleString()} reserve.
            </p>
            {forecast.blockingReasons.length ? (
              <ul className="text-neg mt-2 space-y-1 text-xs" role="alert">
                {forecast.blockingReasons.map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
            ) : (
              <p className="text-pos mt-2 text-xs font-medium">
                Modeled headroom: {forecast.budgetRemaining.toLocaleString()}{" "}
                credits.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:min-w-64">
            <div className="border-border bg-surface-2 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Boards / day</p>
              <p className="nums mt-1 text-lg font-semibold">
                {forecast.boardCreditsPerDay.toLocaleString()}
              </p>
            </div>
            <div className="border-border bg-surface-2 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Largest run</p>
              <p className="nums mt-1 text-lg font-semibold">
                {forecast.largestRunCredits.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="space-y-5 p-4 sm:p-6">
        <StepHeader
          step={1}
          icon={CalendarClock}
          title="Scheduling authority"
          description="Choose whether this dashboard controls API pulls, then pause them when needed."
        />
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle
            checked={config.managedSchedulingEnabled}
            onChange={(managedSchedulingEnabled) => {
              if (managedSchedulingEnabled && !canActivate) {
                toast.error(
                  forecast.blockingReasons[0] ??
                    "Fix the strategy forecast before activation.",
                );
                return;
              }
              updateConfig({ managedSchedulingEnabled });
            }}
            label="Owner-managed scheduling"
            description="When on, the dispatcher follows the sport and cadence settings below. When off, existing production cadence remains authoritative."
          />
          <Toggle
            checked={config.paused}
            onChange={(paused) => updateConfig({ paused })}
            label="Pause optional API pulls"
            description="Stops scheduled board refreshes. Protected results and verification activity continue."
          />
        </div>
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3 text-sm",
            config.managedSchedulingEnabled && !config.paused
              ? "border-live/30 bg-live/10"
              : "border-border bg-surface-2",
          )}
          role="status"
        >
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full",
              config.managedSchedulingEnabled && !config.paused
                ? "bg-live text-background"
                : "bg-muted text-muted-foreground",
            )}
            aria-hidden
          >
            {config.managedSchedulingEnabled && !config.paused ? (
              <Check className="size-4" />
            ) : (
              <CalendarClock className="size-4" />
            )}
          </span>
          <span className="font-medium">
            {!config.managedSchedulingEnabled
              ? "Preview only: these settings will not control API calls."
              : config.paused
                ? "Paused: new optional managed pulls will not run."
                : "Active after save: the dispatcher will enforce this strategy."}
          </span>
        </div>
      </Card>

      <Card className="space-y-5 p-4 sm:p-6">
        <StepHeader
          step={2}
          icon={ShieldCheck}
          title="Credit guardrails"
          description="Set the maximum spend for each window and keep a protected reserve."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {[
            {
              label: "Daily limit",
              key: "dailyCreditLimit",
              help: "Max per calendar day",
              min: 1,
            },
            {
              label: "Weekly limit",
              key: "weeklyCreditLimit",
              help: "Max per rolling 7 days",
              min: 1,
            },
            {
              label: "Monthly limit",
              key: "monthlyCreditLimit",
              help: "Max per calendar month",
              min: 1,
            },
            {
              label: "Per-run limit",
              key: "perRunCreditLimit",
              help: "Maximum reserved by one run",
              min: 1,
            },
            {
              label: "Protected reserve",
              key: "reserveCredits",
              help: "Held for critical calls",
              min: 0,
            },
            {
              label: "Warning threshold",
              key: "warningPercent",
              help: "Percent of each limit",
              min: 1,
            },
          ].map(({ label, key, help, min }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="number"
                min={min}
                max={key === "warningPercent" ? 100 : undefined}
                value={config[key as keyof typeof config] as number}
                onChange={(event) =>
                  updateConfig({
                    [key]: numberValue(
                      event.target.value,
                      config[key as keyof typeof config] as number,
                    ),
                  })
                }
              />
              <p className="text-muted-foreground text-xs">{help}</p>
            </div>
          ))}
        </div>
        <p className="border-border text-muted-foreground border-t pt-4 text-xs">
          Hard limits count completed usage plus credits reserved by active
          runs. New managed runs are blocked before they can exceed a limit. All
          schedules below are shown in Eastern Time and automatically follow
          daylight-saving changes.
        </p>
        <div className="border-border bg-surface-2 grid gap-3 rounded-xl border p-3 sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-xs">Spendable monthly</p>
            <p className="nums mt-1 font-semibold">
              {forecast.operatingBudget.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Modeled maximum</p>
            <p className="nums mt-1 font-semibold">
              {forecast.totalCreditsPerMonth.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Remaining cushion</p>
            <p
              className={cn(
                "nums mt-1 font-semibold",
                forecast.budgetRemaining >= 0 ? "text-pos" : "text-neg",
              )}
            >
              {forecast.budgetRemaining.toLocaleString()}
            </p>
          </div>
        </div>
      </Card>

      <Card id="verification" className="scroll-mt-36 space-y-5 p-4 sm:p-6">
        <StepHeader
          step={3}
          icon={ShieldCheck}
          title="Verification controls"
          description="Cap true per-event price checks independently from board population and grading."
        />
        <Toggle
          checked={config.verificationEnabled}
          onChange={(verificationEnabled) =>
            updateConfig({ verificationEnabled })
          }
          label="Allow live verification requests"
          description="Turn off to block new provider verification calls. Cached boards remain available and results grading continues."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border-border bg-surface-2 rounded-xl border p-3">
            <p className="text-muted-foreground text-xs">
              Verification attempts today
            </p>
            <p className="nums mt-1 text-xl font-semibold">
              {verificationUsage.requestsToday.toLocaleString()} /{" "}
              {config.verificationDailyRequestLimit.toLocaleString()}
            </p>
          </div>
          <div className="border-border bg-surface-2 rounded-xl border p-3">
            <p className="text-muted-foreground text-xs">
              Verification credits today
            </p>
            <p className="nums mt-1 text-xl font-semibold">
              {verificationUsage.creditsToday.toLocaleString()} /{" "}
              {config.verificationDailyCreditLimit.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Daily verifications",
              key: "verificationDailyRequestLimit",
              help: "Maximum provider-check attempts per UTC day",
              min: 1,
              max: 100000,
            },
            {
              label: "Daily verify credits",
              key: "verificationDailyCreditLimit",
              help: "Credits reserved only for verification",
              min: 1,
              max: 1000000,
            },
            {
              label: "Credits per verification",
              key: "verificationMaxCreditsPerRequest",
              help: "Maximum market keys in one check",
              min: 1,
              max: 100,
            },
            {
              label: "Reuse window (minutes)",
              key: "verificationCacheMinutes",
              help: "Longer reuse lowers repeat provider calls",
              min: 10,
              max: 1440,
            },
          ].map(({ label, key, help, min, max }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="number"
                min={min}
                max={max}
                value={config[key as keyof typeof config] as number}
                onChange={(event) =>
                  updateConfig({
                    [key]: numberValue(
                      event.target.value,
                      config[key as keyof typeof config] as number,
                    ),
                  })
                }
              />
              <p className="text-muted-foreground text-xs">{help}</p>
            </div>
          ))}
        </div>
        <div className="border-border bg-surface-2 rounded-xl border p-3 text-xs leading-relaxed">
          <p className="font-medium">What these controls affect</p>
          <p className="text-muted-foreground mt-1">
            Verification means a live, per-event odds confirmation. Expanded
            board refreshes are tracked and controlled under Board population;
            results settlement and grading are never disabled here.
          </p>
        </div>
      </Card>

      <section id="sports" className="scroll-mt-36 space-y-5">
        <Card className="space-y-5 p-4 sm:p-6">
          <StepHeader
            step={4}
            icon={SlidersHorizontal}
            title="Sports, markets & cadence"
            description="Open a sport to control its board, expanded markets, refresh schedule, and league scope."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="border-border bg-surface-2 rounded-xl border p-3">
              <p className="text-muted-foreground text-xs">Sports enabled</p>
              <p className="nums mt-1 text-xl font-semibold">
                {sports.filter((sport) => sport.enabled).length} /{" "}
                {sports.length}
              </p>
            </div>
            <div className="border-border bg-surface-2 rounded-xl border p-3">
              <p className="text-muted-foreground text-xs">Standard boards</p>
              <p className="nums mt-1 text-xl font-semibold">
                {
                  sports.filter(
                    (sport) => sport.enabled && sport.surfaceEnabled,
                  ).length
                }
              </p>
            </div>
            <div className="border-border bg-surface-2 rounded-xl border p-3">
              <p className="text-muted-foreground text-xs">Expanded coverage</p>
              <p className="nums mt-1 text-xl font-semibold">
                {
                  sports.filter(
                    (sport) => sport.enabled && sport.expandedEnabled,
                  ).length
                }
              </p>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          {sports.map((sport) => {
            const groups = expandedMarketGroups(sport.sport);
            const surfaceEstimate = estimatedRunCredits({
              sport: sport.sport,
              tier: "surface",
              markets: sport.surfaceMarkets,
              leagues: sport.leagues,
              maxEventsPerRun: sport.maxEventsPerRun,
            });
            const expandedEstimate = estimatedRunCredits({
              sport: sport.sport,
              tier: "expanded",
              markets: sport.expandedMarkets,
              leagues: sport.leagues,
              maxEventsPerRun: sport.maxEventsPerRun,
            });
            const surfaceOverLimit = surfaceEstimate > config.perRunCreditLimit;
            const expandedOverLimit =
              expandedEstimate > config.perRunCreditLimit;
            const activeTiers = [
              sport.surfaceEnabled ? "Standard" : null,
              sport.expandedEnabled && groups.length ? "Expanded" : null,
            ].filter(Boolean);

            return (
              <details
                key={sport.sport}
                className="border-border bg-card group rounded-xl border"
              >
                <summary className="focus-visible:ring-ring flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{sport.sport}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          sport.enabled
                            ? "border-live/30 bg-live/10 text-live"
                            : "text-muted-foreground",
                        )}
                      >
                        {sport.enabled ? "Enabled" : "Off"}
                      </Badge>
                      {sport.enabled && activeTiers.length ? (
                        <Badge variant="secondary">
                          {activeTiers.join(" + ")}
                        </Badge>
                      ) : null}
                      {(sport.surfaceEnabled && surfaceOverLimit) ||
                      (sport.expandedEnabled && expandedOverLimit) ? (
                        <Badge variant="destructive">Over per-run limit</Badge>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground mt-1 block truncate text-xs">
                      Standard {cadenceLabel(sport.surfaceCadenceMinutes)} · up
                      to {surfaceEstimate.toLocaleString()} credits/run
                      {groups.length
                        ? ` · Expanded ${cadenceLabel(sport.expandedCadenceMinutes)} · up to ${expandedEstimate.toLocaleString()} credits/run`
                        : ""}
                    </span>
                  </span>
                  <ChevronDown
                    className="text-muted-foreground size-5 shrink-0 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>

                <div className="border-border space-y-5 border-t p-4 sm:p-5">
                  <Toggle
                    checked={sport.enabled}
                    onChange={(enabled) =>
                      updateSport(sport.sport, { enabled })
                    }
                    label={`Enable ${sport.sport}`}
                    description="Master switch for this sport. Turning it off prevents both standard and expanded scheduled pulls."
                  />

                  <div className="grid gap-4 xl:grid-cols-2">
                    <fieldset
                      className="border-border space-y-4 rounded-xl border p-4"
                      disabled={!sport.enabled}
                    >
                      <legend className="px-1 font-semibold">
                        Standard board
                      </legend>
                      <p className="text-muted-foreground text-xs">
                        Shared events and primary game lines across SCL&apos;s
                        14-day board window. Estimated maximum:{" "}
                        <span
                          className={cn(
                            "nums text-foreground font-semibold",
                            surfaceOverLimit && "text-neg",
                          )}
                        >
                          {surfaceEstimate.toLocaleString()} credits/run
                        </span>
                        {surfaceOverLimit
                          ? " — lower coverage or raise the per-run limit"
                          : ""}
                      </p>
                      <Toggle
                        checked={sport.surfaceEnabled}
                        onChange={(surfaceEnabled) =>
                          updateSport(sport.sport, { surfaceEnabled })
                        }
                        disabled={!sport.enabled}
                        label="Pull standard board"
                        description="Schedules the selected primary markets below."
                      />
                      <div className="grid gap-2 sm:grid-cols-3">
                        {SURFACE_MARKETS.map((market) => (
                          <Toggle
                            key={market.key}
                            checked={sport.surfaceMarkets.includes(market.key)}
                            disabled={!sport.enabled || !sport.surfaceEnabled}
                            onChange={(checked) =>
                              updateSport(sport.sport, {
                                surfaceMarkets: checked
                                  ? [
                                      ...new Set([
                                        ...sport.surfaceMarkets,
                                        market.key,
                                      ]),
                                    ]
                                  : sport.surfaceMarkets.filter(
                                      (value) => value !== market.key,
                                    ),
                              })
                            }
                            label={market.label}
                          />
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`${sport.sport}-surface-cadence`}>
                          Refresh cadence
                        </Label>
                        <select
                          id={`${sport.sport}-surface-cadence`}
                          value={sport.surfaceCadenceMinutes}
                          disabled={!sport.enabled || !sport.surfaceEnabled}
                          onChange={(event) =>
                            updateSport(sport.sport, {
                              surfaceCadenceMinutes: Number(event.target.value),
                            })
                          }
                          className="border-input bg-background min-h-10 w-full rounded-lg border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {CADENCE_OPTIONS.map((option) => (
                            <option key={option.minutes} value={option.minutes}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </fieldset>

                    <fieldset
                      className="border-border space-y-4 rounded-xl border p-4"
                      disabled={!sport.enabled || groups.length === 0}
                    >
                      <legend className="px-1 font-semibold">
                        Expanded markets
                      </legend>
                      <p className="text-muted-foreground text-xs">
                        Per-event markets for games today and tomorrow.
                        Estimated maximum:{" "}
                        <span
                          className={cn(
                            "nums text-foreground font-semibold",
                            expandedOverLimit && "text-neg",
                          )}
                        >
                          {expandedEstimate.toLocaleString()} credits/run
                        </span>
                        {expandedOverLimit
                          ? " — lower coverage/events or raise the per-run limit"
                          : ""}
                      </p>
                      <Toggle
                        checked={sport.expandedEnabled}
                        onChange={(expandedEnabled) =>
                          updateSport(sport.sport, { expandedEnabled })
                        }
                        disabled={!sport.enabled || groups.length === 0}
                        label="Pull expanded markets"
                        description={
                          groups.length
                            ? "Adds only the market groups selected below."
                            : "Expanded markets are not supported for this sport."
                        }
                      />
                      <div className="space-y-2">
                        {groups.map((group) => {
                          const checked = group.markets.every((market) =>
                            sport.expandedMarkets.includes(market),
                          );
                          return (
                            <Toggle
                              key={group.id}
                              checked={checked}
                              disabled={
                                !sport.enabled || !sport.expandedEnabled
                              }
                              onChange={(enabled) => {
                                const groupMarkets = new Set(group.markets);
                                updateSport(sport.sport, {
                                  expandedMarkets: enabled
                                    ? [
                                        ...new Set([
                                          ...sport.expandedMarkets,
                                          ...group.markets,
                                        ]),
                                      ]
                                    : sport.expandedMarkets.filter(
                                        (market) => !groupMarkets.has(market),
                                      ),
                                });
                              }}
                              label={`${group.label} (${group.markets.length})`}
                              description={group.description}
                            />
                          );
                        })}
                      </div>
                      {groups.length ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor={`${sport.sport}-expanded-cadence`}>
                              Refresh cadence
                            </Label>
                            <select
                              id={`${sport.sport}-expanded-cadence`}
                              value={sport.expandedCadenceMinutes}
                              disabled={
                                !sport.enabled || !sport.expandedEnabled
                              }
                              onChange={(event) =>
                                updateSport(sport.sport, {
                                  expandedCadenceMinutes: Number(
                                    event.target.value,
                                  ),
                                })
                              }
                              className="border-input bg-background min-h-10 w-full rounded-lg border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {CADENCE_OPTIONS.map((option) => (
                                <option
                                  key={option.minutes}
                                  value={option.minutes}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`${sport.sport}-event-limit`}>
                              Max events per run
                            </Label>
                            <Input
                              id={`${sport.sport}-event-limit`}
                              type="number"
                              min={1}
                              max={99}
                              disabled={
                                !sport.enabled || !sport.expandedEnabled
                              }
                              value={sport.maxEventsPerRun}
                              onChange={(event) =>
                                updateSport(sport.sport, {
                                  maxEventsPerRun: numberValue(
                                    event.target.value,
                                    sport.maxEventsPerRun,
                                  ),
                                })
                              }
                            />
                          </div>
                        </div>
                      ) : null}
                    </fieldset>
                  </div>

                  {sport.sport === "SOCCER" ? (
                    <fieldset className="border-border space-y-3 rounded-xl border p-4">
                      <legend className="px-1 font-semibold">
                        League scope
                      </legend>
                      <p className="text-muted-foreground text-xs">
                        Leave every league off to automatically use competitions
                        with upcoming fixtures.
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {SOCCER_CONTROL_LEAGUES.map((league) => (
                          <Toggle
                            key={league.key}
                            checked={sport.leagues.includes(league.key)}
                            disabled={!sport.enabled}
                            onChange={(checked) =>
                              updateSport(sport.sport, {
                                leagues: checked
                                  ? [...sport.leagues, league.key]
                                  : sport.leagues.filter(
                                      (value) => value !== league.key,
                                    ),
                              })
                            }
                            label={league.label}
                          />
                        ))}
                      </div>
                    </fieldset>
                  ) : null}

                  {sport.sport === "TENNIS" ? (
                    <div className="border-border space-y-2 rounded-xl border p-4">
                      <Label htmlFor="tennis-tours">
                        Tournament scope (optional)
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Enter provider tournament keys separated by commas, or
                        leave blank to select live tournaments automatically.
                      </p>
                      <Input
                        id="tennis-tours"
                        disabled={!sport.enabled}
                        value={sport.leagues.join(", ")}
                        onChange={(event) =>
                          updateSport(sport.sport, {
                            leagues: event.target.value
                              .split(",")
                              .map((value) => value.trim().toUpperCase())
                              .filter(Boolean),
                          })
                        }
                        placeholder="Auto-select live tournaments"
                      />
                    </div>
                  ) : null}

                  <div className="border-border bg-surface-2 grid gap-4 rounded-xl border p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <CircleDollarSign
                          className="text-primary size-4"
                          aria-hidden
                        />
                        <p className="text-sm font-semibold">Manual refresh</p>
                      </div>
                      <p className="text-muted-foreground text-xs leading-5">
                        {hasUnsavedChanges
                          ? "Save pending edits before running or simulating."
                          : "Run now starts immediately. Dry run spends zero credits."}
                        <br />
                        Next standard: {scheduleLabel(sport.nextSurfaceRunAt)}
                        {groups.length ? (
                          <>
                            <br />
                            Next expanded:{" "}
                            {scheduleLabel(sport.nextExpandedRunAt)}
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-10"
                        disabled={
                          pending ||
                          hasUnsavedChanges ||
                          !storageReady ||
                          !config.managedSchedulingEnabled ||
                          !sport.enabled ||
                          !sport.surfaceEnabled
                        }
                        onClick={() => runNow(sport.sport, "surface", true)}
                      >
                        <ScanSearch className="size-4" aria-hidden />
                        Dry run standard
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-10"
                        disabled={
                          pending ||
                          hasUnsavedChanges ||
                          !storageReady ||
                          !config.managedSchedulingEnabled ||
                          config.paused ||
                          !sport.enabled ||
                          !sport.surfaceEnabled
                        }
                        onClick={() => runNow(sport.sport, "surface")}
                      >
                        <Play className="size-4" aria-hidden />
                        Run standard now
                      </Button>
                      {groups.length ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-10"
                            disabled={
                              pending ||
                              hasUnsavedChanges ||
                              !storageReady ||
                              !config.managedSchedulingEnabled ||
                              !sport.enabled ||
                              !sport.expandedEnabled
                            }
                            onClick={() =>
                              runNow(sport.sport, "expanded", true)
                            }
                          >
                            <ScanSearch className="size-4" aria-hidden />
                            Dry run expanded
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-10"
                            disabled={
                              pending ||
                              hasUnsavedChanges ||
                              !storageReady ||
                              !config.managedSchedulingEnabled ||
                              config.paused ||
                              !sport.enabled ||
                              !sport.expandedEnabled
                            }
                            onClick={() => runNow(sport.sport, "expanded")}
                          >
                            <Play className="size-4" aria-hidden />
                            Run expanded now
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <div
        className={cn(
          "border-border bg-card sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-xl border p-3 shadow-lg",
          hasUnsavedChanges && "border-primary/40",
        )}
      >
        <div>
          <p className="text-sm font-medium">
            {hasUnsavedChanges ? "Unsaved strategy changes" : "Strategy saved"}
          </p>
          <p className="text-muted-foreground hidden text-xs sm:block">
            Changes are audited. API credentials never reach this form.
          </p>
        </div>
        <Button
          type="submit"
          disabled={
            pending ||
            !storageReady ||
            !hasUnsavedChanges ||
            (config.managedSchedulingEnabled && !canActivate)
          }
        >
          <Save className="size-4" aria-hidden />
          <span className="sm:hidden">{pending ? "Saving…" : "Save"}</span>
          <span className="hidden sm:inline">
            {pending ? "Saving…" : "Save API strategy"}
          </span>
        </Button>
      </div>
    </form>
  );
}
