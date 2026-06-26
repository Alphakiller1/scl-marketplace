import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "no-reply@scl.local";
const resend = apiKey ? new Resend(apiKey) : null;

function appUrl() {
  return process.env.AUTH_URL ?? "http://localhost:3000";
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

  await resend.emails.send({
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
  return { delivered: true as const, link };
}
