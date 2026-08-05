"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/app-url";
import { requireAdmin } from "@/lib/session";
import { createPasswordResetToken } from "@/lib/password-reset-tokens";
import { sendAccountClaimEmail } from "@/lib/email";
import { hasDeliverableEmail } from "@/lib/account-claim";

const claimLinkSchema = z.object({ userId: z.string().min(1) });

type ClaimLinkResult =
  | { ok: true; delivered: boolean; email: string; link?: string }
  | { ok: false; error: string };

/**
 * Issue a single-use link that lets a capper set their first password.
 *
 * Cappers imported from the previous platform without a real email address
 * (`username@legacy.scl`) can never receive a self-serve reset, so the link is
 * handed back to the admin to pass on out-of-band. When the address is real the
 * link is emailed and only the delivery status comes back.
 */
export async function issueAccountClaimLinkAction(input: {
  userId: string;
}): Promise<ClaimLinkResult> {
  await requireAdmin();

  const parsed = claimLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Select a capper account." };

  const target = await prisma.user.findFirst({
    where: { id: parsed.data.userId, role: "CAPPER" },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      accountStatus: true,
    },
  });
  if (!target) return { ok: false, error: "Capper account not found." };
  if (target.accountStatus === "DISABLED") {
    return {
      ok: false,
      error: "Reactivate this account before issuing a claim link.",
    };
  }

  let token: string | null = null;
  try {
    token = await createPasswordResetToken(target.id);
  } catch (error) {
    console.error("[account-claim] token creation failed:", error);
    return { ok: false, error: "Couldn't issue a claim link. Try again." };
  }
  if (!token) {
    return {
      ok: false,
      error:
        "A link was just issued for this account. Wait a minute, then retry.",
    };
  }

  // A placeholder address has no inbox behind it — don't attempt a send that can
  // only bounce (and hurt sender reputation); surface the link for the admin to
  // deliver by hand instead.
  if (!hasDeliverableEmail(target.email)) {
    return {
      ok: true,
      delivered: false,
      email: target.email,
      link: `${appUrl()}/reset-password?token=${token}`,
    };
  }

  const delivery = await sendAccountClaimEmail(target.email, token);
  return {
    ok: true,
    delivered: delivery.delivered,
    email: target.email,
    // Same self-healing fallback as signup: hand the link over when delivery
    // failed (no sender domain yet), and stop once real email is configured.
    link: delivery.delivered ? undefined : delivery.link,
  };
}
