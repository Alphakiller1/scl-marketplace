import { z } from "zod";
import { BetType, DailyVolume, ProviderType } from "@prisma/client";

import { SPORT_KEYS } from "@/lib/constants";

// Empty strings from inputs are allowed; the server action coerces "" -> null.
export const profileSchema = z.object({
  headline: z.string().max(120, "Keep it under 120 characters").optional(),
  bio: z.string().max(600, "Keep it under 600 characters").optional(),
  providerType: z.nativeEnum(ProviderType),
  sports: z.array(z.enum(SPORT_KEYS as [string, ...string[]])).default([]),
  betTypes: z.array(z.nativeEnum(BetType)).default([]),
  dailyVolume: z.union([z.nativeEnum(DailyVolume), z.literal("")]).optional(),
  writtenAnalysis: z.boolean().default(false),
  biggestBetWon: z.string().max(60).optional(),
  instagram: z.string().max(40).optional(),
  twitter: z.string().max(40).optional(),
  facebook: z.string().max(40).optional(),
  tiktok: z.string().max(40).optional(),
  website: z.string().max(200).optional(),
});

export type ProfileFormInput = z.input<typeof profileSchema>;
export type ProfileInput = z.output<typeof profileSchema>;

// Display metadata for the form's enum selectors.
export const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: "FREE", label: "Free" },
  { value: "PREMIUM", label: "Premium" },
  { value: "HYBRID", label: "Hybrid" },
];

export const DAILY_VOLUMES: { value: DailyVolume; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MODERATE", label: "Moderate" },
  { value: "HIGH", label: "High" },
  { value: "VERY_HIGH", label: "Very high" },
];

export const BET_TYPES: { value: BetType; label: string }[] = [
  { value: "STRAIGHT", label: "Straight" },
  { value: "PARLAY", label: "Parlay" },
  { value: "PROP", label: "Prop" },
  { value: "TEASER", label: "Teaser" },
  { value: "TOTAL", label: "Total" },
];
