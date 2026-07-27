import { AccountStatus } from "@prisma/client";
import { z } from "zod";

export const accountStatusUpdateSchema = z
  .object({
    userId: z.string().min(1, "Account is required"),
    status: z.nativeEnum(AccountStatus),
    expectedStatus: z.nativeEnum(AccountStatus).optional(),
    reason: z
      .string()
      .trim()
      .max(200, "Keep the reason under 200 characters")
      .optional(),
  })
  .superRefine((input, context) => {
    if (
      (input.status === "SUSPENDED" || input.status === "DISABLED") &&
      (!input.reason || input.reason.length < 5)
    ) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Add a reason of at least 5 characters",
      });
    }
  });

export type AccountStatusUpdateInput = z.infer<
  typeof accountStatusUpdateSchema
>;
