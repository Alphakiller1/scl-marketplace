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
      identity: lowerEmail,
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
    acceptanceSource: "SIGNUP",
  };

  // Look up any account already on this email or this handle (separately, so we know which
  // one collided).
  const [byEmail, byUsername] = await Promise.all([
    prisma.user.findUnique({
      where: { email: lowerEmail },
      select: { id: true, emailVerified: true },
    }),
    prisma.user.findUnique({
      where: { username },
      select: { id: true },
    }),
  ]);

  // The handle is taken by a *different* account.
  if (byUsername && byUsername.id !== byEmail?.id) {
    return { ok: false, error: "That handle is already taken." };
  }

  try {
    if (byEmail) {
      if (byEmail.emailVerified) {
        // A real, verified account owns this email — never overwrite it.
        return {
          ok: false,
          error: "An account with that email already exists. Try logging in.",
        };
      }
      // The email only has an UNVERIFIED account — e.g. a first signup whose verification
      // email never arrived. Let the person re-claim it: refresh their details and re-send
      // verification, instead of dead-ending on "already exists".
      await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          username,
          passwordHash,
          role: "CAPPER",
          ...newAccountState,
          capperProfile: { upsert: { create: {}, update: {} } },
          termsAcceptances: {
            create: acceptanceData,
          },
        },
        select: { id: true },
      });
    } else {
      await prisma.user.create({
        data: {
          email: lowerEmail,
          username,
          passwordHash,
          role: "CAPPER",
          ...newAccountState,
          capperProfile: { create: {} },
          termsAcceptances: {
            create: acceptanceData,
          },
        },
        select: { id: true },
      });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "That email or handle is already taken.",
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
    const token = await createVerificationToken(lowerEmail, { force: true });
    if (token) {
      const delivery = await sendVerificationEmail(lowerEmail, token);
      emailDelivered = delivery.delivered;
      if (!delivery.delivered) verifyUrl = delivery.link;
    }
  } catch (error) {
    console.error("[signup] verification delivery failed:", error);
  }

  return { ok: true, emailDelivered, verifyUrl };
}
