import { z } from "zod";
import { BetType, DailyVolume, ProviderType } from "@prisma/client";

import { SPORT_KEYS } from "@/lib/constants";
import {
  STOREFRONT_DESCRIPTION_MAX_LENGTH,
  STOREFRONT_TITLE_MAX_LENGTH,
} from "@/lib/storefront";
import { safeHttpUrl } from "@/lib/urls";

const socialHandleSchema = z
  .string()
  .max(40)
  .refine(
    (value) => value === "" || /^@?[a-zA-Z0-9._-]+$/.test(value),
    "Use a social handle, not a full URL",
  )
  .optional();

// Empty strings from inputs are allowed; the server action coerces "" -> null.
export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters")
    .max(60, "Keep it under 60 characters"),
  headline: z.string().max(120, "Keep it under 120 characters").optional(),
  bio: z.string().max(600, "Keep it under 600 characters").optional(),
  providerType: z.nativeEnum(ProviderType),
  sports: z.array(z.enum(SPORT_KEYS as [string, ...string[]])).default([]),
  specialties: z
    .array(
      z
        .string()
        .trim()
        .min(2, "Specialties need at least 2 characters")
        .max(40, "Keep specialties under 40 characters"),
    )
    .max(8, "Choose up to 8 specialties")
    .default([]),
  betTypes: z.array(z.nativeEnum(BetType)).default([]),
  dailyVolume: z.union([z.nativeEnum(DailyVolume), z.literal("")]).optional(),
  writtenAnalysis: z.boolean().default(false),
  biggestBetWon: z.string().max(60).optional(),
  storefrontTitle: z
    .string()
    .trim()
    .max(
      STOREFRONT_TITLE_MAX_LENGTH,
      `Keep the storefront title under ${STOREFRONT_TITLE_MAX_LENGTH} characters`,
    )
    .optional(),
  storefrontDescription: z
    .string()
    .trim()
    .max(
      STOREFRONT_DESCRIPTION_MAX_LENGTH,
      `Keep the storefront description under ${STOREFRONT_DESCRIPTION_MAX_LENGTH} characters`,
    )
    .optional(),
  storefrontEnabled: z.boolean().default(true),
  instagram: socialHandleSchema,
  twitter: socialHandleSchema,
  facebook: socialHandleSchema,
  tiktok: socialHandleSchema,
  website: z
    .string()
    .max(200)
    .refine((value) => value === "" || safeHttpUrl(value) !== null, {
      message: "Use a full http:// or https:// URL",
    })
    .optional(),
});

export type ProfileFormInput = z.input<typeof profileSchema>;
export type ProfileInput = z.output<typeof profileSchema>;

// Display metadata for the form's enum selectors.
export const OFFERING_MODELS: { value: ProviderType; label: string }[] = [
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
