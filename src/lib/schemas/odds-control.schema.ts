import { z } from "zod";

import {
  allowedExpandedMarkets,
  estimatedRunCredits,
  ODDS_CONTROL_SPORTS,
  SOCCER_CONTROL_LEAGUES,
  SURFACE_MARKETS,
} from "@/lib/odds-control";
import { HARD_MAX_EVENT_BUYS_PER_DAY } from "@/lib/odds-event-buy-budget";

const sportEnum = z.enum(ODDS_CONTROL_SPORTS);
const surfaceKeys = new Set(SURFACE_MARKETS.map((market) => market.key));
const soccerLeagueKeys = new Set(
  SOCCER_CONTROL_LEAGUES.map((league) => league.key),
);

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

export const oddsSportControlSchema = z
  .object({
    sport: sportEnum,
    enabled: z.boolean(),
    surfaceEnabled: z.boolean(),
    expandedEnabled: z.boolean(),
    surfaceMarkets: z.array(z.string()).max(3),
    expandedMarkets: z.array(z.string()).max(100),
    leagues: z.array(z.string().trim().min(1).max(100)).max(60),
    surfaceCadenceMinutes: z.number().int().min(15).max(1440),
    expandedCadenceMinutes: z.number().int().min(15).max(1440),
    maxEventsPerRun: z.number().int().min(1).max(99),
    // Clamped at the schema edge as well as in the UI: the ceiling is the whole
    // point of the setting, so it cannot rely on the form to enforce it.
    dailyVerificationLimit: z
      .number()
      .int()
      .min(1)
      .max(HARD_MAX_EVENT_BUYS_PER_DAY),
  })
  .superRefine((value, context) => {
    const invalidSurface = value.surfaceMarkets.find(
      (market) => !surfaceKeys.has(market as "h2h" | "spreads" | "totals"),
    );
    if (invalidSurface) {
      context.addIssue({
        code: "custom",
        path: ["surfaceMarkets"],
        message: `${invalidSurface} is not a supported surface market.`,
      });
    }
    const expanded = new Set(allowedExpandedMarkets(value.sport));
    const invalidExpanded = value.expandedMarkets.find(
      (market) => !expanded.has(market),
    );
    if (invalidExpanded) {
      context.addIssue({
        code: "custom",
        path: ["expandedMarkets"],
        message: `${invalidExpanded} is not supported for ${value.sport}.`,
      });
    }
    for (const [path, values] of [
      ["surfaceMarkets", value.surfaceMarkets],
      ["expandedMarkets", value.expandedMarkets],
      ["leagues", value.leagues],
    ] as const) {
      if (hasDuplicates(values)) {
        context.addIssue({
          code: "custom",
          path: [path],
          message: `${path} cannot contain duplicate values.`,
        });
      }
    }
    if (
      value.sport === "SOCCER" &&
      value.leagues.some((league) => !soccerLeagueKeys.has(league))
    ) {
      context.addIssue({
        code: "custom",
        path: ["leagues"],
        message: "Select soccer leagues from the supported list.",
      });
    } else if (
      value.sport === "TENNIS" &&
      value.leagues.some((league) => !/^[A-Z0-9_]+$/.test(league))
    ) {
      context.addIssue({
        code: "custom",
        path: ["leagues"],
        message:
          "Tournament keys may contain only letters, numbers, and underscores.",
      });
    } else if (
      !["SOCCER", "TENNIS"].includes(value.sport) &&
      value.leagues.length > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["leagues"],
        message: `${value.sport} does not support owner-selected leagues.`,
      });
    }
    if (value.enabled && value.surfaceEnabled && !value.surfaceMarkets.length) {
      context.addIssue({
        code: "custom",
        path: ["surfaceMarkets"],
        message:
          "Select at least one surface market or disable surface refreshes.",
      });
    }
    if (
      value.enabled &&
      value.expandedEnabled &&
      !value.expandedMarkets.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["expandedMarkets"],
        message: "Select expanded coverage or disable expanded refreshes.",
      });
    }
  });

