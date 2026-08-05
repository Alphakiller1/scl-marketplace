import { Resend } from "resend";
import type { StoreProvider } from "@prisma/client";

import { PASSWORD_POLICY_SUMMARY } from "@/lib/password-policy";
import { providerLabel, SCL_AFFILIATE_EMAIL } from "@/lib/store-connection";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "no-reply@scl.local";
const resend = apiKey ? new Resend(apiKey) : null;

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
 * Admin-initiated email to a capper (storefront / affiliate follow-up).
 * Reply-to is the sending admin when available, otherwise support.
 */
export async function sendCapperOutreachEmail(input: {
  to: string;
  subject: string;
  message: string;
  replyTo?: string | null;
  capperUsername?: string | null;
}) {
  const handle = input.capperUsername?.replace(/^@/, "") ?? null;
  const handleLine = handle
    ? `<p style="color:#666;font-size:14px">Account: <strong>@${escapeHtml(handle)}</strong></p>`
    : "";
  const replyTo =
    input.replyTo?.trim() || process.env.SUPPORT_EMAIL_TO?.trim() || undefined;
  const subject = input.subject.trim().startsWith("[SCL]")
    ? input.subject.trim()
    : `[SCL] ${input.subject.trim()}`;

  if (!resend) {
    console.info("[email:dev] capper outreach", {
      to: input.to,
      subject,
      replyTo,
      message: input.message,
    });
    return { delivered: false as const };
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      ...(replyTo ? { replyTo } : {}),
      subject,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:640px;margin:auto">
          <h2>Message from Sports Cappers Leaderboard</h2>
          ${handleLine}
          <p style="white-space:pre-wrap;line-height:1.5">${escapeHtml(input.message)}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
          <p style="color:#666;font-size:13px">
            Reply to this email if you have questions. This message was sent by the SCL team regarding your storefront setup.
          </p>
        </div>
      `,
    });
    if (error) {
      console.error(
        `[email] capper outreach failed for ${input.to}: ${error.message}`,
      );
      return { delivered: false as const };
    }
    return { delivered: true as const };
  } catch (error) {
    console.error(`[email] capper outreach threw for ${input.to}:`, error);
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
