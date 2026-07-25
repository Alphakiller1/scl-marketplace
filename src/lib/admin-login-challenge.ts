import "server-only";

import { randomInt } from "crypto";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

const CHALLENGE_TTL_MS = 1000 * 60 * 10;
const MAX_ATTEMPTS = 5;

/** Unbiased 6-digit code, zero-padded (`randomInt` avoids modulo skew). */
function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Issue a fresh sign-in code. Any outstanding challenge for the user is dropped
 * first, so only the most recently emailed code can ever be redeemed.
 */
export async function createAdminLoginChallenge(userId: string) {
  const code = generateCode();
  // Hash before opening the transaction — bcrypt at cost 12 is slow enough that
  // holding the transaction across it would be wasteful.
  const codeHash = await bcrypt.hash(code, 12);

  const challenge = await prisma.$transaction(async (transaction) => {
    await transaction.adminLoginChallenge.deleteMany({ where: { userId } });
    return transaction.adminLoginChallenge.create({
      data: {
        userId,
        codeHash,
        expires: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
      select: { id: true },
    });
  });

  return { challengeId: challenge.id, code };
}

/**
 * Identify the admin behind an outstanding challenge, so a code can be re-sent.
 *
 * Takes the challenge id rather than the password: the row is itself proof the
 * password was verified, so a resend never needs the password held in the page.
 * Returns the owner without touching the challenge — the caller throttles on the
 * user id, which (unlike the challenge id) survives the code being rotated.
 */
export async function findChallengeOwner(challengeId: string) {
  const existing = await prisma.adminLoginChallenge.findUnique({
    where: { id: challengeId },
    select: {
      userId: true,
      expires: true,
      user: { select: { email: true, role: true, accountStatus: true } },
    },
  });
  if (!existing || existing.expires < new Date()) return null;
  if (existing.user.role !== "ADMIN") return null;
  if (
    existing.user.accountStatus === "SUSPENDED" ||
    existing.user.accountStatus === "DISABLED"
  ) {
    return null;
  }

  return { userId: existing.userId, email: existing.user.email };
}

/**
 * Redeem a code. Returns the user id on success, or null for a wrong, expired,
 * unknown, or exhausted challenge — the caller must not distinguish these.
 * A successful or exhausted challenge is deleted, so a code works exactly once.
 */
export async function consumeAdminLoginChallenge(
  challengeId: string,
  code: string,
): Promise<string | null> {
  const challenge = await prisma.adminLoginChallenge.findUnique({
    where: { id: challengeId },
    select: {
      id: true,
      userId: true,
      codeHash: true,
      attempts: true,
      expires: true,
    },
  });
  if (!challenge) return null;

  if (challenge.expires < new Date() || challenge.attempts >= MAX_ATTEMPTS) {
    await prisma.adminLoginChallenge.deleteMany({ where: { id: challenge.id } });
    return null;
  }

  if (!(await bcrypt.compare(code, challenge.codeHash))) {
    const { count } = await prisma.adminLoginChallenge.updateMany({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    // Burn the challenge once the attempt budget is gone.
    if (count === 1 && challenge.attempts + 1 >= MAX_ATTEMPTS) {
      await prisma.adminLoginChallenge.deleteMany({
        where: { id: challenge.id },
      });
    }
    return null;
  }

  // Delete-then-check: two concurrent redemptions of the same code race here,
  // and only the one that actually removed the row is allowed to sign in.
  const consumed = await prisma.adminLoginChallenge.deleteMany({
    where: { id: challenge.id, expires: { gt: new Date() } },
  });
  if (consumed.count !== 1) return null;

  return challenge.userId;
}
