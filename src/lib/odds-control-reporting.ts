export type UsageHistoryPoint = {
  date: string;
  credits: number;
  trailingAverage: number;
  spike: boolean;
};

export function identifyUsageSpikes(
  rows: Array<{ date: string; credits: number }>,
): UsageHistoryPoint[] {
  return rows.map((row, index) => {
    const prior = rows.slice(Math.max(0, index - 7), index);
    const trailingAverage = prior.length
      ? prior.reduce((sum, point) => sum + point.credits, 0) / prior.length
      : 0;
    const spike =
      row.credits >= 10 &&
      (trailingAverage === 0
        ? row.credits >= 10
        : row.credits >= Math.max(trailingAverage * 2, trailingAverage + 10));
    return {
      ...row,
      trailingAverage: Math.round(trailingAverage * 10) / 10,
      spike,
    };
  });
}

export function formatEasternDateTime(value: string | Date | null): string {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function plainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeSettingsSnapshot(value: unknown) {
  const source = plainRecord(value);
  if (source.config) return source;
  const { sports = [], ...config } = source;
  return { config, sports };
}

function readable(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (value == null || value === "") return "None";
  return String(value);
}

const OMITTED_AUDIT_KEYS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "updatedById",
  "nextSurfaceRunAt",
  "nextExpandedRunAt",
  "lastSurfaceRunAt",
  "lastExpandedRunAt",
]);

function labelFor(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function describeOddsAuditChange(input: {
  action: string;
  target: string;
  before: unknown;
  after: unknown;
}): string[] {
  if (input.action !== "SETTINGS_SAVED") {
    const after = plainRecord(input.after);
    if (input.action === "RUN_NOW") {
      return [`Ran ${input.target}; used ${readable(after.credits)} credits.`];
    }
    if (input.action === "DRY_RUN") {
      return [String(after.message ?? `Simulated ${input.target}.`)];
    }
    return [`${labelFor(input.action)}: ${input.target}`];
  }

  const before = normalizeSettingsSnapshot(input.before);
  const after = normalizeSettingsSnapshot(input.after);
  const changes: string[] = [];
  const beforeConfig = plainRecord(before.config);
  const afterConfig = plainRecord(after.config);
  for (const key of new Set([
    ...Object.keys(beforeConfig),
    ...Object.keys(afterConfig),
  ])) {
    if (OMITTED_AUDIT_KEYS.has(key)) continue;
    if (
      JSON.stringify(beforeConfig[key]) !== JSON.stringify(afterConfig[key])
    ) {
      changes.push(
        `${labelFor(key)}: ${readable(beforeConfig[key])} → ${readable(afterConfig[key])}`,
      );
    }
  }

  const sportMap = (value: unknown) =>
    new Map(
      (Array.isArray(value) ? value : []).map((row) => {
        const record = plainRecord(row);
        return [String(record.sport ?? "Unknown"), record] as const;
      }),
    );
  const beforeSports = sportMap(before.sports);
  const afterSports = sportMap(after.sports);
  for (const [sport, next] of afterSports) {
    const previous = beforeSports.get(sport) ?? {};
    for (const key of Object.keys(next)) {
      if (key === "sport" || OMITTED_AUDIT_KEYS.has(key)) continue;
      if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) {
        changes.push(
          `${sport} ${labelFor(key)}: ${readable(previous[key])} → ${readable(next[key])}`,
        );
      }
    }
  }
  return changes.length
    ? changes
    : ["Saved with no effective strategy change."];
}

export function summarizeOddsRunDetails(details: unknown): {
  events: number;
  populated: number;
  skipped: number;
  fetched: number;
  held: number;
  stale: number;
  unpriced: number;
  refreshedSports: number;
  staleSports: string[];
  dryRun: boolean;
  wouldRun: boolean | null;
  blockedReason: string | null;
} {
  const root = plainRecord(details);
  const surface = plainRecord(root.surface);
  const expanded = plainRecord(root.expanded);
  const totals = {
    events: 0,
    populated: 0,
    skipped: 0,
    fetched: 0,
    held: 0,
    stale: 0,
    unpriced: 0,
  };
  for (const value of Object.values(expanded)) {
    const row = plainRecord(value);
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
      totals[key] += Number(row[key] ?? 0);
    }
  }
  for (const value of Object.values(surface)) {
    const row = plainRecord(value);
    totals.events += Number(row.events ?? 0);
    if (row.source === "provider") totals.fetched += 1;
    if (row.stale === true) totals.stale += 1;
  }
  const provider = plainRecord(root.provider);
  return {
    ...totals,
    refreshedSports: Number(provider.refreshedSports ?? 0),
    staleSports: Array.isArray(provider.staleSports)
      ? provider.staleSports.map(String)
      : [],
    dryRun: root.dryRun === true,
    wouldRun: typeof root.wouldRun === "boolean" ? root.wouldRun : null,
    blockedReason:
      typeof root.blockedReason === "string" ? root.blockedReason : null,
  };
}
