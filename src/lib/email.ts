import { Resend } from "resend";
import type { StoreProvider } from "@prisma/client";

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
 * Send a verification email. If RESEND_API_KEY isn't set (dev), log the link
 * instead of sending so the flow is testable without an email provider.
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  username?: string,
) {
  const link = `${appUrl()}/verify?token=${token}`;
  const handleLine = username
    ? `<p style="color:#666;font-size:14px">Account: <strong>@${escapeHtml(username)}</strong></p>`
    : "";

  if (!resend) {
    console.info(
      `[email:dev] verification link for ${email}${username ? ` (@${username})` : ""}: ${link}`,
    );
    return { delivered: false as const, link };
  }

  // Never throw: a delivery failure (e.g. an unverified sender domain) must not break signup.
  // We report delivered:false and hand the link back so the caller can fall back gracefully.
  try {
    const { error } = await resend.emails.send({
      from,
      to: email,
      replyTo: supportReplyTo(),
      subject: "Verify your SCL account",
      html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
        <h2>Verify your email</h2>
        ${handleLine}
        <p>Confirm your email to start logging plays and building your record on SCL.</p>
        <p><a href="${link}" style="display:inline-block;background:#5b4bdb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Verify email</a></p>
        <p style="color:#666;font-size:13px">This link expires in 24 hours. If you didn't sign up, ignore this email.</p>
      </div>
    `,
    });
    if (error) {
      console.error(
        `[email] verification send failed for ${email}: ${error.message}`,
      );
      return { delivered: false as const, link };
    }
    return { delivered: true as const, link };
  } catch (err) {
    console.error(`[email] verification send threw for ${email}:`, err);
    return { delivered: false as const, link };
  }
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  username?: string,
) {
  const link = `${appUrl()}/reset-password?token=${token}`;
  const handleLine = username
    ? `<p style="color:#666;font-size:14px">Account: <strong>@${escapeHtml(username)}</strong></p>`
    : "";

  if (!resend) {
    console.info(
      `[email:dev] password reset link for ${email}${username ? ` (@${username})` : ""}: ${link}`,
    );
    return { delivered: false as const, link };
  }

  // Never throw on a provider error (e.g. unverified sender) — return delivery status + link.
  try {
    const { error } = await resend.emails.send({
      from,
      to: email,
      replyTo: supportReplyTo(),
      subject: "Reset your SCL password",
      html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
        <h2>Reset your password</h2>
        ${handleLine}
        <p>Use the secure link below to choose a new password for your SCL account.</p>
        <p><a href="${link}" style="display:inline-block;background:#5b4bdb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset password</a></p>
        <p style="color:#666;font-size:13px">This link expires in one hour and works once. If you didn't request it, ignore this email.</p>
      </div>
    `,
    });
    if (error) {
      console.error(`[email] reset send failed for ${email}: ${error.message}`);
      return { delivered: false as const, link };
    }
    return { delivered: true as const, link };
  } catch (err) {
    console.error(`[email] reset send threw for ${email}:`, err);
    return { delivered: false as const, link };
  }
}

/**
 * First-time credentials for an account carried over from the previous platform.
 * Same single-use token as a password reset — the copy differs because the capper
 * never had an SCL password to "reset", and "we couldn't find your account" is the
 * exact confusion that keeps an imported capper locked out.
 */
