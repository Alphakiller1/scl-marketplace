/**
 * Public identity display helpers.
 * Format for UI only — never mutate DB/route handles.
 *
 * Product rule: public identity is @username only. `displayName` may still
 * exist in the DB but is not read for marketplace surfaces.
 */

export type IdentityInput = {
  /** @deprecated Ignored — username-only identity. Kept so call sites type-check during migration. */
  displayName?: string | null;
  handle?: string | null;
  /** @deprecated No-op — there is no secondary line when identity is handle-only. */
  compact?: boolean;
};

export type IdentityDisplayLines = {
  /** `@handle` when present; empty string when missing (never a fake name). */
  primary: string;
  /** Always null under username-only identity. */
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

/**
 * Resolve primary identity for marketplace surfaces.
 * Always `@handle` when available; otherwise an empty string (never a placeholder name).
 */
export function identityDisplayLines(
  input: IdentityInput,
): IdentityDisplayLines {
  const handleFmt = formatHandle(input.handle);
  return { primary: handleFmt ?? "", secondary: null };
}

/** CapperSummary-friendly resolution — username only. */
export function identityDisplayLinesFromCapper(
  capper: {
    name: string;
    handle: string;
    displayName?: string | null;
  },
  _opts?: { compact?: boolean },
): IdentityDisplayLines {
  return identityDisplayLines({ handle: capper.handle || capper.name });
}
