import { prisma } from "@/lib/prisma";

/**
 * Resolve a capper account by the email + username pair used at login.
 *
 * The username match is case-insensitive. Email was already lowercased here,
 * but username was compared exactly — and the legacy import preserved the
 * handles as the old platform stored them, so 79 of 133 accounts carry
 * mixed case (`SharpMetricsMLB`, `A2ZPICKS`, `BTTSPlays`). A capper typing
 * their own handle in lowercase found no row, so the password was never
 * checked and a correct legacy password read as wrong.
 *
 * Handles are already unique case-insensitively — signup rejects collisions —
 * so relaxing this cannot match somebody else's account.
 */
export async function findUserByEmailAndUsername(
  email: string,
  username: string,
) {
  return prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      username: { equals: username, mode: "insensitive" },
    },
    select: {
      id: true,
      email: true,
      username: true,
      passwordHash: true,
      legacyPasswordHash: true,
      legacyPasswordFormat: true,
      passwordUpdateRequiredAt: true,
      passwordNoticeSentAt: true,
      image: true,
      role: true,
      accountStatus: true,
      emailVerified: true,
    },
  });
}