export const oddsControlSettingsSchema = z
  .object({
    managedSchedulingEnabled: z.boolean(),
    paused: z.boolean(),
    dailyCreditLimit: z.number().int().min(1).max(1_000_000),
    weeklyCreditLimit: z.number().int().min(1).max(1_000_000),
    monthlyCreditLimit: z.number().int().min(1).max(1_000_000),
    perRunCreditLimit: z.number().int().min(1).max(1_000_000),
    warningPercent: z.number().int().min(25).max(95),
    reserveCredits: z.number().int().min(0).max(1_000_000),
    verificationEnabled: z.boolean(),
    verificationDailyRequestLimit: z.number().int().min(1).max(100_000),
    verificationDailyCreditLimit: z.number().int().min(1).max(1_000_000),
    verificationMaxCreditsPerRequest: z.number().int().min(1).max(100),
    verificationCacheMinutes: z.number().int().min(10).max(1440),
    timezone: z.literal("America/New_York"),
    sports: z.array(oddsSportControlSchema).length(ODDS_CONTROL_SPORTS.length),
  })
  .superRefine((value, context) => {
    if (value.weeklyCreditLimit < value.dailyCreditLimit) {
      context.addIssue({
        code: "custom",
        path: ["weeklyCreditLimit"],
        message: "Weekly limit cannot be below the daily limit.",
      });
    }
    if (value.monthlyCreditLimit < value.weeklyCreditLimit) {
      context.addIssue({
        code: "custom",
        path: ["monthlyCreditLimit"],
        message: "Monthly limit cannot be below the weekly limit.",
      });
    }
    if (value.perRunCreditLimit > value.dailyCreditLimit) {
      context.addIssue({
        code: "custom",
        path: ["perRunCreditLimit"],
        message: "Per-run limit cannot exceed the daily limit.",
      });
    }
    if (value.reserveCredits >= value.monthlyCreditLimit) {
      context.addIssue({
        code: "custom",
        path: ["reserveCredits"],
        message: "Reserve must be below the monthly limit.",
      });
    }
    if (value.verificationDailyCreditLimit > value.dailyCreditLimit) {
      context.addIssue({
        code: "custom",
        path: ["verificationDailyCreditLimit"],
        message:
          "Verification's daily credit budget cannot exceed the overall daily limit.",
      });
    }
    if (
      value.verificationMaxCreditsPerRequest >
      value.verificationDailyCreditLimit
    ) {
      context.addIssue({
        code: "custom",
        path: ["verificationMaxCreditsPerRequest"],
        message:
          "The per-verification maximum cannot exceed its daily credit budget.",
      });
    }
    for (const sport of value.sports) {
      for (const tier of ["surface", "expanded"] as const) {
        const enabled =
          sport.enabled &&
          (tier === "surface" ? sport.surfaceEnabled : sport.expandedEnabled);
        if (!enabled) continue;
        const estimate = estimatedRunCredits({
          sport: sport.sport,
          tier,
          markets:
            tier === "surface" ? sport.surfaceMarkets : sport.expandedMarkets,
          leagues: sport.leagues,
          maxEventsPerRun: sport.maxEventsPerRun,
        });
        if (estimate > value.perRunCreditLimit) {
          context.addIssue({
            code: "custom",
            path: ["sports", sport.sport, tier],
            message: `${sport.sport} ${tier} estimate (${estimate}) exceeds the per-run limit (${value.perRunCreditLimit}).`,
          });
        }
      }
    }
    if (
      new Set(value.sports.map((sport) => sport.sport)).size !==
      value.sports.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["sports"],
        message: "Each supported sport must appear exactly once.",
      });
    }
  });

export const oddsRunRequestSchema = z.object({
  sport: sportEnum,
  tier: z.enum(["surface", "expanded"]),
});

export type OddsControlSettingsInput = z.infer<
  typeof oddsControlSettingsSchema
>;