export async function sendAccountClaimEmail(email: string, token: string) {
  const link = `${appUrl()}/reset-password?token=${token}`;

  if (!resend) {
    console.info(`[email:dev] account claim link for ${email}: ${link}`);
    return { delivered: false as const, link };
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: email,
      replyTo: supportReplyTo(),
      subject: "Set your SCL password",
      html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
        <h2>Claim your SCL account</h2>
        <p>Your capper profile and record were carried over to SCL. Set a password with the secure link below to sign in, review the current policies, and keep posting.</p>
        <p><a href="${link}" style="display:inline-block;background:#5b4bdb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Set password</a></p>
        <p style="color:#666;font-size:13px">This link expires in one hour and works once. If you didn't expect it, ignore this email.</p>
      </div>
    `,
    });
    if (error) {
      console.error(`[email] claim send failed for ${email}: ${error.message}`);
      return { delivered: false as const, link };
    }
    return { delivered: true as const, link };
  } catch (err) {
    console.error(`[email] claim send threw for ${email}:`, err);
    return { delivered: false as const, link };
  }
}

/**
 * One-time notice that a password carried over from the previous platform no
 * longer meets SCL's requirements. It is a prompt, not a lockout — the password
 * keeps working until they change it, so the copy must not read as an outage.
 */
export async function sendPasswordUpdateRequiredEmail(email: string) {
  const link = `${appUrl()}/dashboard/security`;

  if (!resend) {
    console.info(`[email:dev] password update notice for ${email}: ${link}`);
    return { delivered: false as const, link };
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: email,
      replyTo: supportReplyTo(),
      subject: "Update your SCL password",
      html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
        <h2>Time to update your password</h2>
        <p>You signed in with the password from your previous SCL account. It's shorter than our current requirement of <strong>${escapeHtml(PASSWORD_POLICY_SUMMARY)}</strong>, so please choose a new one.</p>
        <p>You can keep signing in with your existing password in the meantime — nothing is locked.</p>
        <p><a href="${link}" style="display:inline-block;background:#5b4bdb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Update password</a></p>
        <p style="color:#666;font-size:13px">If you didn't just sign in to SCL, change your password immediately.</p>
      </div>
    `,
    });
    if (error) {
      console.error(
        `[email] password notice failed for ${email}: ${error.message}`,
      );
      return { delivered: false as const, link };
    }
    return { delivered: true as const, link };
  } catch (err) {
    console.error(`[email] password notice threw for ${email}:`, err);
    return { delivered: false as const, link };
  }
}

/**
 * The onboarding note every new capper gets: what SCL rewards (a tracked
 * record), what that record unlocks (packages on their profile), and where to
 * start.
 *
 * Split into a pure renderer so the copy can be asserted without a mailer, and
 * so the plain-text part is built from the same source as the HTML rather than
 * drifting from it. Both parts matter here: this is the most promotional mail
 * SCL sends automatically, and an HTML-only body scores worse with the filters
 * that decide whether a welcome lands in the inbox or the promotions bin.
 */
const WELCOME_SECTIONS = [
  {
    heading: "📊 Build Your SCL Record",
    paragraphs: [
      "The cappers who stand out on SCL are the ones who consistently input their plays and build a track record.",
      "Track your plays daily and build a verified 60-day, 90-day, and season-long performance history that potential customers can see — including your record, win rate, ROI, units, and sample size.",
    ],
  },
  {
    heading: "🛒 Build Your SCL Store",
    paragraphs: [
      "Cappers who consistently build their SCL record can showcase their Winible or Whop packages through their SCL profile.",
      "That means people can discover your record on SCL and then find your packages.",
      "Track your plays → Build your record → Get discovered → Sell your packages.",
    ],
  },
  {
    heading: "📣 We’re Driving Traffic to SCL",
    paragraphs: [
      "We’re actively marketing SCL to bettors through paid advertising and other promotional efforts to drive traffic and exposure to the platform.",
      "The stronger and more complete your SCL profile and track record, the more you have to showcase when bettors discover SCL.",
    ],
  },
] as const;

export const WELCOME_EMAIL_SUBJECT =
  "Welcome to the new Sports Cappers Leaderboard!";

