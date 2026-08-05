"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

const SUCCESS = new Set(["connected"]);

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
  "company-missing":
    "Whop connected but no business was returned. Reinstall the SCL app or contact support.",
  "not-configured":
    "Whop app install is temporarily unavailable. Complete the affiliate steps and submit — SCL will review manually.",
  "start-setup": "Review the Whop setup steps before installing the SCL app.",
  suspended:
    "This Whop storefront is suspended. Contact SCL before continuing.",
  "profile-missing":
    "Your capper profile is missing. Refresh and try again, or contact support.",
  "invalid-callback":
    "Whop returned an incomplete response. Click Install SCL app on Whop to retry.",
  "connection-missing":
    "Your Whop storefront setup was not found. Restart setup from Dashboard → Storefront.",
};

export function WhopOAuthNotice() {
  const params = useSearchParams();
  const code = params.get("whop");

  useEffect(() => {
    if (!code) return;
    const message = MESSAGES[code];
    if (!message) return;
    if (SUCCESS.has(code)) toast.success(message);
    else toast.message(message);
  }, [code]);

  return null;
}
