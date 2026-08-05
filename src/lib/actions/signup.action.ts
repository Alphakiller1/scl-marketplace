"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { signupSchema, type SignupInput } from "@/lib/schemas/auth.schema";
import { createVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { CONSENT_TEXT_VERSION } from "@/lib/legal";
import { getCurrentPolicyBundle } from "@/lib/queries/policies";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIdentity } from "@/lib/request-identity";
import { evaluateAccountClaim, handleTakenMessage } from "@/lib/account-claim";

type SignupResult =
  | { ok: true; emailDelivered: boolean; verifyUrl?: string }
  | { ok: false; error: string };

// Email delivery requires a verified Resend sender domain. Until that's configured, gating
// access on a verification email that can't be delivered locks everyone out, so new accounts
// are activated immediately. Set REQUIRE_EMAIL_VERIFICATION=true once a real sender domain is
// live to restore the verify-before-access gate.
const REQUIRE_EMAIL_VERIFICATION =
  process.env.REQUIRE_EMAIL_VERIFICATION === "true";

// Account state for a fresh/re-claimed signup: pending until verified when verification is
// required, otherwise immediately active (and marked verified) so the account is usable now.
const newAccountState = REQUIRE_EMAIL_VERIFICATION
  ? { accountStatus: "PENDING" as const }
  : { accountStatus: "ACTIVE" as const, emailVerified: new Date() };

export async function signupAction(input: SignupInput): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Please check the form and try again." };

  const { email, username, password } = parsed.data;
  const lowerEmail = email.toLowerCase();
  const requestIdentity = await getRequestIdentity();
  const [emailAllowed, requestAllowed] = await Promise.all([
    consumeRateLimit({
      scope: "signup-email",
      identity: `${lowerEmail}:${username}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    }),
    consumeRateLimit({
      scope: "signup-request",
      identity: requestIdentity,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    }),
  ]);
  if (!emailAllowed || !requestAllowed) {
    return {
      ok: false,
      error: "Too many signup attempts. Try again later.",
    };
  }

  const [passwordHash, policyBundle] = await Promise.all([
    bcrypt.hash(password, 12),
    getCurrentPolicyBundle(),
  ]);
  const acceptanceData = {
    policyVersion: policyBundle.id,
    termsVersion: policyBundle.termsVersion,
    privacyVersion: policyBundle.privacyVersion,
    responsibleGamingVersion: policyBundle.responsibleGamingVersion,
    refundVersion: policyBundle.refundVersion,
    consentTextVersion: CONSENT_TEXT_VERSION,
  };

  const byUsername = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      emailVerified: true,
      accountStatus: true,
    },
  });

  let userId: string;

  try {
    if (byUsername) {
      const claim = evaluateAccountClaim(byUsername);
      if (!claim.claimable) {
        return { ok: false, error: handleTakenMessage(byUsername) };
      }

      // Either an account carried over from the previous platform that nobody has ever signed
      // in to (no password), or an UNVERIFIED signup whose verification email never arrived.
      // Both are the same move: set credentials on the existing record — preserving the
      // capper profile, plays, and public history — instead of dead-ending on "already exists".
      const updated = await prisma.user.update({
        where: { id: byUsername.id },
        data: {
          email: lowerEmail,
          passwordHash,
          // A signup claim never grants privilege: whoever completes this form gets a
          // capper account, even if the record they claimed was an admin. An admin who
          // needs their own account back uses the emailed claim/reset link, which proves
          // control of the inbox and leaves the role untouched.
          role: "CAPPER",
          ...newAccountState,
          capperProfile: { upsert: { create: {}, update: {} } },
          termsAcceptances: {
            create: {
              ...acceptanceData,
              acceptanceSource:
                claim.reason === "UNCLAIMED" ? "CLAIM" : "SIGNUP",
            },
          },
        },
        select: { id: true },
      });
      userId = updated.id;
    } else {
      const created = await prisma.user.create({
        data: {
          email: lowerEmail,
          username,
          passwordHash,
          role: "CAPPER",
          ...newAccountState,
          capperProfile: { create: {} },
          termsAcceptances: {
            create: { ...acceptanceData, acceptanceSource: "SIGNUP" },
          },
        },
        select: { id: true },
      });
      userId = created.id;
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "That email and handle combination is already taken.",
      };
    }
    console.error("[signup] account creation failed:", error);
    return { ok: false, error: "We couldn't create that account." };
  }

  // The account is valid even if email delivery fails. Track whether the verification email
  // actually sent; when it didn't (e.g. sender domain not yet verified), hand back the verify
  // link so the UI can let the user finish in one tap instead of waiting for an email that
  // never arrives. This fallback self-heals: once a verified sender is configured, emails
  // deliver and `verifyUrl` is no longer returned.
  let emailDelivered = false;
  let verifyUrl: string | undefined;
  try {
    const token = await createVerificationToken(userId, { force: true });
    if (token) {
      const delivery = await sendVerificationEmail(lowerEmail, token, username);
      emailDelivered = delivery.delivered;
      if (!delivery.delivered) verifyUrl = delivery.link;
    }
  } catch (error) {
    console.error("[signup] verification delivery failed:", error);
  }

  return { ok: true, emailDelivered, verifyUrl };
}
