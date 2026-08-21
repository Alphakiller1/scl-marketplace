"use server";

import { revalidatePath } from "next/cache";

import { defaultEmailTemplate } from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";
import {
  emailTemplateSchema,
  type EmailTemplateInput,
} from "@/lib/schemas/email-template.schema";
import { requireAdmin } from "@/lib/session";
import { sendTemplatePreviewEmail } from "@/lib/email";

type EmailTemplateResult = { ok: true } | { ok: false; error: string };

export async function saveEmailTemplateAction(
  input: EmailTemplateInput,
): Promise<EmailTemplateResult> {
  const admin = await requireAdmin();
  const parsed = emailTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the template.",
    };
  }

  const next = parsed.data;
  try {
    const stored = await prisma.emailTemplate.findUnique({
      where: { slug: next.slug },
      select: { subject: true, body: true, actionLabel: true, footnote: true },
    });
    const current = stored ?? defaultEmailTemplate(next.slug);
    const unchanged =
      current.subject === next.subject &&
      current.body === next.body &&
      current.actionLabel === next.actionLabel &&
      current.footnote === next.footnote;
    // A no-op save should not manufacture a revision, but it must still create
    // the row the first time so "Edited" is honest about what is being sent.
    if (stored && unchanged) return { ok: true };

    await prisma.$transaction(async (tx) => {
      await tx.emailTemplate.upsert({
        where: { slug: next.slug },
        create: { ...next, updatedById: admin.id },
        update: {
          subject: next.subject,
          body: next.body,
          actionLabel: next.actionLabel,
          footnote: next.footnote,
          updatedById: admin.id,
        },
      });
      await tx.emailTemplateRevision.create({
        data: { ...next, editedById: admin.id },
      });
    });

    revalidatePath("/admin/emails");
    return { ok: true };
  } catch (error) {
    console.error("[email-templates] save failed", error);
    return {
      ok: false,
      error:
        "Could not save the template. The email table may not be set up yet — cappers still receive the built-in copy.",
    };
  }
}

/**
 * Send the draft to the admin editing it.
 *
 * Deliberately sends what is on screen rather than what is saved: the point is
 * to read the wording in a real inbox before committing it. The link in the
 * button is a harmless placeholder, since no token exists for a preview.
 */
export async function sendEmailTemplatePreviewAction(
  input: EmailTemplateInput,
): Promise<EmailTemplateResult> {
  const admin = await requireAdmin();
  const parsed = emailTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the template.",
    };
  }

  // An admin without an address on file has nowhere to preview to; say so
  // rather than letting the mailer fail with something less specific.
  if (!admin.email) {
    return { ok: false, error: "Your admin account has no email address." };
  }

  const result = await sendTemplatePreviewEmail({
    to: admin.email,
    template: parsed.data,
    slug: parsed.data.slug,
  });

  return result.delivered
    ? { ok: true }
    : {
        ok: false,
        error:
          "Could not send the preview. Check that email delivery is configured.",
      };
}
