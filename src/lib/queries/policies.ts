import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { getDefaultPolicyDocument } from "@/lib/policy-defaults";
import type { PolicySlugKey } from "@/lib/policy-metadata";

export const getPublicPolicyDocument = cache(async function getPolicyDocument(
  slug: PolicySlugKey,
) {
  try {
    const document = await prisma.policyDocument.findUnique({
      where: { slug },
      select: {
        slug: true,
        title: true,
        body: true,
        version: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    return document
      ? { ...document, persisted: true }
      : getDefaultPolicyDocument(slug);
  } catch (error) {
    console.error(
      `[policies] ${slug} unavailable; using bundled policy`,
      error,
    );
    return getDefaultPolicyDocument(slug);
  }
});

export async function getCurrentTermsVersion(): Promise<string> {
  return (await getPublicPolicyDocument("TERMS")).version;
}

export async function getAdminPolicyWorkspace(slug: PolicySlugKey) {
  try {
    const [document, revisions] = await Promise.all([
      prisma.policyDocument.findUnique({
        where: { slug },
        select: {
          slug: true,
          title: true,
          body: true,
          version: true,
          publishedAt: true,
          updatedAt: true,
          updatedBy: {
            select: { username: true, displayName: true },
          },
        },
      }),
      prisma.policyDocumentRevision.findMany({
        where: { slug },
        select: {
          id: true,
          title: true,
          version: true,
          createdAt: true,
          editedBy: {
            select: { username: true, displayName: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return {
      document: document
        ? { ...document, persisted: true }
        : getDefaultPolicyDocument(slug),
      revisions,
      storageReady: true,
    };
  } catch (error) {
    console.error("[policies] admin policy storage unavailable", error);
    return {
      document: getDefaultPolicyDocument(slug),
      revisions: [],
      storageReady: false,
    };
  }
}
