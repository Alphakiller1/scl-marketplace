import "server-only";

import type { Outcome } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { computeCapperStats, type PlayForStats } from "@/lib/stats";
import type { CapperSummary, FormResult } from "@/lib/mock";
import { safeHttpUrl } from "@/lib/urls";

/**
 * Live leaderboard data — computed from real plays, never fabricated. Only
 * cappers with a public handle (User.username) are ranked. When the database
 * is empty the board is empty (honest); pages render an empty state, not mock.
 */

function fetchRankableProfiles() {
  return prisma.capperProfile.findMany({
    where: { user: { username: { not: null } } },
    select: {
      id: true,
      avatarUrl: true,
      bannerUrl: true,
      headline: true,
      bio: true,
      specialties: true,
      sports: true,
      instagram: true,
      twitter: true,
      website: true,
      createdAt: true,
      user: {
        select: { displayName: true, username: true, emailVerified: true },
      },
      plays: {
        select: {
          outcome: true,
          units: true,
          profitUnits: true,
          sport: true,
          createdAt: true,
          gradedAt: true,
        },
      },
    },
  });
}

type ProfileRow = Awaited<ReturnType<typeof fetchRankableProfiles>>[number];

function topSport(sports: string[], fallback?: string): string {
  if (sports.length === 0) return fallback ?? "—";
  const counts = new Map<string, number>();
  for (const s of sports) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Recent form + current streak from settled outcomes, oldest → newest. */
function deriveForm(settled: Outcome[]): {
  recentForm: FormResult[];
  streak: number;
} {
  const forms = settled.map((o) =>
    o === "WIN" ? "W" : o === "LOSS" ? "L" : "P",
  ) as FormResult[];

  let streak = 0;
  for (let i = forms.length - 1; i >= 0; i--) {
    const f = forms[i];
    if (f === "P") continue; // a push is neutral — skip it, don't break the streak
    if (streak === 0) streak = f === "W" ? 1 : -1;
    else if (streak > 0 && f === "W") streak++;
    else if (streak < 0 && f === "L") streak--;
    else break;
  }

  return { recentForm: forms.slice(-6), streak };
}

function pruneSocials(
  twitter: string | null,
  instagram: string | null,
  website: string | null,
): CapperSummary["socials"] {
  const out: NonNullable<CapperSummary["socials"]> = {};
  if (twitter) out.twitter = twitter;
  if (instagram) out.instagram = instagram;
  const safeWebsite = safeHttpUrl(website);
  if (safeWebsite) out.website = safeWebsite;
  return Object.keys(out).length ? out : undefined;
}

function summarize(p: ProfileRow): CapperSummary | null {
  const username = p.user.username;
  if (!username) return null;

  const playsForStats: PlayForStats[] = p.plays.map((pl) => ({
    outcome: pl.outcome,
    units: Number(pl.units),
    profitUnits: pl.profitUnits == null ? null : Number(pl.profitUnits),
  }));
  const stats = computeCapperStats(playsForStats);

  const settled = [...p.plays]
    .filter(
      (pl) =>
        pl.outcome === "WIN" || pl.outcome === "LOSS" || pl.outcome === "PUSH",
    )
    .sort(
      (a, b) =>
        (a.gradedAt ?? a.createdAt).getTime() -
        (b.gradedAt ?? b.createdAt).getTime(),
    )
    .map((pl) => pl.outcome);
  const { recentForm, streak } = deriveForm(settled);

  return {
    id: p.id,
    name: p.user.displayName ?? username,
    handle: username,
    avatarUrl: p.avatarUrl ?? undefined,
    bannerUrl: p.bannerUrl ?? undefined,
    verified: p.user.emailVerified != null,
    topSport: topSport(
      p.plays.map((x) => x.sport),
      p.sports[0],
    ),
    rank: 0, // assigned after sort
    rankDelta: 0, // no historical snapshot yet — honest neutral
    record: { w: stats.wins, l: stats.losses, p: stats.pushes },
    winPct: stats.winPct,
    units: stats.units,
    roi: stats.roi,
    streak,
    recentForm,
    trophies: [],
    headline: p.headline ?? undefined,
    bio: p.bio ?? undefined,
    specialties: p.specialties.length ? p.specialties : undefined,
    sports: p.sports.length ? p.sports : undefined,
    joinedAt: p.createdAt,
    socials: pruneSocials(p.twitter, p.instagram, p.website),
  };
}

const withTrophy = (c: CapperSummary, t: string) => {
  if (!c.trophies.includes(t)) c.trophies.push(t);
};

export async function getLeaderboard(): Promise<CapperSummary[]> {
  let profiles: ProfileRow[];
  try {
    profiles = await fetchRankableProfiles();
  } catch (err) {
    console.error("[getLeaderboard] database unavailable:", err);
    return [];
  }

  const cappers = profiles
    .map(summarize)
    .filter((c): c is CapperSummary => c !== null);

  // Rank by net units, then ROI as the tiebreak.
  cappers.sort((a, b) => b.units - a.units || b.roi - a.roi);
  cappers.forEach((c, i) => {
    c.rank = i + 1;
  });

  // Modest, data-derived honors (no fabricated awards).
  if (cappers.length) {
    if (cappers[0].units > 0) withTrophy(cappers[0], "Top Units");
    const topRoi = cappers
      .filter((c) => c.units > 0)
      .sort((a, b) => b.roi - a.roi)[0];
    if (topRoi) withTrophy(topRoi, "Top ROI");
    for (const c of cappers) if (c.streak >= 4) withTrophy(c, "Hot Streak");
  }

  return cappers;
}
