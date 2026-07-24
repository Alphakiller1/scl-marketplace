import "server-only";

import type { PolicyDocumentSlug } from "@prisma/client";

import { DEFAULT_POLICY_BODIES, FALLBACK_POLICY_VERSION } from "@/lib/legal";
import { prisma } from "@/lib/prisma";

export type PublishedPolicyDocument = {
  slug: PolicyDocumentSlug;
  title: string;
  body: string;
  version: string;
  publishedAt: Date | null;
};

export async function getPublishedPolicyDocument(
  slug: PolicyDocumentSlug,
): Promise<PublishedPolicyDocument> {
  const release = await prisma.policyRelease.findFirst({
    orderBy: { publishedAt: "desc" },
    select: {
      version: true,
      publishedAt: true,
      documents: {
        where: { slug },
        select: { title: true, body: true },
        take: 1,
      },
    },
  });

  const doc = release?.documents[0];
  if (doc && release) {
    return {
      slug,
      title: doc.title,
      body: doc.body,
      version: release.version,
      publishedAt: release.publishedAt,
    };
  }

  const fallback = DEFAULT_POLICY_BODIES[slug];
  return {
    slug,
    title: fallback.title,
    body: fallback.body,
    version: FALLBACK_POLICY_VERSION,
    publishedAt: null,
  };
}

export async function getLatestPolicyReleaseForAdmin() {
  return prisma.policyRelease.findFirst({
    orderBy: { publishedAt: "desc" },
    include: {
      documents: { orderBy: { slug: "asc" } },
      publishedBy: {
        select: { username: true, displayName: true, email: true },
      },
    },
  });
}

export async function getPolicyReleaseHistory(limit = 12) {
  return prisma.policyRelease.findMany({
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      version: true,
      summary: true,
      requiresReacceptance: true,
      publishedAt: true,
      publishedBy: {
        select: { username: true, displayName: true },
      },
      _count: { select: { documents: true } },
    },
  });
}
