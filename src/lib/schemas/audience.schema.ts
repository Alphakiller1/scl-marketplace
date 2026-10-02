import { z } from "zod";

const dayWindowSchema = z.union([
  z.literal(3),
  z.literal(7),
  z.literal(14),
  z.literal(30),
]);

export const audienceFiltersSchema = z.object({
  joinedWithinDays: z
    .union([z.literal(7), z.literal(14), z.literal(30)])
    .nullable()
    .default(null),
  accountActivity: z.enum(["ANY", "ACTIVE", "INACTIVE"]).default("ANY"),
  noPlaysWithinDays: dayWindowSchema.nullable().default(null),
  verification: z.enum(["ANY", "VERIFIED", "UNVERIFIED"]).default("ANY"),
  playHistory: z.enum(["ANY", "HAS_PLAYS", "NEVER_SUBMITTED"]).default("ANY"),
  storefront: z
    .enum(["ANY", "CONNECTED", "NOT_CONNECTED", "AWAITING_REVIEW"])
    .default("ANY"),
  excludeUserIds: z.array(z.string().min(1)).max(2_000).default([]),
});

export type AudienceFilters = z.infer<typeof audienceFiltersSchema>;

export const saveAudienceGroupSchema = z.object({
  name: z.string().trim().min(2, "Give the group a name.").max(80),
  description: z.string().trim().max(240).optional(),
  filters: audienceFiltersSchema,
});

export function emptyAudienceFilters(): AudienceFilters {
  return audienceFiltersSchema.parse({});
}
