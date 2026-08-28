import { Resend } from "resend";
import type { StoreProvider } from "@prisma/client";

import { hasDeliverableEmail } from "@/lib/account-claim";
import { escapeHtml } from "@/lib/email-escape";
import { renderEmailTemplate } from "@/lib/email-template-render";
import type { EmailTemplateSlug } from "@/lib/email-templates";
import { PASSWORD_POLICY_SUMMARY } from "@/lib/password-policy";
import { providerLabel, SCL_AFFILIATE_EMAIL } from "@/lib/store-connection";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "no-reply@scl.local";
const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Where a reply lands.
 *
 * Every capper-facing message below is sent from an unmonitored `no-reply@`, so
 * without this the natural response to "I never got my link" — hitting reply —
 * goes nowhere and looks to the capper like SCL ignored them. Undefined when no
 * support mailbox is set, which leaves the header off rather than pointing it at
 * a placeholder.
 */
function supportReplyTo(): string | undefined {
  return process.env.SUPPORT_EMAIL_TO?.trim() || undefined;
}

function appUrl() {
  const base =
    process.env.AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000";
  // Trim stray whitespace/newlines — a trailing newline in AUTH_URL was splitting the
  // verification/reset links in emails — and drop trailing slashes so `${appUrl()}/path`
  // is always well-formed.
  return base.trim().replace(/\/+$/, "");
}

/**
 * Send one of the owner-editable capper emails.
 *
 * Every capper-facing sender funnels through here so there is exactly one place
 * that loads the copy, renders it, and reports delivery. The link is passed in
 * rather than written by the template, which is what makes the copy safe to
 * edit: no wording change can misdirect a verification button.
 */
async function sendTemplatedEmail(input: {
  slug: EmailTemplateSlug;
  to: string;
  actionUrl: string;
  variables?: Record<string, string | null | undefined>;
  footerHtml?: string;
  footerText?: string;
  /** Prefixes the dev log line when no mailer is configured. */
  devLabel: string;
}): Promise<{ delivered: boolean; link: string }> {
  // Deferred so importing this module does not pull in `server-only`.
  const { getEmailTemplate } = await import("@/lib/queries/email-templates");
  const template = await getEmailTemplate(input.slug);
  const { html, text } = renderEmailTemplate({
    body: template.body,
    actionLabel: template.actionLabel,
    actionUrl: input.actionUrl,
    footnote: template.footnote,
    variables: input.variables,
    footerHtml: input.footerHtml,
    footerText: input.footerText,
  });

  if (!resend) {
    console.info(
      `[email:dev] ${input.devLabel} for ${input.to}: ${input.actionUrl}`,
    );
    return { delivered: false, link: input.actionUrl };
  }

  // Never throw: a provider failure (an unverified sender domain, say) must not
  // break the signup, reset, or verification it is attached to.
  try {
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      replyTo: supportReplyTo(),
      subject: template.subject,
      html,
      text,
    });
    if (error) {
      console.error(
        `[email] ${input.devLabel} failed for ${input.to}: ${error.message}`,
      );
      return { delivered: false, link: input.actionUrl };
    }
    return { delivered: true, link: input.actionUrl };
  } catch (err) {
    console.error(`[email] ${input.devLabel} threw for ${input.to}:`, err);
    return { delivered: false, link: input.actionUrl };
  }
}

/** `{{account}}` reads as a line, not a bare handle, and vanishes when unknown. */
function accountVariable(username?: string | null) {
  return { "{{account}}": username ? `Account: @${username}` : "" };
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  username?: string,
) {
  const result = await sendTemplatedEmail({
    slug: "VERIFICATION",
    to: email,
    actionUrl: `${appUrl()}/verify?token=${token}`,
    variables: accountVariable(username),
    devLabel: "verification link",
  });
  return result.delivered
    ? { delivered: true as const, link: result.link }
    : { delivered: false as const, link: result.link };
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  username?: string,
) {
  const result = await sendTemplatedEmail({
    slug: "PASSWORD_RESET",
    to: email,
    actionUrl: `${appUrl()}/reset-password?token=${token}`,
    variables: accountVariable(username),
    devLabel: "password reset link",
  });
  return result.delivered
    ? { delivered: true as const, link: result.link }
    : { delivered: false as const, link: result.link };
}

