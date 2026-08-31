import {
  CADENCE_OPTIONS,
  oddsStrategyForecast,
  type OddsStrategyForecastInput,
} from "@/lib/odds-control";

export type OddsOwnerPlaybookInput = OddsStrategyForecastInput & {
  managedSchedulingEnabled: boolean;
  paused: boolean;
  warningPercent: number;
  verificationDailyRequestLimit: number;
  verificationMaxCreditsPerRequest: number;
  verificationCacheMinutes: number;
  timezone: string;
};

function cadenceLabel(minutes: number): string {
  return (
    CADENCE_OPTIONS.find((option) => option.minutes === minutes)?.label ??
    `Every ${minutes} minutes`
  );
}

function words(values: readonly string[]): string {
  return values.length
    ? values.map((value) => value.replaceAll("_", " ")).join(", ")
    : "None";
}

function cell(value: string): string {
  return value.replaceAll("|", "\\|");
}

/** Builds the human-readable strategy owners download from the Admin Panel. */
export function buildOddsOwnerPlaybook(
  input: OddsOwnerPlaybookInput,
  generatedAt = new Date(),
): string {
  const forecast = oddsStrategyForecast(input);
  const enabledSports = input.sports.filter((sport) => sport.enabled);
  const schedulingStatus = !input.managedSchedulingEnabled
    ? "Preview only"
    : input.paused
      ? "Enabled, optional pulls paused"
      : "Active";

  const sportRows = enabledSports.map((sport) => {
    const standard = sport.surfaceEnabled
      ? cadenceLabel(sport.surfaceCadenceMinutes)
      : "Off";
    const expanded = sport.expandedEnabled
      ? cadenceLabel(sport.expandedCadenceMinutes)
      : "Off";
    return `| ${sport.sport} | ${cell(standard)} | ${cell(expanded)} | ${sport.maxEventsPerRun.toLocaleString("en-US")} | ${cell(words(sport.leagues))} |`;
  });

  const marketSections = enabledSports.flatMap((sport) => [
    `### ${sport.sport}`,
    `- Standard markets: ${sport.surfaceEnabled ? words(sport.surfaceMarkets) : "Off"}`,
    `- Expanded markets: ${sport.expandedEnabled ? words(sport.expandedMarkets) : "Off"}`,
    "",
  ]);

  return [
    "# SCL API Credit Owner Playbook",
    "",
    `Generated: ${generatedAt.toISOString()}`,
    `Scheduling status: ${schedulingStatus}`,
    `Timezone: ${input.timezone}`,
    "",
    "## Monthly plan",
    "",
    `- Conservative modeled usage: ${forecast.totalCreditsPerMonth.toLocaleString("en-US")} credits`,
    "- Provider allocation used for planning: 100,000 credits",
    `- Owner monthly hard limit: ${input.monthlyCreditLimit.toLocaleString("en-US")} credits`,
    `- Protected reserve: ${input.reserveCredits.toLocaleString("en-US")} credits`,
    `- Spendable after reserve: ${forecast.operatingBudget.toLocaleString("en-US")} credits`,
    `- Modeled cushion inside the spendable budget: ${forecast.budgetRemaining.toLocaleString("en-US")} credits`,
    `- Board population: ${forecast.boardCreditsPerMonth.toLocaleString("en-US")} credits/month`,
    `- Verification: ${forecast.verificationCreditsPerMonth.toLocaleString("en-US")} credits/month`,
    "",
    "The forecast assumes every cadence slot runs for 31 days and every expanded run reaches its event cap. Fresh or already-populated boards may reduce actual usage.",
    "",
    "## Sport cadence",
    "",
    "| Sport | Standard refresh | Expanded refresh | Max events/run | Leagues |",
    "| --- | --- | --- | ---: | --- |",
    ...sportRows,
    "",
    "## Markets",
    "",
    ...marketSections,
    "## Credit guardrails",
    "",
    `- Daily hard limit: ${input.dailyCreditLimit.toLocaleString("en-US")}`,
    `- Weekly hard limit: ${input.weeklyCreditLimit.toLocaleString("en-US")}`,
    `- Monthly hard limit: ${input.monthlyCreditLimit.toLocaleString("en-US")}`,
    `- Per-run hard limit: ${input.perRunCreditLimit.toLocaleString("en-US")}`,
    `- Warning threshold: ${input.warningPercent}%`,
    "",
    "## Verification policy",
    "",
    `- Live verification: ${input.verificationEnabled ? "On" : "Off"}`,
    `- Daily verification requests: ${input.verificationDailyRequestLimit.toLocaleString("en-US")}`,
    `- Daily verification credits: ${input.verificationDailyCreditLimit.toLocaleString("en-US")}`,
    `- Maximum credits per verification: ${input.verificationMaxCreditsPerRequest.toLocaleString("en-US")}`,
    `- Reuse window: ${input.verificationCacheMinutes.toLocaleString("en-US")} minutes`,
    "",
    "## Activation checklist",
    "",
    "1. Review this forecast against provider-reported remaining credits.",
    "2. Keep optional pulls paused while saving or changing a strategy.",
    "3. Dry-run the highest-cost expanded sport and confirm its estimate.",
    "4. Enable owner-managed scheduling, remove the pause, and save.",
    "5. Check Activity & change history after the first scheduled cycle.",
    "",
  ].join("\n");
}
