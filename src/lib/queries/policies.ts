import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { buildPolicyBundleVersion } from "@/lib/legal";
import { getDefaultPolicyDocument } from "@/lib/policy-defaults";
import {
  REQUIRED_ACCEPTANCE_POLICY_SLUGS,
  type PolicySlugKey,
} from "@/lib/policy-metadata";

const DATE_VERSION = /^\d{4}-\d{2}-\d{2}$/;

function predatesBundledPolicy(storedVersion: string, bundledVersion: string) {
  return (
    DATE_VERSION.test(storedVersion) &&
    DATE_VERSION.test(bundledVersion) &&
    storedVersion < bundledVersion
  );
}

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

    const bundled = getDefaultPolicyDocument(slug);
    return document && !predatesBundledPolicy(document.version, bundled.version)
      ? { ...document, persisted: true }
      : bundled;
  } catch (error) {
    console.error(
      `[policies] ${slug} unavailable; using bundled policy`,
      error,
    );
    return getDefaultPolicyDocument(slug);
  }
});

export const getCurrentPolicyBundle = cache(async function getPolicyBundle() {
  const documents = await Promise.all(
    REQUIRED_ACCEPTANCE_POLICY_SLUGS.map((slug) =>
      getPublicPolicyDocument(slug),
    ),
  );
  const versions = {
    termsVersion: documents[0].version,
    privacyVersion: documents[1].version,
    responsibleGamingVersion: documents[2].version,
    refundVersion: documents[3].version,
  };
  return {
    id: buildPolicyBundleVersion(versions),
    ...versions,
  };
});

/** Legacy name retained for existing profile/admin readers; now gates the complete bundle. */
export async function getCurrentTermsVersion(): Promise<string> {
  return (await getCurrentPolicyBundle()).id;
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

    const bundled = getDefaultPolicyDocument(slug);
    return {
      document:
        document && !predatesBundledPolicy(document.version, bundled.version)
          ? { ...document, persisted: true }
          : bundled,
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
