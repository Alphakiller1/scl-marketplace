import "server-only";

import { normalizeBrevoMessageId } from "@/lib/brevo-message-id";

type BrevoSendResult =
  { accepted: true; messageId: string } | { accepted: false; error: string };

function parseSender(raw: string): { name?: string; email: string } {
  const match = raw.match(/^\s*([^<]+?)\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1]!.trim(), email: match[2]!.trim() };
  return { email: raw.trim() };
}

export function brevoConfigured(): boolean {
  return Boolean(
    process.env.BREVO_API_KEY?.trim() &&
    (process.env.BREVO_EMAIL_FROM?.trim() || process.env.EMAIL_FROM?.trim()),
  );
}

export function brevoDailyLimit(): number {
  const value = Number(process.env.BREVO_DAILY_LIMIT ?? "300");
  return Number.isInteger(value) && value > 0 ? Math.min(value, 100_000) : 300;
}

export async function sendBrevoCampaignEmail(input: {
  to: string;
  name?: string | null;
  subject: string;
  html: string;
  broadcastId: string;
  recipientId: string;
}): Promise<BrevoSendResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const from =
    process.env.BREVO_EMAIL_FROM?.trim() || process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return { accepted: false, error: "Brevo is not configured" };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: parseSender(from),
        to: [{ email: input.to, name: input.name ?? undefined }],
        replyTo: process.env.SUPPORT_EMAIL_TO?.trim()
          ? { email: process.env.SUPPORT_EMAIL_TO.trim() }
          : undefined,
        subject: input.subject,
        htmlContent: input.html,
        tags: ["scl-admin-broadcast"],
        headers: {
          "Idempotency-Key": input.recipientId,
          "X-SCL-Broadcast": input.broadcastId,
          "X-SCL-Recipient": input.recipientId,
        },
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      messageId?: string;
      message?: string;
      code?: string;
    } | null;
    if (!response.ok || !payload?.messageId) {
      return {
        accepted: false,
        error:
          payload?.message ??
          payload?.code ??
          `Brevo returned ${response.status}`,
      };
    }
    return {
      accepted: true,
      messageId: normalizeBrevoMessageId(payload.messageId),
    };
  } catch (error) {
    return {
      accepted: false,
      error: error instanceof Error ? error.message : "Brevo request failed",
    };
  }
}
