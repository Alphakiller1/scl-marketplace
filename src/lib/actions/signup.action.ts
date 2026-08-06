"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { after } from "next/server";

import { prisma } from "@/lib/prisma";
import { signupSchema, type SignupInput } from "@/lib/schemas/auth.schema";
import { createVerificationToken } from "@/lib/tokens";
import {
  sendNewSignupNotificationEmail,
  sendVerificationEmail,
} from "@/lib/email";
import { CONSENT_TEXT_VERSION } from "@/lib/legal";
import { getCurrentPolicyBundle } from "@/lib/queries/policies";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIdentity } from "@/lib/request-identity";
import { evaluateAccountClaim, handleTakenMessage } from "@/lib/account-claim";
import { ensureAuthEmailSchema } from "@/lib/ensure-auth-email-schema";
import { emailVerificationEnforced } from "@/lib/email-verification-policy";

type SignupResult =
  | { ok: true; emailDelivered: boolean; verifyUrl?: string }
  | { ok: false; error: string };

/**
 * Account state for a fresh or re-claimed signup.
 *
 * `emailVerified` is deliberately absent. Signup has no evidence that anyone read the inbox
 * it was handed, so it records none: the column is written by `consumeVerificationToken` and
 * nothing else. It used to be stamped here whenever the verify gate was off, which meant a
 * capper who never received a link still showed "Verified" to admins — and
 * `resendVerificationAction` skips verified accounts, so the one recovery path was closed to
 * precisely the people who needed it. Access when mail is undeliverable is
 * `emailVerificationEnforced()`'s job; it is not this row's job to lie about it.
 *
 * Computed per call — as a module constant its `new Date()` froze at the first import, so
 * every account created on a warm serverless instance shared one timestamp, several seconds
 * *before* the row it belonged to.
 */
function newAccountState() {
  return emailVerificationEnforced()
    ? { accountStatus: "PENDING" as const }
    : { accountStatus: "ACTIVE" as const };
}

export async function signupAction(input: SignupInput): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Please check the form and try again." };

  await ensureAuthEmailSchema(prisma);

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
          ...newAccountState(),
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
          ...newAccountState(),
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

  // The account is valid even if email delivery fails.
  //
  // When the mailer isn't configured at all, hand the verify link back so the UI can finish
  // in one tap rather than pointing at an inbox nothing was sent to. That link is a bypass —
  // it proves possession of the browser, not the inbox — so it is offered ONLY while the gate
  // is off and verification therefore buys no access. With the gate on, a failed send is
  // reported honestly and recovered through resend, never routed around.
  let emailDelivered = false;
  let verifyUrl: string | undefined;
  try {
    const token = await createVerificationToken(userId, { force: true });
    if (token) {
      const delivery = await sendVerificationEmail(lowerEmail, token, username);
      emailDelivered = delivery.delivered;
      if (!delivery.delivered && !emailVerificationEnforced()) {
        verifyUrl = delivery.link;
      }
    }
  } catch (error) {
    console.error("[signup] verification delivery failed:", error);
  }

  // Owners hear about every new capper. Handed to `after()` so signup doesn't wait on an
  // internal notice — but it still runs to completion. A bare `void` left the request's last
  // promise unowned, and a serverless instance is frozen the moment its response is returned,
  // so the send was routinely killed mid-flight: owners got nothing, and no error was raised
  // anywhere because the call never got far enough to fail.
  after(async () => {
    await sendNewSignupNotificationEmail({
      username,
      email: lowerEmail,
      signedUpAt: new Date(),
    });
  });

  return { ok: true, emailDelivered, verifyUrl };
}
