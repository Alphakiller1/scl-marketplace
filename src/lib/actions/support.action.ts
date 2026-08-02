"use server";

import { z } from "zod";

import { sendSupportEmail } from "@/lib/email";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIdentity } from "@/lib/request-identity";

const supportSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  category: z.enum([
    "Account",
    "Capper profile",
    "Pick or grading",
    "Package or purchase link",
    "Technical issue",
    "Other",
  ]),
  message: z
    .string()
    .trim()
    .min(20, "Please include at least 20 characters so we can help.")
    .max(4000, "Please keep the message under 4,000 characters."),
  pageUrl: z.string().trim().max(500).optional(),
  company: z.string().max(0).optional(),
});

export type SupportFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
};

export async function submitSupportRequest(
  _previous: SupportFormState,
  formData: FormData,
): Promise<SupportFormState> {
  const parsed = supportSchema.safeParse({
    email: formData.get("email"),
    category: formData.get("category"),
    message: formData.get("message"),
    pageUrl: formData.get("pageUrl") || undefined,
    company: formData.get("company") || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  let requestAllowed = false;
  let emailAllowed = false;
  try {
    const requestIdentity = await getRequestIdentity();
    [requestAllowed, emailAllowed] = await Promise.all([
      consumeRateLimit({
        scope: "support-request",
        identity: requestIdentity,
        limit: 5,
        windowMs: 60 * 60 * 1000,
      }),
      consumeRateLimit({
        scope: "support-email",
        identity: parsed.data.email,
        limit: 5,
        windowMs: 60 * 60 * 1000,
      }),
    ]);
  } catch (error) {
    console.error("[support] rate-limit check failed", error);
    return {
      status: "error",
      message:
        "Support requests are temporarily unavailable. Email support@scl.com directly and include the page you were viewing.",
    };
  }
  if (!requestAllowed || !emailAllowed) {
    return {
      status: "error",
      message:
        "Too many support requests were submitted. Email support@scl.com directly if the issue is urgent.",
    };
  }

  const result = await sendSupportEmail(parsed.data);
  if (!result.delivered) {
    return {
      status: "error",
      message:
        "We could not deliver the form right now. Email support@scl.com directly and include the page you were viewing.",
    };
  }

  return {
    status: "success",
    message: "Your request was sent. SCL support will reply by email.",
  };
}
