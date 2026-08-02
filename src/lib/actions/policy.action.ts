"use server";

import { revalidatePath } from "next/cache";

import { getDefaultPolicyDocument } from "@/lib/policy-defaults";
import {
  POLICY_METADATA,
  requiresPolicyAcceptance,
} from "@/lib/policy-metadata";
import { prisma } from "@/lib/prisma";
import {
  policyDocumentSchema,
  type PolicyDocumentInput,
} from "@/lib/schemas/policy.schema";
import { requireAdmin } from "@/lib/session";

type PolicyActionResult = { ok: true } | { ok: false; error: string };

export async function savePolicyDocumentAction(
  input: PolicyDocumentInput,
): Promise<PolicyActionResult> {
  const admin = await requireAdmin();
  const parsed = policyDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the policy document.",
    };
  }

  const next = parsed.data;
  try {
    const stored = await prisma.policyDocument.findUnique({
      where: { slug: next.slug },
      select: { title: true, body: true, version: true },
    });
    const current = stored ?? getDefaultPolicyDocument(next.slug);
    const contentChanged =
      current.title !== next.title || current.body !== next.body;

    if (
      requiresPolicyAcceptance(next.slug) &&
      contentChanged &&
      current.version === next.version
    ) {
      return {
        ok: false,
        error: `Increase the ${POLICY_METADATA[next.slug].label} version before publishing changed copy. This ensures every account is asked to accept the revision.`,
      };
    }

    if (stored && !contentChanged && current.version === next.version) {
      return { ok: true };
    }

    const publishedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.policyDocument.upsert({
        where: { slug: next.slug },
        create: {
          ...next,
          publishedAt,
          updatedById: admin.id,
        },
        update: {
          title: next.title,
          body: next.body,
          version: next.version,
          publishedAt,
          updatedById: admin.id,
        },
      });
      await tx.policyDocumentRevision.create({
        data: {
          ...next,
          editedById: admin.id,
        },
      });
    });

    revalidatePath(POLICY_METADATA[next.slug].path);
    revalidatePath("/admin/policies");
    if (requiresPolicyAcceptance(next.slug)) {
      revalidatePath("/accept-terms");
      revalidatePath("/dashboard");
    }
    return { ok: true };
  } catch (error) {
    console.error("[policies] publish failed", error);
    return {
      ok: false,
      error:
        "Policy storage is unavailable. Apply the database patch and try again.",
    };
  }
}
