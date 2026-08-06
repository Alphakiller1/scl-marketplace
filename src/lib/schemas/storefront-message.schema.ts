import { z } from "zod";

export const sendStorefrontMessageSchema = z.object({
  storeConnectionId: z.string().min(1),
  body: z
    .string()
    .trim()
    .min(1, "Write a message before sending.")
    .max(4000, "Keep the message under 4,000 characters."),
});

export type SendStorefrontMessageInput = z.infer<
  typeof sendStorefrontMessageSchema
>;

export const markStorefrontThreadReadSchema = z.object({
  storeConnectionId: z.string().min(1),
});
