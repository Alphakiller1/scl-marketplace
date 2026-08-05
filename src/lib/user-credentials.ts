import { prisma } from "@/lib/prisma";

/** Resolve a capper account by the email + username pair used at login. */
export async function findUserByEmailAndUsername(
  email: string,
  username: string,
) {
  return prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      username,
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
