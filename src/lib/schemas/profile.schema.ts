import { z } from "zod";
import { BetType, DailyVolume, ProviderType } from "@prisma/client";

import { SPORT_KEYS } from "@/lib/constants";
import { BOOK_KEYS } from "@/lib/books";
import { sclUsernameSchema } from "@/lib/schemas/auth.schema";
import {
  STOREFRONT_DESCRIPTION_MAX_LENGTH,
  STOREFRONT_TITLE_MAX_LENGTH,
} from "@/lib/storefront";

// Empty strings from inputs are allowed; the server action coerces "" -> null.
// Public identity is @username only. External social/website links are not
// collected (existing DB values stay dormant — not cleared, not rendered).
export const profileSchema = z.object({
  username: sclUsernameSchema,
  headline: z.string().max(120, "Keep it under 120 characters").optional(),
  bio: z.string().max(600, "Keep it under 600 characters").optional(),
  providerType: z.nativeEnum(ProviderType),
  sports: z.array(z.enum(SPORT_KEYS as [string, ...string[]])).default([]),
  books: z.array(z.enum(BOOK_KEYS as [string, ...string[]])).default([]),
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
  { value: "LOW", label: "Low (1-5)" },
  { value: "MODERATE", label: "Moderate (6-10)" },
  { value: "HIGH", label: "High (11-15)" },
  { value: "VERY_HIGH", label: "Very High (16+)" },
];

export const BET_TYPES: { value: BetType; label: string }[] = [
  { value: "STRAIGHT", label: "Straight" },
  { value: "PARLAY", label: "Parlay" },
  { value: "PROP", label: "Prop" },
  { value: "TEASER", label: "Teaser" },
  { value: "TOTAL", label: "Total" },
];
