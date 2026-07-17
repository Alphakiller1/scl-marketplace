import { LeagueMark } from "@/components/scl/league-mark";
import { SportTag } from "@/components/scl/badges";
import { TeamMark } from "@/components/scl/team-mark";
import { teamIdentityFromSide } from "@/lib/pick-identity";
import { getTeamIdentity } from "@/lib/teams";
import { cn } from "@/lib/utils";

const NON_TEAM = new Set(["over", "under"]);

/**
 * League/sport chip with mark — use anywhere a league or sport is named.
 */
export function LeagueRef({
  sport,
  league,
  className,
  markOnly = false,
}: {
  sport: string;
  league?: string | null;
  className?: string;
  markOnly?: boolean;
}) {
  const key = (league?.trim() || sport).trim();
  if (!key) return null;
  if (markOnly) {
    return <LeagueMark leagueKey={key} size="sm" className={className} />;
  }
  return <SportTag sport={key} className={className} />;
}

/**
 * Team row mark + optional short name. Always paints a TeamMark when `name` is a
 * team side (not Over/Under). Uses color+abbr fallback when no logo asset exists.
 *
 * Set `knownOnly` on public trust surfaces so free-text never invents a mark.
 */
export function TeamRef({
  name,
  sport,
  size = "sm",
  showName = false,
  knownOnly = false,
  className,
}: {
  name: string | null | undefined;
  sport: string;
  size?: "sm" | "md";
  showName?: boolean;
  knownOnly?: boolean;
  className?: string;
}) {
  if (!name?.trim()) return null;
  if (NON_TEAM.has(name.trim().toLowerCase())) return null;
  const team = knownOnly
    ? teamIdentityFromSide(name, sport)
    : getTeamIdentity(name, sport);
  if (!team) return null;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <TeamMark team={team} size={size} />
      {showName ? (
        <span className="truncate text-sm font-medium">{team.shortName}</span>
      ) : null}
    </span>
  );
}

/** True when `side` should get a team mark (board side that isn't Over/Under). */
export function isTeamSide(side: string | null | undefined): boolean {
  if (!side?.trim()) return false;
  return !NON_TEAM.has(side.trim().toLowerCase());
}
