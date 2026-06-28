import { AccountStatus } from "@prisma/client";
import { z } from "zod";

export const accountStatusUpdateSchema = z.object({
  userId: z.string().min(1, "Account is required"),
  status: z.nativeEnum(AccountStatus),
  reason: z
    .string()
    .trim()
    .max(200, "Keep the reason under 200 characters")
    .optional(),
});

export type AccountStatusUpdateInput = z.infer<
  typeof accountStatusUpdateSchema
>;
