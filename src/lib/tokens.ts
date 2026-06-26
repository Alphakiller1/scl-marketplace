import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h

/**
 * Create a fresh email-verification token for an email, replacing any existing
 * one. Returns the raw token to embed in the verification link.
 */
export async function createVerificationToken(email: string): Promise<string> {
  const identifier = email.toLowerCase();
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  });
  return token;
}

/**
 * Consume a verification token: if valid + unexpired, mark the user verified.
 * Returns the verified email, or null if invalid/expired.
 */
export async function consumeVerificationToken(
  token: string,
): Promise<string | null> {
  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });
  if (!record) return null;

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    return null;
  }

  await prisma.user.update({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  });
  await prisma.verificationToken.delete({ where: { token } });
  return record.identifier;
}
