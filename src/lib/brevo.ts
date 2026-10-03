import "server-only";

import { brevoApiKeys } from "@/lib/brevo-config";
import { normalizeBrevoMessageId } from "@/lib/brevo-message-id";
import { classifyBrevoFailure, type BrevoFailureKind } from "@/lib/brevo-send";

type BrevoSendResult =
  | { accepted: true; messageId: string }
  | { accepted: false; error: string; kind: BrevoFailureKind };

function parseSender(raw: string): { name?: string; email: string } {
  const match = raw.match(/^\s*([^<]+?)\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1]!.trim(), email: match[2]!.trim() };
  return { email: raw.trim() };
}

export function brevoConfigured(): boolean {
  return Boolean(
    brevoApiKeys().length > 0 &&
    (process.env.BREVO_EMAIL_FROM?.trim() || process.env.EMAIL_FROM?.trim()),
  );
}

export function brevoDailyLimit(): number {
  const value = Number(process.env.BREVO_DAILY_LIMIT ?? "300");
  return Number.isInteger(value) && value > 0 ? Math.min(value, 100_000) : 300;
}

/**
 * One campaign email through Brevo's transactional API.
 *
 * Brevo has no request idempotency for this endpoint, so duplicate protection
 * lives entirely in the queue: a recipient row is reserved before this call and
 * is only re-queued when Brevo definitively refused the request.
 */
export async function sendBrevoCampaignEmail(input: {
  to: string;
  name?: string | null;
  subject: string;
  html: string;
  broadcastId: string;
  recipientId: string;
  /** RFC 8058 one-click target; mass campaigns only. */
  unsubscribeUrl?: string;
}): Promise<BrevoSendResult> {
  const apiKeys = brevoApiKeys();
  const from =
    process.env.BREVO_EMAIL_FROM?.trim() || process.env.EMAIL_FROM?.trim();
  if (apiKeys.length === 0 || !from) {
    return {
      accepted: false,
      error: "Brevo is not configured",
      kind: "fatal",
    };
  }

  const headers: Record<string, string> = {
    "X-SCL-Broadcast": input.broadcastId,
    "X-SCL-Recipient": input.recipientId,
  };
  if (input.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${input.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const body = JSON.stringify({
    sender: parseSender(from),
    to: [{ email: input.to, name: input.name ?? undefined }],
    replyTo: process.env.SUPPORT_EMAIL_TO?.trim()
      ? { email: process.env.SUPPORT_EMAIL_TO.trim() }
      : undefined,
    subject: input.subject,
    htmlContent: input.html,
    tags: ["scl-admin-broadcast"],
    headers,
  });

  for (const [index, apiKey] of apiKeys.entries()) {
    let response: Response;
    try {
      response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: {
          accept: "application/json",
          "api-key": apiKey,
          "content-type": "application/json",
        },
        body,
      });
    } catch (error) {
      // The request may have reached Brevo before the connection failed, so the
      // outcome is unknown. Retrying could mail the person twice.
      return {
        accepted: false,
        error: `Outcome unknown: ${error instanceof Error ? error.message : "Brevo request failed"}`,
        kind: "permanent",
      };
    }

    const payload = (await response.json().catch(() => null)) as {
      messageId?: string;
      message?: string;
      code?: string;
    } | null;
    if (response.ok && payload?.messageId) {
      return {
        accepted: true,
        messageId: normalizeBrevoMessageId(payload.messageId),
      };
    }
    // A rejected key cannot have sent the message, so trying the rotated key is
    // safe. No other response is safe to repeat.
    if (
      (response.status === 401 || response.status === 403) &&
      index < apiKeys.length - 1
    ) {
      continue;
    }
    return {
      accepted: false,
      error:
        payload?.message ??
        payload?.code ??
        `Brevo returned ${response.status}`,
      kind: classifyBrevoFailure(response.status),
    };
  }

  return { accepted: false, error: "Brevo rejected every key", kind: "fatal" };
}
