"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

const MESSAGES: Record<string, string> = {
  connected:
    "SCL app connected on Whop. Finish the affiliate steps below and submit when ready.",
  "oauth-denied":
    "Whop app install was cancelled. You can retry after adding SCL as an affiliate.",
  "exchange-failed":
    "Could not complete the Whop app connection. Try again or contact support.",
  "session-expired":
    "Whop connection session expired. Click Install SCL app on Whop to retry.",
  "state-mismatch": "Whop connection could not be verified. Please try again.",
  "not-configured":
    "Whop app install is not configured yet. Complete the affiliate steps and submit — SCL will review manually.",
  "start-setup": "Review the Whop setup steps before installing the SCL app.",
  suspended:
    "This Whop storefront is suspended. Contact SCL before continuing.",
};

export function WhopOAuthNotice() {
  const params = useSearchParams();
  const code = params.get("whop");

  useEffect(() => {
    if (!code) return;
    const message = MESSAGES[code];
    if (message) toast.message(message);
  }, [code]);

  return null;
}