/**
 * First-time credentials for an account carried over from the previous platform.
 * Same single-use token as a password reset — the copy differs because the capper
 * never had an SCL password to "reset", and "we couldn't find your account" is the
 * exact confusion that keeps an imported capper locked out.
 */
export async function sendAccountClaimEmail(email: string, token: string) {
  const result = await sendTemplatedEmail({
    slug: "ACCOUNT_CLAIM",
    to: email,
    actionUrl: `${appUrl()}/reset-password?token=${token}`,
    devLabel: "account claim link",
  });
  return result.delivered
    ? { delivered: true as const, link: result.link }
    : { delivered: false as const, link: result.link };
}

/**
 * One-time notice that a password carried over from the previous platform no
 * longer meets SCL's requirements. It is a prompt, not a lockout — the password
 * keeps working until they change it, so the copy must not read as an outage.
 */
export async function sendPasswordUpdateRequiredEmail(email: string) {
  const result = await sendTemplatedEmail({
    slug: "PASSWORD_UPDATE_REQUIRED",
    to: email,
    actionUrl: `${appUrl()}/dashboard/security`,
    variables: { "{{password_policy}}": PASSWORD_POLICY_SUMMARY },
    devLabel: "password update notice",
  });
  return result.delivered
    ? { delivered: true as const, link: result.link }
    : { delivered: false as const, link: result.link };
}

/**
 * Welcome a new capper. Best-effort — never throws, so a delivery failure can
 * never undo an account that has already been created.
 */
export async function sendWelcomeEmail(input: {
  email: string;
  unsubscribeUrl?: string;
}) {
  // Matches the announcement footer: this is onboarding, but it is also the
  // pitch, so it honours the same opt-out rather than claiming to be purely
  // operational mail.
  const footerHtml = input.unsubscribeUrl
    ? `<hr style="border:none;border-top:1px solid #eee;margin:28px 0" />
       <p style="color:#666;font-size:12px">
         You are receiving this because you have an SCL capper account.
         <a href="${escapeHtml(input.unsubscribeUrl)}">Unsubscribe from announcements</a> —
         account and security emails will still reach you.
       </p>`
    : undefined;

  const result = await sendTemplatedEmail({
    slug: "WELCOME",
    to: input.email,
    actionUrl: `${appUrl()}/login`,
    footerHtml,
    footerText: input.unsubscribeUrl
      ? `Unsubscribe from announcements: ${input.unsubscribeUrl}`
      : undefined,
    devLabel: "welcome email",
  });
  return { delivered: result.delivered as boolean };
}

/**
 * Send a draft to the admin editing it, so the wording can be read in a real
 * inbox before it goes to anybody else. Marked in the subject so it is never
 * mistaken for the real thing, and pointed at the site root because a preview
 * has no token to offer.
 */
export async function sendTemplatePreviewEmail(input: {
  to: string;
  slug: EmailTemplateSlug;
  template: {
    subject: string;
    body: string;
    actionLabel: string;
    footnote: string;
  };
}) {
  const { html, text } = renderEmailTemplate({
    body: input.template.body,
    actionLabel: input.template.actionLabel,
    actionUrl: appUrl(),
    footnote: input.template.footnote,
    // Preview values stand in for what a real send would substitute, so the
    // admin sees the shape of the line rather than a raw token.
    variables: {
      "{{account}}": "Account: @your-handle",
      "{{password_policy}}": PASSWORD_POLICY_SUMMARY,
    },
  });

  if (!resend) {
    console.info(`[email:dev] template preview ${input.slug} for ${input.to}`);
    return { delivered: false as const };
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      replyTo: supportReplyTo(),
      subject: `[Preview] ${input.template.subject}`,
      html,
      text,
    });
    if (error) {
      console.error(`[email] template preview failed: ${error.message}`);
      return { delivered: false as const };
    }
    return { delivered: true as const };
  } catch (err) {
    console.error("[email] template preview threw:", err);
    return { delivered: false as const };
  }
}

