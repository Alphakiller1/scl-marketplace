"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

const SUCCESS = new Set(["connected"]);

const MESSAGES: Record<string, string> = {
  connected:
    "SCL is connected on Whop. Finish the affiliate steps below and submit when ready.",
  "oauth-denied":
    "Whop connection was cancelled. You can retry Connect SCL to Whop after adding SCL as an affiliate.",
  "exchange-failed":
    "Could not complete the Whop connection. Try again or contact support.",
  "session-expired":
    "Whop connection session expired. Click Connect SCL to Whop to retry.",
  "state-mismatch": "Whop connection could not be verified. Please try again.",
  "company-missing":
    "Whop connected but no business was returned. Reconnect SCL on Whop or contact support.",
  "not-configured":
    "Whop connection is temporarily unavailable. Complete the affiliate steps and submit — SCL will review manually.",
  "oauth-misconfigured":
    "Whop isn't accepting SCL's callback URL yet. Try Connect SCL to Whop again in a minute, or contact support if it keeps happening.",
  "app-permissions-missing":
    "SCL's Whop app is being upgraded for package price sync. No change is needed in your capper account; retry after SCL support confirms the upgrade.",
  "permissions-required":
    "Whop connected, but package price sync permission was not granted. Re-approve SCL Marketplace under Whop → Authorized apps, then reconnect.",
  "permission-check-failed":
    "Whop connected, but SCL could not verify package price sync. Your storefront was marked for review instead of being reported as fully synced.",
  "start-setup": "Review the Whop setup steps before connecting SCL on Whop.",
  suspended:
    "This Whop storefront is suspended. Contact SCL before continuing.",
  "profile-missing":
    "Your capper profile is missing. Refresh and try again, or contact support.",
  "invalid-callback":
    "Whop returned an incomplete response. Click Connect SCL to Whop to retry.",
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
