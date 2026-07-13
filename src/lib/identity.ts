/**
 * Public identity display helpers.
 * Format for UI only — never mutate DB/route handles.
 */

export type IdentityInput = {
  displayName?: string | null;
  handle?: string | null;
  /**
   * Compact cards (feed, leaderboard rows) collapse near-duplicate
   * display-name / @handle pairs. Profile-style two-line UIs keep both.
   */
  compact?: boolean;
};

export type IdentityDisplayLines = {
  /** What to show first (display name, or @handle when name is missing). */
  primary: string;
  /** Formatted @handle when distinct and worth showing; otherwise null. */
  secondary: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when a string looks like an email address (never show publicly). */
export function looksLikeEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  return EMAIL_RE.test(value.trim());
}

/**
 * Strip leading @ for comparison / route use. Does not change casing or
 * content beyond trimming and @-prefix removal. Returns null when empty
 * or email-shaped.
 */
export function bareHandle(handle: string | null | undefined): string | null {
  if (!handle) return null;
  const bare = handle.trim().replace(/^@+/, "");
  if (!bare || looksLikeEmail(bare)) return null;
  return bare;
}

/**
 * Normalize a public handle for display: exactly one leading `@`.
 * Returns null when empty or email-shaped. Does not mutate the source value.
 */
export function formatHandle(handle: string | null | undefined): string | null {
  const bare = bareHandle(handle);
  return bare ? `@${bare}` : null;
}

/** Case-insensitive identity key for duplicate detection (Battle ≈ @battle). */
export function normalizeIdentityKey(value: string): string {
  return value
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function identityKeysEqual(a: string, b: string): boolean {
  const ka = normalizeIdentityKey(a);
  const kb = normalizeIdentityKey(b);
  return Boolean(ka) && ka === kb;
}

function cleanPublicLabel(value?: string | null): string | null {
  const trimmed = value?.trim() || null;
  if (!trimmed) return null;
  if (looksLikeEmail(trimmed)) return null;
  return trimmed;
}

/**
 * Resolve primary / secondary identity lines for marketplace surfaces.
 *
 * - Primary: display name; if missing → @handle only
 * - Secondary: @handle when present and distinct
 * - Never surfaces raw email
 * - Compact mode collapses near-duplicate name/@handle pairs
 */
export function identityDisplayLines(
  input: IdentityInput,
): IdentityDisplayLines {
  const name = cleanPublicLabel(input.displayName);
  const handleFmt = formatHandle(input.handle);
  const handleBare = bareHandle(input.handle);

  if (name && handleFmt && handleBare) {
    const duplicate = identityKeysEqual(name, handleBare);
    if (input.compact && duplicate) {
      return { primary: name, secondary: null };
    }
    return { primary: name, secondary: handleFmt };
  }

  if (name) return { primary: name, secondary: null };
  if (handleFmt) return { primary: handleFmt, secondary: null };

  return { primary: "SCL Capper", secondary: null };
}

/**
 * CapperSummary-friendly resolution. Prefer raw `displayName` when present;
 * when only the resolved `name` is available, treat name≈handle as a missing
 * display name so compact surfaces can show @handle alone.
 */
export function identityDisplayLinesFromCapper(
  capper: {
    name: string;
    handle: string;
    displayName?: string | null;
  },
  opts?: { compact?: boolean },
): IdentityDisplayLines {
  let displayName: string | null | undefined = capper.displayName;

  if (displayName === undefined) {
    displayName = identityKeysEqual(capper.name, capper.handle)
      ? null
      : capper.name;
  }

  return identityDisplayLines({
    displayName,
    handle: capper.handle,
    compact: opts?.compact,
  });
}
