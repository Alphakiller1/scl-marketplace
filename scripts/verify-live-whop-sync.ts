import assert from "node:assert/strict";

import { prisma } from "@/lib/prisma";
import {
  retrieveWhopCompany,
  retrieveWhopProduct,
  updateWhopProduct,
} from "@/lib/whop-api";
import { whopAppApiKey } from "@/lib/whop-config";
import { pushPackageToWhop, syncWhopStorefront } from "@/lib/whop-sync";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function mustUpdateWhop(input: Parameters<typeof updateWhopProduct>[0]) {
  const result = await updateWhopProduct(input);
  if (!result.ok) throw new Error(result.error);
}

export async function runLiveWhopSyncVerification(input: {
  capperEmail: string;
  companyId: string;
  productId: string;
}) {
  const capperEmail = input.capperEmail.trim().toLowerCase();
  const companyId = input.companyId.trim();
  const productId = input.productId.trim();
  const apiKey = whopAppApiKey();
  assert(apiKey, "WHOP_APP_API_KEY is required.");

  const [company, originalProduct, user, admin] = await Promise.all([
    retrieveWhopCompany(apiKey, companyId),
    retrieveWhopProduct(apiKey, productId),
    prisma.user.findFirst({
      where: { email: { equals: capperEmail, mode: "insensitive" } },
      select: {
        id: true,
        capperProfile: { select: { id: true, storefrontEnabled: true } },
      },
    }),
    prisma.user.findFirst({
      where: { role: "ADMIN", accountStatus: "ACTIVE" },
      select: { id: true },
    }),
  ]);

  assert(user?.capperProfile, `No capper profile found for ${capperEmail}.`);
  const capper = user.capperProfile;
  assert(admin, "An active SCL admin is required for audit attribution.");
  assert.equal(company.id, companyId);
  assert(company.route, "Whop company route is missing.");
  assert.equal(originalProduct.id, productId);
  assert.match(
    originalProduct.title,
    /SCL Sync Test/i,
    "Refusing to mutate a Whop product that is not explicitly named as an SCL sync test.",
  );
  assert.equal(
    originalProduct.visibility,
    "visible",
    "The live E2E product must begin visible so the final state can be restored safely.",
  );

  const conflicting = await prisma.storeConnection.findFirst({
    where: {
      provider: "WHOP",
      whopCompanyId: companyId,
      capperId: { not: capper.id },
    },
    select: { id: true },
  });
  assert(
    !conflicting,
    "This Whop business is already linked to another SCL capper.",
  );

  const connection = await prisma.storeConnection.upsert({
    where: {
      capperId_provider: {
        capperId: capper.id,
        provider: "WHOP",
      },
    },
    create: {
      capperId: capper.id,
      provider: "WHOP",
      status: "PENDING_SCL_LINK_IMPORT",
      submittedAt: new Date(),
      acknowledgmentAt: new Date(),
      whopCompanyId: company.id,
      whopCompanyRoute: company.route,
      whopConnectedAt: new Date(),
      requiresAttention: true,
    },
    update: {
      whopCompanyId: company.id,
      whopCompanyRoute: company.route,
      whopConnectedAt: new Date(),
      requiresAttention: true,
    },
    select: { id: true },
  });

  const firstSync = await syncWhopStorefront({
    storeConnectionId: connection.id,
    actorId: admin.id,
  });
  assert(firstSync.ok, firstSync.ok ? undefined : firstSync.error);

  const pkg = await prisma.package.findFirst({
    where: { storeConnectionId: connection.id, externalProductId: productId },
    select: { id: true, isActive: true },
  });
  assert(pkg, "The Whop product was not imported into SCL.");

  await prisma.$transaction(async (tx) => {
    const beforeLive = await tx.storeConnection.findUniqueOrThrow({
      where: { id: connection.id },
      select: { status: true },
    });
    const packageCount = await tx.package.count({
      where: { storeConnectionId: connection.id },
    });
    await tx.package.update({
      where: { id: pkg.id },
      data: { isActive: true },
    });
    await tx.storeConnection.update({
      where: { id: connection.id },
      data: {
        status: "LIVE",
        packageImportStatus: "LIVE",
        requiresAttention: false,
        packageCount,
        reviewedAt: new Date(),
        reviewedById: admin.id,
      },
    });
    await tx.capperProfile.update({
      where: { id: capper.id },
      data: { storefrontEnabled: true },
    });
    if (!pkg.isActive) {
      await tx.packageAuditEvent.create({
        data: {
          packageId: pkg.id,
          capperId: capper.id,
          actorId: admin.id,
          action: "ACTIVATED",
          summary: "Activated by guarded live Whop sync verification.",
        },
      });
    }
    if (beforeLive.status !== "LIVE") {
      await tx.storefrontReviewEvent.create({
        data: {
          storeConnectionId: connection.id,
          action: "MARKED_LIVE",
          previousStatus: beforeLive.status,
          newStatus: "LIVE",
          reviewedById: admin.id,
          reason:
            "Guarded live Whop sync verification passed import readiness.",
        },
      });
    }
  });

  const stamp = Date.now().toString(36);
  const inboundTitle = `${originalProduct.title} [WHOP-${stamp}]`;
  const inboundHeadline = `Whop to SCL live verification ${stamp}`;
  const outboundTitle = `${originalProduct.title} [SCL-${stamp}]`;
  const outboundHeadline = `SCL to Whop live verification ${stamp}`;

  try {
    await mustUpdateWhop({
      accessToken: apiKey,
      productId,
      update: {
        title: inboundTitle,
        headline: inboundHeadline,
        visibility: "visible",
      },
    });
    const inboundSync = await syncWhopStorefront({
      storeConnectionId: connection.id,
      actorId: admin.id,
    });
    assert(inboundSync.ok, inboundSync.ok ? undefined : inboundSync.error);
    const inboundPackage = await prisma.package.findUniqueOrThrow({
      where: { id: pkg.id },
      select: { title: true, description: true, isActive: true },
    });
    assert.equal(inboundPackage.title, inboundTitle);
    assert.equal(inboundPackage.description, inboundHeadline);
    assert.equal(inboundPackage.isActive, true);

    await mustUpdateWhop({
      accessToken: apiKey,
      productId,
      update: { visibility: "hidden" },
    });
    const hiddenSync = await syncWhopStorefront({
      storeConnectionId: connection.id,
      actorId: admin.id,
    });
    assert(hiddenSync.ok, hiddenSync.ok ? undefined : hiddenSync.error);
    const hiddenPackage = await prisma.package.findUniqueOrThrow({
      where: { id: pkg.id },
      select: { isActive: true },
    });
    assert.equal(hiddenPackage.isActive, false);

    await mustUpdateWhop({
      accessToken: apiKey,
      productId,
      update: { visibility: "visible" },
    });
    await prisma.package.update({
      where: { id: pkg.id },
      data: {
        title: outboundTitle,
        description: outboundHeadline,
        isActive: true,
      },
    });
    const outboundPush = await pushPackageToWhop(pkg.id);
    assert(outboundPush.ok, outboundPush.ok ? undefined : outboundPush.error);
    assert.equal(outboundPush.pushed, true);
    const outboundProduct = await retrieveWhopProduct(apiKey, productId);
    assert.equal(outboundProduct.title, outboundTitle);
    assert.equal(outboundProduct.headline, outboundHeadline);
    assert.equal(outboundProduct.visibility, "visible");
  } finally {
    await mustUpdateWhop({
      accessToken: apiKey,
      productId,
      update: {
        title: originalProduct.title,
        headline: originalProduct.headline ?? null,
        visibility: "visible",
      },
    });
    await prisma.package.updateMany({
      where: { storeConnectionId: connection.id, externalProductId: productId },
      data: {
        title: originalProduct.title,
        description: originalProduct.headline ?? null,
        isActive: true,
      },
    });
    await prisma.storeConnection.update({
      where: { id: connection.id },
      data: {
        status: "LIVE",
        packageImportStatus: "LIVE",
        requiresAttention: false,
      },
    });
  }

  return {
    ok: true,
    companyId,
    productId,
    whopToScl: true,
    whopHideToSclDeactivate: true,
    sclToWhop: true,
    restored: true,
  };
}

if (process.env.SCL_LIVE_WHOP_E2E === "YES") {
  runLiveWhopSyncVerification({
    capperEmail: required("SCL_CAPPER_EMAIL"),
    companyId: required("WHOP_COMPANY_ID"),
    productId: required("WHOP_PRODUCT_ID"),
  })
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
