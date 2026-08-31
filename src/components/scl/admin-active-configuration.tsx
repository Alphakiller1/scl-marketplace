import { Globe, Layers, Lock, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  ActiveConfiguration,
  LeagueConfiguration,
  OddsConfigEntry,
} from "@/lib/odds-control-configuration";
import { cn } from "@/lib/utils";

/**
 * Read-only answer to "what is actually in force right now?".
 *
 * The editor below it is where settings change; this is where they can be read
 * without opening eleven accordions. Every row says which of the two scopes it
 * belongs to, and a league row that replaces a universal value prints both, so
 * the precedence rule is visible rather than asserted.
 */

function ScopeChip({ entry }: { entry: OddsConfigEntry }) {
  if (entry.source === "code") {
    return (
      <Badge
        variant="outline"
        className="text-muted-foreground shrink-0 gap-1 font-medium"
      >
        <Lock className="size-3" aria-hidden />
        Set in code
      </Badge>
    );
  }
  if (entry.overridesUniversal) {
    return (
      <Badge
        variant="outline"
        className="border-primary/40 bg-primary/10 text-primary shrink-0 gap-1 font-medium"
      >
        <Trophy className="size-3" aria-hidden />
        League override
      </Badge>
    );
  }
  if (entry.scope === "league") {
    return (
      <Badge
        variant="outline"
        className="text-muted-foreground shrink-0 font-medium"
      >
        Inherited
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-muted-foreground shrink-0 gap-1 font-medium"
    >
      <Globe className="size-3" aria-hidden />
      All leagues
    </Badge>
  );
}

function EntryRow({ entry }: { entry: OddsConfigEntry }) {
  const replaced =
    entry.overridesUniversal && entry.universalValue
      ? entry.universalValue
      : null;

  return (
    <div className="grid gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{entry.label}</p>
          {entry.scope === "universal" && entry.overridable ? (
            <span className="text-muted-foreground text-xs">
              {entry.overriddenBy?.length
                ? `overridden by ${entry.overriddenBy.join(", ")}`
                : "no league overrides it"}
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
          {entry.description}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-col sm:items-end sm:gap-1">
        <p
          className={cn(
            "nums text-sm font-semibold",
            entry.overridesUniversal && "text-primary",
          )}
        >
          {entry.value}
        </p>
        {replaced ? (
          <p className="text-muted-foreground text-xs">universal: {replaced}</p>
        ) : null}
        <ScopeChip entry={entry} />
      </div>
    </div>
  );
}

function LeagueCard({ league }: { league: LeagueConfiguration }) {
  return (
    <details
      className="border-border bg-card group rounded-xl border"
      open={league.enabled && league.overrideCount > 0}
    >
      <summary className="focus-visible:ring-ring flex min-h-16 cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{league.sport}</span>
            <Badge
              variant="outline"
              className={cn(
                league.enabled
                  ? "border-live/30 bg-live/10 text-live"
                  : "text-muted-foreground",
              )}
            >
              {league.enabled ? "Enabled" : "Off"}
            </Badge>
            {league.tiers.length ? (
              <Badge variant="secondary">{league.tiers.join(" + ")}</Badge>
            ) : null}
            {league.overrideCount ? (
              <Badge
                variant="outline"
                className="border-primary/40 bg-primary/10 text-primary"
              >
                {league.overrideCount} override
                {league.overrideCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </span>
          <span className="text-muted-foreground mt-1 block text-xs">
            {league.overrideCount
              ? `${league.inheritedCount} settings inherited from universal`
              : "Every setting inherited from universal"}
            {league.enabled && league.estimatedCreditsPerCycle > 0
              ? ` · up to ${league.estimatedCreditsPerCycle.toLocaleString()} credits per cycle`
              : ""}
          </span>
        </span>
        <span className="text-muted-foreground text-xs group-open:hidden">
          Show settings
        </span>
        <span className="text-muted-foreground hidden text-xs group-open:inline">
          Hide settings
        </span>
      </summary>
      <div className="border-border divide-border divide-y border-t px-4 sm:px-5">
        {league.entries.map((entry) => (
          <EntryRow key={`${league.sport}-${entry.id}`} entry={entry} />
        ))}
      </div>
    </details>
  );
}

export function AdminActiveConfiguration({
  configuration,
}: {
  configuration: ActiveConfiguration;
}) {
  const { counts } = configuration;
  const overridable = configuration.universal.filter(
    (entry) => entry.overridable,
  );
  const fixed = configuration.universal.filter((entry) => !entry.overridable);

  return (
    <div className="space-y-4">
      <Card className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
        <div>
          <p className="text-muted-foreground text-xs">Universal settings</p>
          <p className="nums mt-1 text-xl font-semibold">{counts.universal}</p>
          <p className="text-muted-foreground text-xs">apply to every league</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">League overrides</p>
          <p className="nums mt-1 text-xl font-semibold">{counts.overrides}</p>
          <p className="text-muted-foreground text-xs">
            replace a universal value for one league
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Leagues enabled</p>
          <p className="nums mt-1 text-xl font-semibold">
            {counts.leaguesEnabled}{" "}
            <span className="text-muted-foreground text-base font-normal">
              / {counts.leaguesTotal}
            </span>
          </p>
          <p className="text-muted-foreground text-xs">
            can run a scheduled pull
          </p>
        </div>
      </Card>

      <div className="border-border bg-surface-2 rounded-xl border p-4 text-sm">
        <p className="font-medium">How the two scopes combine</p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          A universal setting applies to every league. Where a league sets its
          own value, that value wins <strong>for that league only</strong> and
          every other league keeps the universal one. The credit limits and the
          protected reserve are the exception: they are one shared pool, so they
          are decided once for all leagues and no league can raise its own.
        </p>
      </div>

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <span className="bg-surface-2 text-muted-foreground grid size-8 shrink-0 place-items-center rounded-lg">
            <Globe className="size-4" aria-hidden />
          </span>
          <div>
            <h3 className="font-semibold">Universal — spend and safety</h3>
            <p className="text-muted-foreground text-xs">
              One shared pool. These cannot be set per league.
            </p>
          </div>
        </div>
        <div className="divide-border divide-y">
          {fixed.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      </Card>

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <span className="bg-surface-2 text-muted-foreground grid size-8 shrink-0 place-items-center rounded-lg">
            <Layers className="size-4" aria-hidden />
          </span>
          <div>
            <h3 className="font-semibold">Universal — coverage defaults</h3>
            <p className="text-muted-foreground text-xs">
              What a league uses until it is given its own value.
            </p>
          </div>
        </div>
        <div className="divide-border divide-y">
          {overridable.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      </Card>

      <div className="space-y-2">
        <div className="flex items-start gap-2.5">
          <span className="bg-surface-2 text-primary grid size-8 shrink-0 place-items-center rounded-lg">
            <Trophy className="size-4" aria-hidden />
          </span>
          <div>
            <h3 className="font-semibold">By league</h3>
            <p className="text-muted-foreground text-xs">
              Enabled leagues first, then by what one cycle can spend. Leagues
              with an override are opened.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {configuration.leagues.map((league) => (
            <LeagueCard key={league.sport} league={league} />
          ))}
        </div>
      </div>
    </div>
  );
}
