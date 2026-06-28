import "server-only";

import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60;
const RESET_TOKEN_COOLDOWN_MS = 1000 * 60;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function createPasswordResetToken(
  userId: string,
): Promise<string | null> {
  const existing = await prisma.passwordResetToken.findUnique({
    where: { userId },
    select: { createdAt: true },
  });
  if (
    existing &&
    existing.createdAt.getTime() > Date.now() - RESET_TOKEN_COOLDOWN_MS
  ) {
    return null;
  }

  const token = randomBytes(32).toString("hex");
  const now = new Date();
  await prisma.passwordResetToken.upsert({
    where: { userId },
    create: {
      userId,
      tokenHash: hashToken(token),
      expires: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
      createdAt: now,
    },
    update: {
      tokenHash: hashToken(token),
      expires: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
      createdAt: now,
    },
  });

  return token;
}

export async function consumePasswordResetToken(
  token: string,
  password: string,
): Promise<boolean> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          emailVerified: true,
          accountStatus: true,
        },
      },
    },
  });
  if (!record) return false;

  if (record.expires < new Date()) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } });
    return false;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.$transaction(async (transaction) => {
    const consumed = await transaction.passwordResetToken.deleteMany({
      where: {
        id: record.id,
        tokenHash: hashToken(token),
        expires: { gt: new Date() },
      },
    });
    if (consumed.count !== 1) return false;

    await transaction.user.update({
      where: { id: record.user.id },
      data: {
        passwordHash,
        emailVerified: record.user.emailVerified ?? new Date(),
        ...(record.user.accountStatus === "PENDING"
          ? { accountStatus: "ACTIVE" as const }
          : {}),
      },
    });
    await transaction.verificationToken.deleteMany({
      where: { identifier: record.user.email },
    });
    return true;
  });
}
