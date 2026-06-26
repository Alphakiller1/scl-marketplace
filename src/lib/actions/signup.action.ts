"use server";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { signupSchema, type SignupInput } from "@/lib/schemas/auth.schema";
import { createVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";

// Bump when the terms/privacy policy changes (recorded per acceptance).
const TERMS_VERSION = "2026-06-26";

type SignupResult = { ok: true } | { ok: false; error: string };

export async function signupAction(input: SignupInput): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Please check the form and try again." };

  const { email, username, displayName, password } = parsed.data;
  const lowerEmail = email.toLowerCase();

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
  await prisma.user.create({
    data: {
      email: lowerEmail,
      username,
      displayName,
      passwordHash,
      role: "CAPPER",
      capperProfile: { create: {} },
      termsAcceptances: { create: { policyVersion: TERMS_VERSION } },
    },
  });

  const token = await createVerificationToken(lowerEmail);
  await sendVerificationEmail(lowerEmail, token);

  return { ok: true };
}
