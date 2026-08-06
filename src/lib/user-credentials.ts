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

export type LoginCandidate = Awaited<
  ReturnType<typeof findUserByEmailAndUsername>
>;

/**
 * Accounts a sign-in identifier could refer to.
 *
 * A username is unique, so it names exactly one account. An email is not:
 * `@@unique([email, username])` means one inbox can carry several accounts —
 * the shared brand inboxes carried over from the previous platform do exactly
 * that. So this returns a list, and the caller decides using the password.
 *
 * Capped, because each candidate costs a bcrypt comparison and this endpoint is
 * public. The cap is far above any real inbox (the largest carried over is five).
 */
export const MAX_LOGIN_CANDIDATES = 10;

export async function findLoginCandidates(
  identifier: string,
  kind: "email" | "username",
): Promise<NonNullable<LoginCandidate>[]> {
  if (kind === "username") {
    const byUsername = await prisma.user.findFirst({
      where: { username: { equals: identifier, mode: "insensitive" } },
      select: userSelect,
    });
    return byUsername ? [byUsername] : [];
  }

  const email = identifier.toLowerCase();
  const at = email.indexOf("@");
  const local = at > 0 ? email.slice(0, at) : null;
  const domain = at > 0 ? email.slice(at + 1) : null;

  return prisma.user.findMany({
    where: {
      OR: [
        { email },
        // Older imports plus-addressed shared inboxes; the capper still types
        // the bare address, so those accounts have to be reachable by it.
        ...(local && domain && !local.includes("+")
          ? [{ email: { startsWith: `${local}+`, endsWith: `@${domain}` } }]
          : []),
      ],
    },
    select: userSelect,
    // Stable order so a repeated sign-in resolves the same way.
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MAX_LOGIN_CANDIDATES,
  });
}
