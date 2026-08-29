import { z } from "zod";

import {
  allowedExpandedMarkets,
  ODDS_CONTROL_SPORTS,
  SURFACE_MARKETS,
} from "@/lib/odds-control";

const sportEnum = z.enum(ODDS_CONTROL_SPORTS);
const surfaceKeys = new Set(SURFACE_MARKETS.map((market) => market.key));

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
    warningPercent: z.number().int().min(25).max(95),
    reserveCredits: z.number().int().min(0).max(1_000_000),
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
    if (value.reserveCredits >= value.monthlyCreditLimit) {
      context.addIssue({
        code: "custom",
        path: ["reserveCredits"],
        message: "Reserve must be below the monthly limit.",
      });
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

export type OddsControlSettingsInput = z.infer<
  typeof oddsControlSettingsSchema
>;
