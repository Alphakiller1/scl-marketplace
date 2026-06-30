"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { signupSchema, type SignupInput } from "@/lib/schemas/auth.schema";
import { createVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { CURRENT_POLICY_VERSION } from "@/lib/legal";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIdentity } from "@/lib/request-identity";

type SignupResult =
  | { ok: true; emailDelivered: boolean; verifyUrl?: string }
  | { ok: false; error: string };

export async function signupAction(input: SignupInput): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Please check the form and try again." };

  const { email, username, displayName, password } = parsed.data;
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

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: lowerEmail }, { username }] },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: "An account with that email or username already exists.",
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await prisma.user.create({
      data: {
        email: lowerEmail,
        username,
        displayName,
        passwordHash,
        role: "CAPPER",
        accountStatus: "PENDING",
        capperProfile: { create: {} },
        termsAcceptances: {
          create: { policyVersion: CURRENT_POLICY_VERSION },
        },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "An account with that email or username already exists.",
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
    const token = await createVerificationToken(lowerEmail);
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
