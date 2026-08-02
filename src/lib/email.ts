import { Resend } from "resend";

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
export async function sendVerificationEmail(email: string, token: string) {
  const link = `${appUrl()}/verify?token=${token}`;

  if (!resend) {
    console.info(`[email:dev] verification link for ${email}: ${link}`);
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

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${appUrl()}/reset-password?token=${token}`;

  if (!resend) {
    console.info(`[email:dev] password reset link for ${email}: ${link}`);
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
