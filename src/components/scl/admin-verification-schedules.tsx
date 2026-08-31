"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Pause, Play, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createVerificationScheduleAction,
  setVerificationScheduleEnabledAction,
} from "@/lib/actions/verification-schedule.action";
import {
  SOCCER_CONTROL_LEAGUES,
  SURFACE_MARKETS,
  allowedExpandedMarkets,
  type OddsControlSport,
} from "@/lib/odds-control";
import { formatEasternDateTime } from "@/lib/odds-control-reporting";
import { verificationMarkets } from "@/lib/odds-verify";
import {
  ALL_SLATE_EVENTS,
  type VerificationScheduleInput,
} from "@/lib/schemas/verification-schedule.schema";
import { scheduledVerificationEstimate } from "@/lib/verification-schedule";
import { cn } from "@/lib/utils";

type SportSettings = {
  sport: OddsControlSport;
  surfaceMarkets: string[];
  expandedMarkets: string[];
};

type Schedule = {
  id: string;
  name: string;
  sport: string;
  scope: string;
  league: string | null;
  coverage: string;
  markets: string[];
  maxEvents: number;
  recurrence: string;
  daysOfWeek: number[];
  timeOfDayMinutes: number | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  enabled: boolean;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Saved rows store the enum; the list reads in the same words as the form. */
const COVERAGE_LABEL: Record<string, string> = {
  SURFACE: "game lines only",
  CONFIGURED: "configured markets",
  ALL: "every supported market",
};

const RECURRENCE_LABEL: Record<string, string> = {
  ONCE: "one time",
  RECURRING: "weekly",
};

export function AdminVerificationSchedules({
  sports,
  schedules,
  verificationLimits,
  storageReady,
}: {
  sports: SportSettings[];
  schedules: Schedule[];
  verificationLimits: {
    dailyCredits: number;
    maxCreditsPerRequest: number;
  };
  storageReady: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<VerificationScheduleInput>({
    name: "",
    sport: "MLB",
    scope: "SLATE",
    league: "",
    coverage: "SURFACE",
    maxEvents: 20,
    recurrence: "ONCE",
    date: "",
    time: "12:00",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  });
  const sport = sports.find((row) => row.sport === draft.sport);
  const leagueCapable = ["SOCCER", "TENNIS"].includes(draft.sport);
  const markets =
    draft.coverage === "SURFACE"
      ? SURFACE_MARKETS.map((row) => row.key)
      : draft.coverage === "ALL"
        ? verificationMarkets(draft.sport)
        : [
            ...new Set([
              ...(sport?.surfaceMarkets ?? []),
              ...(sport?.expandedMarkets ?? []),
            ]),
          ];
  const supportedMarkets = markets.filter((market) =>
    [
      "h2h",
      "spreads",
      "totals",
      ...allowedExpandedMarkets(draft.sport),
    ].includes(market),
  );
  const estimate = scheduledVerificationEstimate({
    markets: supportedMarkets,
    maxEvents: draft.maxEvents,
    surfaceCompetitionCount:
      draft.scope === "LEAGUE"
        ? 1
        : draft.sport === "SOCCER"
          ? 10
          : draft.sport === "TENNIS"
            ? 4
            : 1,
  });
  const overPerRequest =
    supportedMarkets.length > verificationLimits.maxCreditsPerRequest;
  const verificationEstimate = supportedMarkets.length * draft.maxEvents;
  const overDaily = verificationEstimate > verificationLimits.dailyCredits;
  const scheduleReady = Boolean(
    draft.name.trim() &&
    (draft.scope === "SLATE" || draft.league) &&
    (draft.recurrence === "ONCE" ? draft.date : draft.daysOfWeek.length > 0),
  );

  function create() {
    startTransition(async () => {
      const result = await createVerificationScheduleAction(draft);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Verification schedule created");
      setDraft((current) => ({ ...current, name: "", date: "" }));
      router.refresh();
    });
  }

  function toggle(id: string, enabled: boolean) {
    startTransition(async () => {
      const result = await setVerificationScheduleEnabledAction({
        id,
        enabled,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(enabled ? "Schedule resumed" : "Schedule paused");
      router.refresh();
    });
  }

  return (
    <Card id="verification-schedules" className="space-y-5 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-full">
          <CalendarClock className="size-4" aria-hidden />
        </span>
        <div>
          <h3 className="text-lg font-semibold">Scheduled verification runs</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            A verification run re-prices events from the provider so cappers see
            current lines. Each run spends credits, so schedule them for the
            slates that matter — a Sunday NFL card, a fight night — rather than
            leaving one running all week. Times are Eastern, and the dispatcher
            picks up due work within five minutes.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="verification-schedule-name">Schedule name</Label>
          <Input
            id="verification-schedule-name"
            value={draft.name}
            maxLength={80}
            placeholder="NFL Sunday morning slate"
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="verification-schedule-sport">Sport</Label>
          <select
            id="verification-schedule-sport"
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            value={draft.sport}
            onChange={(event) => {
              const nextSport = event.target.value as OddsControlSport;
              setDraft({
                ...draft,
                sport: nextSport,
                scope: ["SOCCER", "TENNIS"].includes(nextSport)
                  ? draft.scope
                  : "SLATE",
                league: "",
              });
            }}
          >
            {sports.map((row) => (
              <option key={row.sport}>{row.sport}</option>
            ))}
          </select>
        </div>
        {/*
          Only soccer and tennis are split into competitions the provider
          prices separately. For every other sport the choice has exactly one
          answer, so offering it — and disabling the option that does not
          apply — asked owners to decide something that was never a decision.
        */}
        {leagueCapable ? (
          <div className="space-y-1.5">
            <Label htmlFor="verification-schedule-scope">Which events</Label>
            <select
              id="verification-schedule-scope"
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              value={draft.scope}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  scope: event.target.value as "SLATE" | "LEAGUE",
                  league: "",
                })
              }
            >
              <option value="SLATE">
                Every {draft.sport === "SOCCER" ? "competition" : "tournament"}
              </option>
              <option value="LEAGUE">
                One {draft.sport === "SOCCER" ? "competition" : "tournament"}{" "}
                only
              </option>
            </select>
            <p className="text-muted-foreground text-xs">
              {draft.sport === "SOCCER" ? "Competitions" : "Tournaments"} are
              billed separately, so narrowing to one is the cheapest run.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Which events</span>
            <p className="border-border bg-surface-2 flex h-10 items-center rounded-md border px-3 text-sm">
              Every {draft.sport} event
            </p>
            <p className="text-muted-foreground text-xs">
              {draft.sport} is priced as one league.
            </p>
          </div>
        )}

        {draft.scope === "LEAGUE" ? (
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="verification-schedule-league">
              {draft.sport === "SOCCER" ? "Competition" : "Tournament"}
            </Label>
            {draft.sport === "SOCCER" ? (
              <select
                id="verification-schedule-league"
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                value={draft.league}
                onChange={(event) =>
                  setDraft({ ...draft, league: event.target.value })
                }
              >
                <option value="">Choose a competition</option>
                {SOCCER_CONTROL_LEAGUES.map((row) => (
                  <option key={row.key} value={row.key}>
                    {row.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="verification-schedule-league"
                value={draft.league}
                placeholder={
                  draft.sport === "TENNIS" ? "Tournament key" : "League key"
                }
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    league: event.target.value.toUpperCase(),
                  })
                }
              />
            )}
            {draft.sport === "TENNIS" ? (
              <p className="text-muted-foreground text-xs">
                Use the tournament tag shown on its events, for example
                ATP_US_OPEN.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="verification-schedule-coverage">
            Markets to price
          </Label>
          <select
            id="verification-schedule-coverage"
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            value={draft.coverage}
            onChange={(event) =>
              setDraft({
                ...draft,
                coverage: event.target
                  .value as VerificationScheduleInput["coverage"],
              })
            }
          >
            <option value="SURFACE">Game lines only</option>
            <option value="CONFIGURED">
              Whatever {draft.sport} is set to pull
            </option>
            <option value="ALL">Every market SCL supports</option>
          </select>
          <p className="text-muted-foreground text-xs">
            {draft.coverage === "SURFACE"
              ? "Moneyline, spread and total — three credits per event."
              : draft.coverage === "CONFIGURED"
                ? `The markets selected for ${draft.sport} under League coverage.`
                : "Every prop, alternate and period market. The most expensive option."}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="verification-schedule-event-mode">
            How many events
          </Label>
          <select
            id="verification-schedule-event-mode"
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            value={draft.maxEvents >= ALL_SLATE_EVENTS ? "ALL" : "LIMIT"}
            onChange={(event) =>
              setDraft({
                ...draft,
                maxEvents: event.target.value === "ALL" ? ALL_SLATE_EVENTS : 20,
              })
            }
          >
            <option value="ALL">All events on the slate</option>
            <option value="LIMIT">Up to a set number</option>
          </select>
          {draft.maxEvents >= ALL_SLATE_EVENTS ? (
            <p className="text-muted-foreground text-xs">
              Every event the slate holds when the run fires.
            </p>
          ) : (
            <>
              <Input
                id="verification-schedule-events"
                type="number"
                aria-label="Maximum events to verify"
                min={1}
                max={ALL_SLATE_EVENTS - 1}
                value={draft.maxEvents}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    maxEvents: Math.max(
                      1,
                      Math.min(
                        ALL_SLATE_EVENTS - 1,
                        Number(event.target.value) || 1,
                      ),
                    ),
                  })
                }
              />
              <p className="text-muted-foreground text-xs">
                Events are taken in kickoff order, soonest first.
              </p>
            </>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="verification-schedule-recurrence">When it runs</Label>
          <select
            id="verification-schedule-recurrence"
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            value={draft.recurrence}
            onChange={(event) =>
              setDraft({
                ...draft,
                recurrence: event.target.value as "ONCE" | "RECURRING",
              })
            }
          >
            <option value="ONCE">One time, on a date I pick</option>
            <option value="RECURRING">Every week, on days I pick</option>
          </select>
          <p className="text-muted-foreground text-xs">
            {draft.recurrence === "ONCE"
              ? "Runs at the date and time below, then deletes itself from the queue."
              : "Repeats at the same Eastern time on each day you select. Pick all seven for a daily run."}
          </p>
        </div>
        {draft.recurrence === "ONCE" ? (
          <div className="space-y-1.5">
            <Label htmlFor="verification-schedule-date">Date to run</Label>
            <Input
              id="verification-schedule-date"
              type="date"
              value={draft.date}
              onChange={(event) =>
                setDraft({ ...draft, date: event.target.value })
              }
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="verification-schedule-time">
            Time to run (Eastern)
          </Label>
          <Input
            id="verification-schedule-time"
            type="time"
            value={draft.time}
            onChange={(event) =>
              setDraft({ ...draft, time: event.target.value })
            }
          />
        </div>
      </div>

      {draft.recurrence === "RECURRING" ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            Days of the week to repeat on
          </legend>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day, index) => {
              const selected = draft.daysOfWeek.includes(index);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    "min-h-10 rounded-lg border px-3 text-sm",
                    selected ? "border-primary bg-primary/10" : "border-border",
                  )}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      daysOfWeek: selected
                        ? draft.daysOfWeek.filter((value) => value !== index)
                        : [...draft.daysOfWeek, index],
                    })
                  }
                >
                  {day}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="border-border bg-surface-2 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p
            className={cn(
              "font-medium",
              (overPerRequest || overDaily) && "text-neg",
            )}
          >
            Up to {estimate.toLocaleString()} credits per run
          </p>
          <p className="text-muted-foreground text-xs">
            {supportedMarkets.length} markets ×{" "}
            {draft.maxEvents >= ALL_SLATE_EVENTS
              ? "every event on the slate"
              : `${draft.maxEvents} events`}
            , plus event discovery. All guardrails still apply.
          </p>
          {overPerRequest ? (
            <p className="text-neg mt-1 text-xs">
              This coverage requests {supportedMarkets.length} credits per
              event; the current per-verification maximum is{" "}
              {verificationLimits.maxCreditsPerRequest}. Choose fewer markets or
              raise that guardrail first.
            </p>
          ) : null}
          {overDaily ? (
            <p className="text-neg mt-1 text-xs">
              This estimate exceeds the current{" "}
              {verificationLimits.dailyCredits.toLocaleString()}-credit daily
              verification budget.
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          disabled={
            pending ||
            !storageReady ||
            !scheduleReady ||
            overPerRequest ||
            overDaily
          }
          onClick={create}
        >
          <Plus className="size-4" aria-hidden />
          Create schedule
        </Button>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Saved schedules</h4>
        {schedules.length ? (
          schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="border-border flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">{schedule.name}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {schedule.sport} ·{" "}
                  {schedule.league ?? `every ${schedule.sport} event`} ·{" "}
                  {COVERAGE_LABEL[schedule.coverage] ??
                    schedule.coverage.toLowerCase()}{" "}
                  ·{" "}
                  {schedule.maxEvents >= ALL_SLATE_EVENTS
                    ? "all events"
                    : `up to ${schedule.maxEvents} events`}{" "}
                  · {RECURRENCE_LABEL[schedule.recurrence] ?? "scheduled"}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Next: {formatEasternDateTime(schedule.nextRunAt)} · Last:{" "}
                  {schedule.lastStatus ?? "Never run"}
                </p>
              </div>
              {schedule.recurrence === "ONCE" && schedule.lastRunAt ? (
                <span className="text-muted-foreground text-xs">
                  One-time run finished
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => toggle(schedule.id, !schedule.enabled)}
                >
                  {schedule.enabled ? (
                    <Pause className="size-4" aria-hidden />
                  ) : (
                    <Play className="size-4" aria-hidden />
                  )}
                  {schedule.enabled ? "Pause" : "Resume"}
                </Button>
              )}
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">
            No verification schedules yet.
          </p>
        )}
      </div>
    </Card>
  );
}
