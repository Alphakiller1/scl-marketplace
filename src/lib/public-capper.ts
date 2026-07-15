/**
 * Shared eligibility for public surfaces that list cappers / their plays.
 * "Listed" = ACTIVE account with a public username (handle).
 * Ranking sample gates (min picks, non-negative units/ROI) live in leaderboard.ts.
 */

export const PUBLIC_LISTED_CAPPER_USER_WHERE = {
  accountStatus: "ACTIVE" as const,
  username: { not: null },
};
