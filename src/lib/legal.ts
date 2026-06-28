import { z } from "zod";

export const CURRENT_POLICY_VERSION = "2026-06-26";

export const legalAcceptanceSchema = z.object({
  acceptTerms: z.literal(true, {
    error: "Accept the Terms and Privacy Policy to continue.",
  }),
});
