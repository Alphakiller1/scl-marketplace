"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, Play, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  queueOddsRunAction,
  saveOddsControlSettingsAction,
} from "@/lib/actions/odds-control.action";
import {
  CADENCE_OPTIONS,
  estimatedRunCredits,
  expandedMarketGroups,
  SOCCER_CONTROL_LEAGUES,
  SURFACE_MARKETS,
  type OddsControlSport,
} from "@/lib/odds-control";
import type { OddsControlSettingsInput } from "@/lib/schemas/odds-control.schema";

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
    <label className="border-border bg-surface-2 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="accent-primary mt-0.5 size-4 shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description ? (
          <span className="text-muted-foreground block text-xs leading-relaxed">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function numberValue(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

export function AdminOddsControlEditor({
  initialConfig,
  initialSports,
  storageReady,
}: {
  initialConfig: Omit<OddsControlSettingsInput, "sports">;
  initialSports: SportDraft[];
  storageReady: boolean;
}) {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [sports, setSports] = useState(initialSports);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pending, startTransition] = useTransition();

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

  function queue(sport: string, tier: "surface" | "expanded") {
    startTransition(async () => {
      const result = await queueOddsRunAction({ sport, tier });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${sport} ${tier} refresh queued`);
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {!storageReady ? (
        <div className="border-border bg-surface-2 flex gap-3 rounded-xl border p-4 text-sm">
          <AlertTriangle
            className="text-neg mt-0.5 size-4 shrink-0"
            aria-hidden
          />
          <p>
            Preview mode: the database migration has not been applied. Controls
            are visible, but saving and scheduled execution remain disabled.
          </p>
        </div>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Global guardrails</h2>
          <p className="text-muted-foreground text-sm">
            Hard limits include completed usage and credits reserved by active
            runs.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Daily limit", "dailyCreditLimit"],
            ["Weekly limit", "weeklyCreditLimit"],
            ["Monthly limit", "monthlyCreditLimit"],
            ["Protected reserve", "reserveCredits"],
            ["Warning at %", "warningPercent"],
          ].map(([label, key]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="number"
                min={key === "reserveCredits" ? 0 : 1}
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
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            checked={config.managedSchedulingEnabled}
            onChange={(managedSchedulingEnabled) =>
              updateConfig({ managedSchedulingEnabled })
            }
            label="Enable owner-managed scheduling"
            description="Off by default. Until enabled, the existing production cadence remains authoritative."
          />
          <Toggle
            checked={config.paused}
            onChange={(paused) => updateConfig({ paused })}
            label="Pause optional API population"
            description="Stops scheduled board refreshes while retaining protected results and verification activity."
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Sport strategy</h2>
          <p className="text-muted-foreground text-sm">
            Select coverage and cadence. Cost figures are conservative upper
            estimates.
          </p>
        </div>
        <div className="space-y-4">
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
            return (
              <details
                key={sport.sport}
                className="border-border bg-card rounded-xl border"
              >
                <summary className="focus-visible:ring-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 outline-none focus-visible:ring-3">
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={sport.enabled}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        updateSport(sport.sport, {
                          enabled: event.target.checked,
                        })
                      }
                      className="accent-primary size-4"
                      aria-label={`Enable ${sport.sport}`}
                    />
                    <span>
                      <span className="block font-semibold">{sport.sport}</span>
                      <span className="text-muted-foreground block text-xs">
                        Surface ≤ {surfaceEstimate.toLocaleString()} · Expanded
                        ≤ {expandedEstimate.toLocaleString()} credits/run
                      </span>
                    </span>
                  </span>
                  <CalendarClock
                    className="text-muted-foreground size-4"
                    aria-hidden
                  />
                </summary>
                <div className="border-border space-y-5 border-t p-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      <Toggle
                        checked={sport.surfaceEnabled}
                        onChange={(surfaceEnabled) =>
                          updateSport(sport.sport, { surfaceEnabled })
                        }
                        disabled={!sport.enabled}
                        label="Surface board"
                        description="Shared event board and standard game lines."
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
                          Surface cadence
                        </Label>
                        <select
                          id={`${sport.sport}-surface-cadence`}
                          value={sport.surfaceCadenceMinutes}
                          onChange={(event) =>
                            updateSport(sport.sport, {
                              surfaceCadenceMinutes: Number(event.target.value),
                            })
                          }
                          className="border-input bg-background min-h-10 w-full rounded-lg border px-3 text-sm"
                        >
                          {CADENCE_OPTIONS.map((option) => (
                            <option key={option.minutes} value={option.minutes}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Toggle
                        checked={sport.expandedEnabled}
                        onChange={(expandedEnabled) =>
                          updateSport(sport.sport, { expandedEnabled })
                        }
                        disabled={!sport.enabled || groups.length === 0}
                        label="Expanded coverage"
                        description={
                          groups.length
                            ? "Alternates, props, and supported specialty markets."
                            : "No expanded markets are currently supported for this sport."
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
                              Expanded cadence
                            </Label>
                            <select
                              id={`${sport.sport}-expanded-cadence`}
                              value={sport.expandedCadenceMinutes}
                              onChange={(event) =>
                                updateSport(sport.sport, {
                                  expandedCadenceMinutes: Number(
                                    event.target.value,
                                  ),
                                })
                              }
                              className="border-input bg-background min-h-10 w-full rounded-lg border px-3 text-sm"
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
                              Max events/run
                            </Label>
                            <Input
                              id={`${sport.sport}-event-limit`}
                              type="number"
                              min={1}
                              max={99}
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
                    </div>
                  </div>

                  {sport.sport === "SOCCER" ? (
                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium">
                        Soccer leagues
                      </legend>
                      <p className="text-muted-foreground text-xs">
                        Leave all unchecked to let the live provider catalog
                        select competitions with upcoming fixtures.
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {SOCCER_CONTROL_LEAGUES.map((league) => (
                          <Toggle
                            key={league.key}
                            checked={sport.leagues.includes(league.key)}
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
                    <div className="space-y-1.5">
                      <Label htmlFor="tennis-tours">
                        Tournament keys (optional)
                      </Label>
                      <Input
                        id="tennis-tours"
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

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-muted-foreground text-xs">
                      {hasUnsavedChanges
                        ? "Save pending edits before queueing."
                        : "Queue uses the last saved strategy."}{" "}
                      · Next surface:{" "}
                      {sport.nextSurfaceRunAt
                        ? new Date(sport.nextSurfaceRunAt).toLocaleString()
                        : "not scheduled"}
                      {groups.length
                        ? ` · Next expanded: ${sport.nextExpandedRunAt ? new Date(sport.nextExpandedRunAt).toLocaleString() : "not scheduled"}`
                        : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          pending ||
                          hasUnsavedChanges ||
                          !storageReady ||
                          !config.managedSchedulingEnabled ||
                          !sport.enabled ||
                          !sport.surfaceEnabled
                        }
                        onClick={() => queue(sport.sport, "surface")}
                      >
                        <Play className="size-4" aria-hidden /> Queue surface
                      </Button>
                      {groups.length ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            pending ||
                            hasUnsavedChanges ||
                            !storageReady ||
                            !config.managedSchedulingEnabled ||
                            !sport.enabled ||
                            !sport.expandedEnabled
                          }
                          onClick={() => queue(sport.sport, "expanded")}
                        >
                          <Play className="size-4" aria-hidden /> Queue expanded
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <div className="border-border bg-card sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 shadow-lg">
        <p className="text-muted-foreground text-xs">
          Saving records an append-only change event. API credentials never
          reach this form.
        </p>
        <Button type="submit" disabled={pending || !storageReady}>
          <Save className="size-4" aria-hidden />
          {pending ? "Saving…" : "Save API strategy"}
        </Button>
      </div>
    </form>
  );
}
