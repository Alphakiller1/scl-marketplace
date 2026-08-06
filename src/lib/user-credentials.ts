import { prisma } from "@/lib/prisma";

const userSelect = {
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
} as const;

/**
 * Legacy imports plus-addressed shared inboxes (`user+handle@domain`) when the
 * old schema required unique emails. Cappers still sign in with the bare
 * address they actually use — resolve that variant at lookup time.
 */
export function buildLegacyPlusAddressEmail(
  email: string,
  username: string,
): string | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 0) return null;

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!local || !domain || local.includes("+")) return null;

  return `${local}+${username.toLowerCase()}@${domain}`;
}

async function queryUserByEmailAndUsername(email: string, username: string) {
  return prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      username: { equals: username, mode: "insensitive" },
    },
    select: userSelect,
  });
}

/** Resolve a capper account by the email + username pair used at login. */
export async function findUserByEmailAndUsername(
  email: string,
  username: string,
) {
  const normalizedEmail = email.toLowerCase();
  const direct = await queryUserByEmailAndUsername(normalizedEmail, username);
  if (direct) return direct;

  const legacyPlus = buildLegacyPlusAddressEmail(normalizedEmail, username);
  if (!legacyPlus || legacyPlus === normalizedEmail) return null;

  return queryUserByEmailAndUsername(legacyPlus, username);
}
