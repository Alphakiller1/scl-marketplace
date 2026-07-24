"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import { getCurrentPolicyVersion } from "@/lib/legal";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIdentity } from "@/lib/request-identity";
import {
  customerSignupSchema,
  type CustomerSignupInput,
} from "@/lib/schemas/customer.schema";
import { createVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";

type CustomerSignupResult =
  | { ok: true; emailDelivered: boolean; verifyUrl?: string }
  | { ok: false; error: string };

const REQUIRE_EMAIL_VERIFICATION =
  process.env.REQUIRE_EMAIL_VERIFICATION === "true";

const newAccountState = REQUIRE_EMAIL_VERIFICATION
  ? { accountStatus: "PENDING" as const }
  : { accountStatus: "ACTIVE" as const, emailVerified: new Date() };

export async function customerSignupAction(
  input: CustomerSignupInput,
): Promise<CustomerSignupResult> {
  const parsed = customerSignupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }

  const { email, password, displayName, marketingOptIn } = parsed.data;
  const lowerEmail = email.toLowerCase();
  const requestIdentity = await getRequestIdentity();
  const policyVersion = await getCurrentPolicyVersion();

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
    return { ok: false, error: "Too many signup attempts. Try again later." };
  }

  const existing = await prisma.user.findUnique({
    where: { email: lowerEmail },
    select: { id: true, emailVerified: true },
  });
  if (existing?.emailVerified) {
    return {
      ok: false,
      error: "An account with that email already exists. Try logging in.",
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role: "CUSTOMER",
          displayName: displayName?.trim() || null,
          ...newAccountState,
          customerProfile: {
            upsert: {
              create: { marketingOptIn: marketingOptIn ?? true },
              update: { marketingOptIn: marketingOptIn ?? true },
            },
          },
          termsAcceptances: {
            create: { policyVersion },
          },
        },
      });
    } else {
      await prisma.user.create({
        data: {
          email: lowerEmail,
          displayName: displayName?.trim() || null,
          passwordHash,
          role: "CUSTOMER",
          ...newAccountState,
          customerProfile: {
            create: { marketingOptIn: marketingOptIn ?? true },
          },
          termsAcceptances: {
            create: { policyVersion },
          },
        },
      });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "That email is already taken." };
    }
    console.error("[customerSignup] account creation failed:", error);
    return { ok: false, error: "Could not create your account. Try again." };
  }

  if (REQUIRE_EMAIL_VERIFICATION) {
    const token = await createVerificationToken(lowerEmail);
    const mail = await sendVerificationEmail(lowerEmail, token);
    return {
      ok: true,
      emailDelivered: mail.delivered,
      verifyUrl: mail.link,
    };
  }

  return { ok: true, emailDelivered: false };
}