export function renderWelcomeEmail(input: { unsubscribeUrl?: string }): {
  html: string;
  text: string;
} {
  const siteUrl = appUrl();
  const loginUrl = `${siteUrl}/login`;

  const sectionsHtml = WELCOME_SECTIONS.map(
    (section) => `
      <h3 style="font-size:16px;margin:28px 0 8px">${section.heading}</h3>
      ${section.paragraphs
        .map((line) => `<p style="line-height:1.6;margin:0 0 12px">${line}</p>`)
        .join("")}
    `,
  ).join("");

  // Matches the announcement footer: this is onboarding, but it is also the
  // pitch, so it honours the same opt-out rather than claiming to be purely
  // operational mail.
  const unsubscribeHtml = input.unsubscribeUrl
    ? `<hr style="border:none;border-top:1px solid #eee;margin:28px 0" />
       <p style="color:#666;font-size:12px">
         You are receiving this because you have an SCL capper account.
         <a href="${input.unsubscribeUrl}">Unsubscribe from announcements</a> —
         account and security emails will still reach you.
       </p>`
    : "";

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;color:#111">
      <h2 style="margin:0 0 12px">Welcome to the new Sports Cappers Leaderboard!</h2>
      <p style="line-height:1.6;margin:0 0 12px">
        The new SCL platform is officially live, and we’re excited to have you on the roster.
      </p>
      ${sectionsHtml}
      <p style="margin:28px 0 12px">
        <a href="${loginUrl}" style="display:inline-block;background:#5b4bdb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
          👉 Log in and start tracking your plays
        </a>
      </p>
      <p style="color:#666;font-size:13px;margin:0 0 20px">
        <a href="${siteUrl}">${siteUrl}</a>
      </p>
      <p style="line-height:1.6;margin:0 0 12px">
        The more consistently you track your plays, the more valuable your SCL profile becomes.
      </p>
      <p style="line-height:1.6;margin:0 0 12px">
        Welcome to the new SCL. Let’s see where you land on the leaderboard.
      </p>
      <p style="line-height:1.6;margin:0">— Sports Cappers Leaderboard</p>
      ${unsubscribeHtml}
    </div>
  `;

  const text = [
    "Welcome to the new Sports Cappers Leaderboard!",
    "",
    "The new SCL platform is officially live, and we’re excited to have you on the roster.",
    ...WELCOME_SECTIONS.flatMap((section) => [
      "",
      section.heading,
      "",
      ...section.paragraphs.flatMap((line) => [line, ""]),
    ]),
    "👉 Log in and start tracking your plays:",
    loginUrl,
    "",
    "The more consistently you track your plays, the more valuable your SCL profile becomes.",
    "",
    "Welcome to the new SCL. Let’s see where you land on the leaderboard.",
    "",
    "— Sports Cappers Leaderboard",
    ...(input.unsubscribeUrl
      ? ["", `Unsubscribe from announcements: ${input.unsubscribeUrl}`]
      : []),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return { html, text };
}

/**
 * Welcome a new capper. Best-effort — never throws, so a delivery failure can
 * never undo an account that has already been created.
 */
export async function sendWelcomeEmail(input: {
  email: string;
  unsubscribeUrl?: string;
}) {
  const { html, text } = renderWelcomeEmail({
    unsubscribeUrl: input.unsubscribeUrl,
  });

  if (!resend) {
    console.info(`[email:dev] welcome email for ${input.email}`);
    return { delivered: false as const };
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: input.email,
      replyTo: supportReplyTo(),
      subject: WELCOME_EMAIL_SUBJECT,
      html,
      text,
    });
    if (error) {
      console.error(
        `[email] welcome email failed for ${input.email}: ${error.message}`,
      );
      return { delivered: false as const };
    }
    return { delivered: true as const };
  } catch (error) {
    console.error(`[email] welcome email threw for ${input.email}:`, error);
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

  if (!resend) {
    console.info(`[email:dev] broadcast batch of ${messages.length}`, {
      to: messages.map((m) => m.to),
      subject: messages[0]?.subject,
    });
    return messages.map((m) => ({
      address: m.to,
      delivered: false,
      error: "mailer not configured",
    }));
  }

  try {
    const { error } = await resend.batch.send(
      messages.map((m) => ({
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
        error: error.message,
      }));
    }
    return messages.map((m) => ({ address: m.to, delivered: true }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "send threw";
    console.error("[email] broadcast batch threw:", err);
    return messages.map((m) => ({
      address: m.to,
      delivered: false,
      error: message,
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