/**
 * Alert SCL owners that somebody signed up.
 *
 * Signup previously mailed only the new capper, so the roster grew with nobody
 * on the SCL side told. Best-effort — never throws, and never blocks the
 * account from being created.
 */
export async function sendNewSignupNotificationEmail(input: {
  username: string;
  email: string;
  signedUpAt: Date;
}) {
  const recipients = adminNotificationRecipients();
  const handle = input.username.replace(/^@/, "");
  const adminUrl = `${appUrl()}/admin/cappers`;
  const profileUrl = `${appUrl()}/cappers/${encodeURIComponent(handle)}`;

  if (!resend) {
    console.info("[email:dev] new signup notification", {
      to: recipients,
      ...input,
    });
    return { delivered: false as const };
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: recipients,
      subject: `[SCL] New capper signup — @${handle}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:640px;margin:auto">
          <h2>New capper signed up</h2>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="padding:6px 12px 6px 0;color:#666">Handle</td><td><strong>@${escapeHtml(handle)}</strong></td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#666">Email</td><td>${escapeHtml(input.email)}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#666">Signed up</td><td>${escapeHtml(input.signedUpAt.toISOString())}</td></tr>
          </table>
          <p>
            <a href="${adminUrl}" style="display:inline-block;background:#5b4bdb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">
              Open admin roster
            </a>
          </p>
          <p style="color:#666;font-size:13px">
            Profile: <a href="${profileUrl}">${profileUrl}</a>
          </p>
        </div>
      `,
    });
    if (error) {
      console.error(
        `[email] signup notification failed for @${handle}: ${error.message}`,
      );
      return { delivered: false as const };
    }
    return { delivered: true as const };
  } catch (error) {
    console.error(`[email] signup notification threw for @${handle}:`, error);
    return { delivered: false as const };
  }
}

/** Comma-separated in ADMIN_NOTIFICATION_EMAIL_TO; falls back to SCL affiliate ops. */
export function adminNotificationRecipients(): string[] {
  const raw =
    process.env.ADMIN_NOTIFICATION_EMAIL_TO?.trim() ||
    process.env.SUPPORT_EMAIL_TO?.trim() ||
    SCL_AFFILIATE_EMAIL;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Alert SCL admins when a capper submits Whop or Winible affiliate setup.
 * Best-effort — never throws; a delivery failure must not block storefront submit.
 */
export async function sendAffiliateSignupNotificationEmail(input: {
  capperUsername: string;
  capperEmail: string;
  provider: StoreProvider;
  connectionId: string;
  submittedAt: Date;
}) {
  const recipients = adminNotificationRecipients();
  const platform = providerLabel(input.provider);
  const handle = input.capperUsername.replace(/^@/, "");
  const reviewUrl = `${appUrl()}/admin/store-setup?id=${encodeURIComponent(input.connectionId)}&requiresAttention=true`;
  const capperThreadUrl = `${appUrl()}/dashboard/monetization?thread=${encodeURIComponent(input.connectionId)}`;
  const submittedAt = input.submittedAt.toISOString();

  if (!resend) {
    console.info("[email:dev] affiliate signup notification", {
      to: recipients,
      ...input,
      reviewUrl,
    });
    return { delivered: false as const };
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: recipients,
      subject: `[SCL] ${platform} affiliate signup — @${handle}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:640px;margin:auto">
          <h2>${escapeHtml(platform)} affiliate signup submitted</h2>
          <p>A capper finished the ${escapeHtml(platform)} affiliate setup steps and submitted for SCL review.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="padding:6px 12px 6px 0;color:#666">Capper</td><td><strong>@${escapeHtml(handle)}</strong></td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#666">Email</td><td>${escapeHtml(input.capperEmail)}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#666">Platform</td><td>${escapeHtml(platform)}</td></tr>
            <tr><td style="padding:6px 12px 6px 0;color:#666">Submitted</td><td>${escapeHtml(submittedAt)}</td></tr>
          </table>
          <p>
            <a href="${reviewUrl}" style="display:inline-block;background:#5b4bdb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">
              Review in admin
            </a>
          </p>
          <p style="color:#666;font-size:13px">
            ${
              input.provider === "WINIBLE"
                ? "Accept the affiliate invite in Winible, then confirm in SCL."
                : "Verify the Whop affiliate relationship, sync or paste packages, then confirm in SCL."
            }
          </p>
          <p style="color:#666;font-size:13px">
            The capper can reply on their Storefront page: <a href="${capperThreadUrl}">${capperThreadUrl}</a>
          </p>
        </div>
      `,
    });
    if (error) {
      console.error(
        `[email] affiliate signup notification failed for @${handle}: ${error.message}`,
      );
      return { delivered: false as const };
    }
    return { delivered: true as const };
  } catch (error) {
    console.error(
      `[email] affiliate signup notification threw for @${handle}:`,
      error,
    );
    return { delivered: false as const };
  }
}

