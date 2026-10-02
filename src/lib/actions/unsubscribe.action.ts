"use server";

import { redirect } from "next/navigation";

import { unsubscribeWithToken } from "@/lib/unsubscribe";

/**
 * The confirm button on /unsubscribe. Opting out on a bare page load let mail
 * scanners that pre-fetch every link unsubscribe people who never clicked; a
 * POST is something only a person (or an RFC 8058 one-click client) sends.
 * Public by design — the HMAC-signed token is the authorisation.
 */
export async function confirmUnsubscribeAction(formData: FormData) {
  const token = formData.get("token");
  const ok = await unsubscribeWithToken(
    typeof token === "string" ? token : null,
  );
  const params = new URLSearchParams({
    token: typeof token === "string" ? token : "",
    result: ok ? "done" : "failed",
  });
  redirect(`/unsubscribe?${params.toString()}`);
}
