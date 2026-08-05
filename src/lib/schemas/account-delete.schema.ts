import { z } from "zod";

export const deleteOwnAccountSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Enter your username to confirm")
    .transform((value) => value.replace(/^@+/, "").toLowerCase()),
  password: z.string().min(1, "Enter your password"),
});
export type DeleteOwnAccountInput = z.infer<typeof deleteOwnAccountSchema>;

export const adminDeleteCapperSchema = z.object({
  userId: z.string().min(1, "Capper account is required"),
  adminPassword: z.string().min(1, "Enter your admin password"),
});
export type AdminDeleteCapperInput = z.infer<typeof adminDeleteCapperSchema>;
