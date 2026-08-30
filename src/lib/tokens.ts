import { createHash, createHmac, randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const TOKEN_COOLDOWN_MS = 1000 * 60;
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/**
 * Stable, unguessable raw token for one automated delivery.
 *
 * A provider can accept a message and lose the HTTP response. Resend then
 * deduplicates our retry by idempotency key, meaning the capper still has the
 * first email. Regenerating a random verification token during that retry
 * would invalidate the link in that first email. HMAC keeps the raw token
 * stable for this delivery without storing it in plaintext.
 */
export function deriveAutomationVerificationToken(
  userId: string,
  deliveryId: string,
  secret: string,
): string {
  if (!secret.trim()) throw new Error("A token secret is required.");
  return createHmac("sha256", secret)
    .update(`scl-email-verification:${userId}:${deliveryId}`)
    .digest("hex");
}

export async function createAutomationVerificationToken(
  userId: string,
  deliveryId: string,
  secret: string,
): Promise<string> {
  const token = deriveAutomationVerificationToken(userId, deliveryId, secret);
  const expires = new Date(Date.now() + TOKEN_TTL_MS);
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: userId } }),
    prisma.verificationToken.create({
      data: { identifier: userId, token: hashToken(token), expires },
    }),
  ]);
  return token;
}

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
/**
 * Consume a verification link, returning who it belonged to.
 *
 * The token row is deleted inside the transaction and the caller only gets a
 * result when this call is the one that deleted it, so a second click on the
 * same link returns null. Callers can therefore treat a non-null result as
 * "this account just became verified, exactly once" and fire one-time work
 * (the welcome email) from it without needing their own guard.
 */
export async function consumeVerificationToken(token: string): Promise<{
  userId: string;
  email: string;
  marketingOptOut: boolean;
} | null> {
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
      select: {
        id: true,
        email: true,
        accountStatus: true,
        marketingOptOut: true,
      },
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
    return {
      userId: user.id,
      email: user.email,
      marketingOptOut: user.marketingOptOut,
    };
  });
}
