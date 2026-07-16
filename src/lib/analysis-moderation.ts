const BANNED_TERMS = [
  "lock",
  "locks",
  "guaranteed",
  "guarantee",
  "easy money",
  "can't lose",
  "cant lose",
  "free money",
] as const;

/**
 * Returns an error message when analysis copy contains banned hype terms;
 * undefined when safe or empty.
 */
export function assertAnalysisSafe(
  notes: string | undefined,
): string | undefined {
  const text = notes?.trim();
  if (!text) return undefined;

  const lower = text.toLowerCase();
  for (const term of BANNED_TERMS) {
    if (lower.includes(term)) {
      return `Analysis cannot include hype terms like "${term}". Keep it factual.`;
    }
  }
  return undefined;
}
