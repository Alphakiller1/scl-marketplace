import "server-only";

import {
  EMAIL_TEMPLATE_SLUGS,
  EMAIL_TEMPLATES,
  defaultEmailTemplate,
  isEmailTemplateSlug,
  type EmailTemplateContent,
  type EmailTemplateSlug,
} from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";

export type StoredEmailTemplate = EmailTemplateContent & {
  slug: EmailTemplateSlug;
  /** False when this is the copy bundled in the build, not an owner edit. */
  persisted: boolean;
  updatedAt: Date | null;
};

/**
 * The copy to send.
 *
 * Never throws and never returns nothing. An unreachable table, a missing row,
 * or a row for a slug the build no longer knows about all resolve to the
 * bundled default — sending a capper the previous wording is recoverable, and
 * failing their signup because an editor table is down is not.
 */
export async function getEmailTemplate(
  slug: EmailTemplateSlug,
): Promise<EmailTemplateContent> {
  try {
    const stored = await prisma.emailTemplate.findUnique({
      where: { slug },
      select: { subject: true, body: true, actionLabel: true, footnote: true },
    });
    return stored ?? defaultEmailTemplate(slug);
  } catch (error) {
    console.error(`[email-templates] storage unavailable for ${slug}`, error);
    return defaultEmailTemplate(slug);
  }
}

/** Every template, for the admin editor. Same fallback rules as above. */
export async function getEmailTemplateWorkspace(): Promise<{
  templates: StoredEmailTemplate[];
  storageReady: boolean;
}> {
  const bundled = (): StoredEmailTemplate[] =>
    EMAIL_TEMPLATE_SLUGS.map((slug) => ({
      slug,
      ...defaultEmailTemplate(slug),
      persisted: false,
      updatedAt: null,
    }));

  try {
    const rows = await prisma.emailTemplate.findMany({
      select: {
        slug: true,
        subject: true,
        body: true,
        actionLabel: true,
        footnote: true,
        updatedAt: true,
      },
    });
    const bySlug = new Map(
      rows
        .filter((row) => isEmailTemplateSlug(row.slug))
        .map((r) => [r.slug, r]),
    );

    // Driven by the registry, not the table, so the editor lists every template
    // the build can send rather than only the ones somebody has already edited.
    return {
      templates: EMAIL_TEMPLATE_SLUGS.map((slug) => {
        const row = bySlug.get(slug);
        return row
          ? {
              slug,
              subject: row.subject,
              body: row.body,
              actionLabel: row.actionLabel,
              footnote: row.footnote,
              persisted: true,
              updatedAt: row.updatedAt,
            }
          : {
              slug,
              ...defaultEmailTemplate(slug),
              persisted: false,
              updatedAt: null,
            };
      }),
      storageReady: true,
    };
  } catch (error) {
    console.error("[email-templates] admin storage unavailable", error);
    return { templates: bundled(), storageReady: false };
  }
}

export async function getEmailTemplateRevisions(slug: EmailTemplateSlug) {
  try {
    return await prisma.emailTemplateRevision.findMany({
      where: { slug },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        subject: true,
        createdAt: true,
        editedBy: { select: { username: true, email: true } },
      },
    });
  } catch {
    return [];
  }
}

export function emailTemplateLabel(slug: EmailTemplateSlug): string {
  return EMAIL_TEMPLATES[slug].label;
}
