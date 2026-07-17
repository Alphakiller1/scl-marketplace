import assert from "node:assert/strict";

import { prisma } from "@/lib/prisma";
import { getLivePackagesForCapper } from "@/lib/queries/store";
import { GET as trackingRedirect } from "@/app/go/[slug]/route";

const SMOKE_SLUG = "m3-smoke-whop";
const SMOKE_TITLE = "M3 Smoke Package";

async function main() {
  const capper = await prisma.capperProfile.findFirst({
    where: { user: { username: "capper" } },
    select: { id: true },
  });
  assert(capper, "Seeded capper profile is required");

  await prisma.clickEvent.deleteMany({
    where: { trackingUrl: { slug: SMOKE_SLUG } },
  });
  await prisma.trackingUrl.deleteMany({ where: { slug: SMOKE_SLUG } });
  await prisma.package.deleteMany({
    where: { capperId: capper.id, title: SMOKE_TITLE },
  });
  await prisma.storeConnection.deleteMany({
    where: { capperId: capper.id, provider: { in: ["WINIBLE", "WHOP"] } },
  });

  const winible = await prisma.storeConnection.create({
    data: {
      capperId: capper.id,
      provider: "WINIBLE",
      status: "PENDING_SCL_ACCEPTANCE",
      submittedAt: new Date(),
      acknowledgmentAt: new Date(),
    },
  });
  assert.equal(winible.status, "PENDING_SCL_ACCEPTANCE");

  const whop = await prisma.storeConnection.create({
    data: {
      capperId: capper.id,
      provider: "WHOP",
      status: "PENDING_SCL_LINK_IMPORT",
      submittedAt: new Date(),
      acknowledgmentAt: new Date(),
    },
  });
  assert.equal(whop.status, "PENDING_SCL_LINK_IMPORT");

  await prisma.storeConnection.update({
    where: { id: whop.id },
    data: {
      status: "LINKS_RECEIVED",
      packageImportStatus: "LINKS_RECEIVED",
    },
  });

  const pkg = await prisma.package.create({
    data: {
      capperId: capper.id,
      storeConnectionId: whop.id,
      affiliateProvider: "WHOP",
      title: SMOKE_TITLE,
      description: "Product-specific Whop affiliate package.",
      checkoutUrl: "https://example.com/whop/m3-smoke",
      priceCents: 7900,
      billingPeriod: "MONTH",
      providerType: "PREMIUM",
      isActive: true,
      trackingUrls: {
        create: {
          slug: SMOKE_SLUG,
          targetUrl: "https://example.com/whop/m3-smoke",
        },
      },
    },
  });

  await prisma.storeConnection.update({
    where: { id: whop.id },
    data: { status: "LIVE", packageImportStatus: "LIVE" },
  });

  const publicPackages = await getLivePackagesForCapper(capper.id);
  const publicPackage = publicPackages.find((item) => item.id === pkg.id);
  assert(publicPackage, "Published package must appear on the public profile");
  assert.equal(publicPackage.provider, "WHOP");
  assert.equal(publicPackage.trackingPath, `/go/${SMOKE_SLUG}`);

  const beforeClicks = await prisma.clickEvent.count({
    where: { trackingUrl: { slug: SMOKE_SLUG } },
  });
  const response = await trackingRedirect(
    new Request(`http://localhost:3000/go/${SMOKE_SLUG}`, {
      headers: {
        referer: "http://localhost:3000/cappers/capper",
        "user-agent": "SCL-M3-Smoke",
      },
    }),
    { params: Promise.resolve({ slug: SMOKE_SLUG }) },
  );
  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get("location"),
    "https://example.com/whop/m3-smoke",
  );

  const afterClicks = await prisma.clickEvent.count({
    where: { trackingUrl: { slug: SMOKE_SLUG } },
  });
  assert.equal(afterClicks, beforeClicks + 1);

  console.log(
    "M3 smoke passed: Winible pending, Whop pending/import/live, public package, click log, redirect.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
