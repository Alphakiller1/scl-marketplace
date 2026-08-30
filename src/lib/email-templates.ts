/**
 * Owner-editable copy for the emails cappers receive.
 *
 * Owners edit words, never plumbing. A template carries a subject, a body, the
 * label on its button, and the small print underneath — and the body places the
 * button with `{{button}}` rather than containing a link. The href is supplied
 * by the code that sends the mail, so no edit can point a verification button at
 * the wrong place or drop it entirely (saving without `{{button}}` is rejected).
 *
 * Everything here is pure: no database, no mailer. The defaults below are the
 * copy that ships in the build, and they stay the fallback whenever storage is
 * unavailable — a template nobody has edited renders byte-identically to the
 * hard-coded version it replaced.
 */

export type EmailTemplateSlug =
  | "WELCOME"
  | "VERIFY_EMAIL_REMINDER"
  | "NO_PLAYS_NUDGE"
  | "VERIFICATION"
  | "PASSWORD_RESET"
  | "ACCOUNT_CLAIM"
  | "PASSWORD_UPDATE_REQUIRED";

export const EMAIL_TEMPLATE_SLUGS: readonly EmailTemplateSlug[] = [
  "WELCOME",
  "VERIFY_EMAIL_REMINDER",
  "NO_PLAYS_NUDGE",
  "VERIFICATION",
  "PASSWORD_RESET",
  "ACCOUNT_CLAIM",
  "PASSWORD_UPDATE_REQUIRED",
] as const;

export function isEmailTemplateSlug(value: string): value is EmailTemplateSlug {
  return (EMAIL_TEMPLATE_SLUGS as readonly string[]).includes(value);
}

export type EmailTemplateContent = {
  subject: string;
  body: string;
  actionLabel: string;
  footnote: string;
};

export type EmailTemplateMeta = EmailTemplateContent & {
  label: string;
  /** What triggers this email, in the owner's terms. */
  description: string;
  /** Substitutions this template may use, beyond `{{button}}`. */
  variables: readonly { token: string; describes: string }[];
};

const BUTTON_TOKEN = "{{button}}";

