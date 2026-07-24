"use server";

import { revalidatePath } from "next/cache";

import { invalidatePolicyVersionCache } from "@/lib/legal";
import { prisma } from "@/lib/prisma";
import {
  publishPolicyReleaseSchema,
  type PublishPolicyReleaseInput,
} from "@/lib/schemas/admin-policy.schema";
import { requireAdmin } from "@/lib/session";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function publishPolicyReleaseAction(
  input: PublishPolicyReleaseInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = publishPolicyReleaseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the policy fields.",
    };
  }

  const versionTaken = await prisma.policyRelease.findUnique({
    where: { version: parsed.data.version },
    select: { id: true },
  });
  if (versionTaken) {
    return {
      ok: false,
      error: "That policy version label is already published.",
    };
  }

  await prisma.policyRelease.create({
    data: {
      version: parsed.data.version,
      summary: parsed.data.summary?.trim() || null,
      requiresReacceptance: parsed.data.requiresReacceptance,
      publishedById: admin.id,
      documents: {
        create: parsed.data.documents.map((doc) => ({
          slug: doc.slug,
          title: doc.title,
          body: doc.body,
        })),
      },
    },
  });

  invalidatePolicyVersionCache();
  revalidatePath("/admin/policies");
  revalidatePath("/terms");
  revalidatePath("/privacy");
  revalidatePath("/responsible-gaming");
  revalidatePath("/disclaimer");
  revalidatePath("/accept-terms");
  return { ok: true };
}
