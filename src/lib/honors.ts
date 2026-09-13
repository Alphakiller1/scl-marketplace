export type AwardPeriod = "monthly" | "seasonal" | "annual";
export type AwardMetric = "units" | "roi";

export type HonorWinner = {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  record: { w: number; l: number; p: number };
  units: number;
  roi: number;
};

export type HonorAward = {
  id: string;
  name: string;
  abbreviation: string;
  icon: string;
  period: AwardPeriod;
  sport: string;
  metric: AwardMetric;
  minimumPicks: number;
  visibleFrom: Date;
  visibleUntil: Date;
  winner: HonorWinner;
};

export function awardMonthLabel(now: Date): string {
  return (
    now
      .toLocaleString("en-US", { month: "short", timeZone: "UTC" })
      .toUpperCase() + String(now.getUTCFullYear()).slice(-2)
  );
}

export function makeHonorAward(
  input: Omit<HonorAward, "id" | "visibleFrom" | "visibleUntil">,
  now = new Date(),
): HonorAward {
  const visibleFrom = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const visibleUntil = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1),
  );
  return {
    ...input,
    id: `${input.period}-${input.sport.toLowerCase()}-${input.metric}-${now.getUTCFullYear()}-${now.getUTCMonth() + 1}`,
    visibleFrom,
    visibleUntil,
  };
}

export function awardsForCapper(
  awards: readonly HonorAward[],
  capperId: string,
) {
  return awards.filter((award) => award.winner.id === capperId);
}

export const DEFAULT_HONORS_BODY = `SCL Honors recognizes qualifying tracked performance across monthly, seasonal, and annual periods. Results use the same settled-position and sport-attribution logic as the leaderboard.

Monthly Units Champion and Monthly ROI Champion use the current calendar month and require at least 10 settled picks. Seasonal Units Champion and Seasonal ROI Champion use the rolling 90-day season window and require at least 25 settled picks. Annual Units Champion and Annual ROI Champion use the current calendar year and require at least 50 settled picks.

Cross Sport Parlay Allstar is awarded monthly to the eligible capper with the most net units from Cross-Sports parlays. A minimum of 10 settled Cross-Sports parlays is required. There is no ROI version of this award.

Each award records its metric, sport, minimum sample, winner result, and visibility dates. Saved winners remain in the capper's Trophy Case after the featured visibility window ends.`;
