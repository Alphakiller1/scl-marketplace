import { createHash, randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const TOKEN_COOLDOWN_MS = 1000 * 60;
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/**
 * Create a fresh email-verification token for a user, replacing any existing
 * one. Returns the raw token to embed in the verification link.
 */
export async function createVerificationToken(
  userId: string,
  options?: { force?: boolean },
): Promise<string | null> {
  const identifier = userId;
  // `force` bypasses the resend cooldown — used by signup itself, where the user always
  // needs a working token (the cooldown only guards the standalone "resend" button from abuse).
  if (!options?.force) {
    const existing = await prisma.verificationToken.findFirst({
      where: { identifier },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (
      existing &&
      existing.createdAt.getTime() > Date.now() - TOKEN_COOLDOWN_MS
    ) {
      return null;
    }
  }

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token: hashToken(token), expires },
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
  const tokenHash = hashToken(token);
  const record = await prisma.verificationToken.findUnique({
    where: { token: tokenHash },
  });
  if (!record) return null;

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token: tokenHash } });
    return null;
  }

  return prisma.$transaction(async (transaction) => {
    const consumed = await transaction.verificationToken.deleteMany({
      where: { token: tokenHash, expires: { gt: new Date() } },
    });
    if (consumed.count !== 1) return null;

    const user = await transaction.user.findUnique({
      where: { id: record.identifier },
      select: { id: true, email: true, accountStatus: true },
    });
    if (!user) return null;

    await transaction.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        ...(user.accountStatus === "PENDING"
          ? { accountStatus: "ACTIVE" as const }
          : {}),
      },
    });
    return user.email;
  });
}