export const EMAIL_TEMPLATES: Record<EmailTemplateSlug, EmailTemplateMeta> = {
  WELCOME: {
    label: "Welcome",
    description:
      "Sent once, when a capper verifies their email and the account starts working.",
    variables: [],
    subject: "Welcome to the new Sports Cappers Leaderboard!",
    actionLabel: "👉 Log in and start tracking your plays",
    body: `# Welcome to the new Sports Cappers Leaderboard!

The new SCL platform is officially live, and we’re excited to have you on the roster.

# 📊 Build Your SCL Record

The cappers who stand out on SCL are the ones who consistently input their plays and build a track record.

Track your plays daily and build a verified 60-day, 90-day, and season-long performance history that potential customers can see — including your record, win rate, ROI, units, and sample size.

# 🛒 Build Your SCL Store

Cappers who consistently build their SCL record can showcase their Winible or Whop packages through their SCL profile.

That means people can discover your record on SCL and then find your packages.

Track your plays → Build your record → Get discovered → Sell your packages.

# 📣 We’re Driving Traffic to SCL

We’re actively marketing SCL to bettors through paid advertising and other promotional efforts to drive traffic and exposure to the platform.

The stronger and more complete your SCL profile and track record, the more you have to showcase when bettors discover SCL.

{{button}}

The more consistently you track your plays, the more valuable your SCL profile becomes.

Welcome to the new SCL. Let’s see where you land on the leaderboard.

— Sports Cappers Leaderboard`,
    footnote: "",
  },

  VERIFY_EMAIL_REMINDER: {
    label: "Verification reminder",
    description:
      "Sent once after the configured delay when a new capper still has not confirmed their email.",
    variables: [
      { token: "{{account}}", describes: "the capper's @handle, when known" },
    ],
    subject: "Reminder: confirm your SCL email",
    actionLabel: "Confirm my email",
    body: `# Your SCL account is almost ready

{{account}}

Confirm your email to activate your capper workspace, submit plays, and begin building a verified SCL record.

{{button}}`,
    footnote:
      "This new link expires in 24 hours. If you didn't create an SCL account, ignore this email.",
  },

  NO_PLAYS_NUDGE: {
    label: "No-plays follow-up",
    description:
      "Sent once after the configured delay when a newly verified capper still has no straight plays or parlays.",
    variables: [
      { token: "{{account}}", describes: "the capper's @handle, when known" },
    ],
    subject: "Start building your SCL record",
    actionLabel: "Submit my first play",
    body: `# Put your first play on the board

{{account}}

Your SCL account is ready, but your record starts taking shape only after you submit plays.

Logging your picks consistently builds the transparent history bettors want to see: record, win rate, ROI, units, and sample size. A stronger SCL record also gives your profile and packages more credibility when bettors discover you.

{{button}}

Start with today's best play and keep building from there.`,
    footnote: "You will receive this getting-started reminder only once.",
  },

  VERIFICATION: {
    label: "Verify email",
    description: "Sent at signup, and again whenever a capper asks to resend.",
    variables: [
      { token: "{{account}}", describes: "the capper's @handle, when known" },
    ],
    subject: "Verify your SCL account",
    actionLabel: "Verify email",
    body: `# Verify your email

{{account}}

Confirm your email to start logging plays and building your record on SCL.

{{button}}`,
    footnote:
      "This link expires in 24 hours. If you didn't sign up, ignore this email.",
  },

  PASSWORD_RESET: {
    label: "Password reset",
    description: "Sent when a capper asks to reset their password.",
    variables: [
      { token: "{{account}}", describes: "the capper's @handle, when known" },
    ],
    subject: "Reset your SCL password",
    actionLabel: "Reset password",
    body: `# Reset your password

{{account}}

Use the secure link below to choose a new password for your SCL account.

{{button}}`,
    footnote:
      "This link expires in one hour and works once. If you didn't request it, ignore this email.",
  },

  ACCOUNT_CLAIM: {
    label: "Claim account",
    description:
      "Sent when an admin invites a capper carried over from the previous platform to claim their profile.",
    variables: [],
    subject: "Set your SCL password",
    actionLabel: "Set password",
    body: `# Claim your SCL account

Your capper profile and record were carried over to SCL. Set a password with the secure link below to sign in, review the current policies, and keep posting.

{{button}}`,
    footnote:
      "This link expires in one hour and works once. If you didn't expect it, ignore this email.",
  },

  PASSWORD_UPDATE_REQUIRED: {
    label: "Password update needed",
    description:
      "Sent once when a capper signs in with a password carried over from the previous platform that no longer meets SCL's requirements.",
    variables: [
      {
        token: "{{password_policy}}",
        describes: "the current password requirement, e.g. 10+ characters",
      },
    ],
    subject: "Update your SCL password",
    actionLabel: "Update password",
    body: `# Time to update your password

You signed in with the password from your previous SCL account. It's shorter than our current requirement of {{password_policy}}, so please choose a new one.

You can keep signing in with your existing password in the meantime — nothing is locked.

{{button}}`,
    footnote:
      "If you didn't just sign in to SCL, change your password immediately.",
  },
};

export function defaultEmailTemplate(
  slug: EmailTemplateSlug,
): EmailTemplateContent {
  const { subject, body, actionLabel, footnote } = EMAIL_TEMPLATES[slug];
  return { subject, body, actionLabel, footnote };
}

/** Every template sends a button, so every body must place one. */
export function bodyPlacesButton(body: string): boolean {
  return body.includes(BUTTON_TOKEN);
}

/** Tokens used in the body that this template does not define. */
export function unknownVariables(
  slug: EmailTemplateSlug,
  body: string,
): string[] {
  const allowed = new Set([
    BUTTON_TOKEN,
    ...EMAIL_TEMPLATES[slug].variables.map((v) => v.token),
  ]);
  const used = body.match(/\{\{[a-z_]+\}\}/gi) ?? [];
  return [...new Set(used.filter((token) => !allowed.has(token)))];
}