/**
 * Email backup when a new in-app storefront message is sent — links back to the
 * thread so admin ↔ capper communication stays seamless in the product.
 */
export async function sendStorefrontMessageNotificationEmail(input: {
  to: string | string[];
  recipientRole: "ADMIN" | "CAPPER";
  platform: string;
  capperUsername: string | null;
  preview: string;
  threadUrl: string;
  senderLabel: string;
}) {
  const preview =
    input.preview.length > 280
      ? `${input.preview.slice(0, 277)}…`
      : input.preview;
  const handle = input.capperUsername?.replace(/^@/, "") ?? "capper";
  const subject =
    input.recipientRole === "ADMIN"
      ? `[SCL] New storefront message from @${handle}`
      : `[SCL] ${input.platform} storefront update from SCL`;

  if (!resend) {
    console.info("[email:dev] storefront message notification", {
      to: input.to,
      subject,
      threadUrl: input.threadUrl,
      preview,
    });
    return { delivered: false as const };
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:640px;margin:auto">
          <h2>New message on your ${escapeHtml(input.platform)} storefront</h2>
          <p><strong>${escapeHtml(input.senderLabel)}</strong> wrote:</p>
          <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #5b4bdb;background:#f6f5ff;white-space:pre-wrap">${escapeHtml(preview)}</blockquote>
          <p>
            <a href="${input.threadUrl}" style="display:inline-block;background:#5b4bdb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">
              Open conversation
            </a>
          </p>
          <p style="color:#666;font-size:13px">
            Reply in SCL to keep the full thread in one place — you can also reply to this email when your mail client supports it.
          </p>
        </div>
      `,
    });
    if (error) {
      console.error(
        `[email] storefront message notification failed: ${error.message}`,
      );
      return { delivered: false as const };
    }
    return { delivered: true as const };
  } catch (error) {
    console.error("[email] storefront message notification threw:", error);
    return { delivered: false as const };
  }
}

export async function sendSupportEmail(input: {
  email: string;
  category: string;
  message: string;
  pageUrl?: string;
}) {
  const supportTo = process.env.SUPPORT_EMAIL_TO ?? "support@scl.com";

  if (!resend) {
    console.info("[email:dev] support request", { ...input, to: supportTo });
    return { delivered: false as const };
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: supportTo,
      replyTo: input.email,
      subject: `[SCL Support] ${input.category}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:640px;margin:auto">
          <h2>New SCL support request</h2>
          <p><strong>From:</strong> ${escapeHtml(input.email)}</p>
          <p><strong>Category:</strong> ${escapeHtml(input.category)}</p>
          <p><strong>Page:</strong> ${escapeHtml(input.pageUrl || "Not supplied")}</p>
          <hr />
          <p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>
        </div>
      `,
    });
    if (error) {
      console.error(`[email] support send failed: ${error.message}`);
      return { delivered: false as const };
    }
    return { delivered: true as const };
  } catch (error) {
    console.error("[email] support send threw:", error);
    return { delivered: false as const };
  }
}

/**
 * Send one admin broadcast batch.
 *
 * Uses Resend's batch endpoint, which takes up to 100 messages and sends each
 * as its OWN email. That is the point: a roster mail must never put the customer
 * list in a shared To or CC, and a hand-rolled loop is one keystroke away from
 * doing exactly that. Every entry here carries a single `to`.
 *
 * Returns per-address outcomes rather than throwing, so a partial failure is
 * recorded against the right capper instead of losing the whole send.
 */
export async function sendBroadcastBatch(
  messages: readonly {
    to: string;
    subject: string;
    html: string;
  }[],
): Promise<{ address: string; delivered: boolean; error?: string }[]> {
  if (messages.length === 0) return [];

  // Resend validates a batch as a unit: one reserved/example recipient makes
  // the provider reject all 100 messages. Separate those rows before the API
  // call so bad fixture data cannot block delivery to real cappers.
  const sendable = messages.filter((message) =>
    hasDeliverableEmail(message.to),
  );
  const blockedAddresses = new Set(
    messages
      .filter((message) => !hasDeliverableEmail(message.to))
      .map((message) => message.to),
  );
  const blockedResult = (address: string) => ({
    address,
    delivered: false,
    error: "reserved or placeholder email address",
  });

  if (sendable.length === 0) {
    return messages.map((message) => blockedResult(message.to));
  }

  if (!resend) {
    console.info(`[email:dev] broadcast batch of ${sendable.length}`, {
      to: sendable.map((m) => m.to),
      subject: sendable[0]?.subject,
    });
    return messages.map((m) => ({
      address: m.to,
      delivered: false,
      error: blockedAddresses.has(m.to)
        ? "reserved or placeholder email address"
        : "mailer not configured",
    }));
  }

  try {
    const { error } = await resend.batch.send(
      sendable.map((m) => ({
        from,
        to: [m.to],
        subject: m.subject,
        html: m.html,
        // Broadcasts come from an unmonitored no-reply@; a reply about one
        // should reach a human rather than disappear.
        replyTo: process.env.SUPPORT_EMAIL_TO?.trim() || undefined,
      })),
    );
    if (error) {
      console.error(`[email] broadcast batch failed: ${error.message}`);
      return messages.map((m) => ({
        address: m.to,
        delivered: false,
        error: blockedAddresses.has(m.to)
          ? "reserved or placeholder email address"
          : error.message,
      }));
    }
    return messages.map((m) =>
      blockedAddresses.has(m.to)
        ? blockedResult(m.to)
        : { address: m.to, delivered: true },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "send threw";
    console.error("[email] broadcast batch threw:", err);
    return messages.map((m) => ({
      address: m.to,
      delivered: false,
      error: blockedAddresses.has(m.to)
        ? "reserved or placeholder email address"
        : message,
    }));
  }
}

/** Body + optional unsubscribe footer, as HTML. Plain text in, escaped out. */
export function renderBroadcastHtml(input: {
  body: string;
  unsubscribeUrl?: string;
}): string {
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((block) => escapeHtml(block.trim()).replace(/\n/g, "<br />"))
    .filter(Boolean)
    .map((block) => `<p style="line-height:1.6">${block}</p>`)
    .join("");

  // Only roster mail carries this. A direct admin-to-capper message is
  // operational, and offering to unsubscribe from it would be misleading.
  const footer = input.unsubscribeUrl
    ? `<hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
       <p style="color:#666;font-size:12px">
         You are receiving this because you have an SCL capper account.
         <a href="${input.unsubscribeUrl}">Unsubscribe from announcements</a> —
         account and security emails will still reach you.
       </p>`
    : "";

  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto">
      ${paragraphs}
      ${footer}
    </div>
  `;
}
