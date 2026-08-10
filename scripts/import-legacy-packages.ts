import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { PrismaClient } from "@prisma/client";

import {
  inspectLegacyPackageIntegrity,
  loadLegacyPackageIntegrityRows,
  reconcileLegacyPackageSource,
} from "../src/lib/legacy-package-integrity";
import {
  legacyPackageSlug,
  legacyPackagesImportSchema,
  type LegacyPackageInput,
} from "../src/lib/schemas/legacy-packages.schema";

// A bare `tsx` run doesn't load .env the way `prisma db seed` does.
try {
  process.loadEnvFile();
} catch {
  // No .env file present — fall back to ambient environment variables.
}

const prisma = new PrismaClient();

/**
 * Imports storefront packages carried over from the legacy SCL platform.
 * Run AFTER `db:import-legacy`, which creates the profiles they attach to.
 *
 * Every package gets a TrackingUrl: `listActiveMarketplacePackages` filters out
 * any package without one, so an offer imported without a slug would exist in
 * the database and be invisible on /packages.
 *
 * `storeConnectionId` is left null deliberately — the public predicate accepts
 * either a LIVE store connection or no connection at all, and these offers were
 * already live on the previous platform.
 */
async function importPackage(p: LegacyPackageInput) {
  const user = await prisma.user.findUnique({
    where: { username: p.username },
    select: { capperProfile: { select: { id: true, isLegacy: true } } },
  });

  const profile = user?.capperProfile;
  if (!profile) {
    throw new Error(
      "no capper profile — run `npm run db:import-legacy` first so the profile exists",
    );
  }
  if (!profile.isLegacy) {
    throw new Error(
      "profile is not flagged isLegacy — refusing to attach a carried-over offer to a native capper",
    );
  }

  const slug = legacyPackageSlug(p.username, p.legacyRef);

  // The slug is unique and deterministic, so it doubles as the identity of an
  // already-imported offer — that keeps re-runs idempotent without adding a
  // legacyRef column to Package.
  const existing = await prisma.trackingUrl.findUnique({
    where: { slug },
    select: { packageId: true },
  });

  const data = {
    title: p.title,
    description: p.description ?? null,
    priceCents: p.priceCents,
    billingPeriod: p.billingPeriod,
    checkoutUrl: p.checkoutUrl,
    affiliateProvider: p.affiliateProvider ?? null,
    providerType: "PREMIUM" as const,
    sortOrder: p.sortOrder,
    isActive: p.isActive,
  };

  if (existing) {
    await prisma.package.update({ where: { id: existing.packageId }, data });
    await prisma.trackingUrl.update({
      where: { slug },
      data: { targetUrl: p.checkoutUrl },
    });
    return { slug, created: false };
  }

  const pkg = await prisma.package.create({
    data: { capperId: profile.id, ...data },
  });
  await prisma.trackingUrl.create({
    data: { packageId: pkg.id, slug, targetUrl: p.checkoutUrl },
  });
  return { slug, created: true };
}

async function main() {
  const fileArg = process.argv[2] ?? "prisma/legacy-packages.json";
  const filePath = path.resolve(process.cwd(), fileArg);

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    console.error(`✖ Could not read import file: ${filePath}`);
    console.error(
      "  Usage: npm run db:import-legacy-packages -- path/to/legacy-packages.json",
    );
    process.exitCode = 1;
    return;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error(`✖ ${fileArg} is not valid JSON.`, err);
    process.exitCode = 1;
    return;
  }

  const parsed = legacyPackagesImportSchema.safeParse(json);
  if (!parsed.success) {
    console.error("✖ Import file failed validation:");
    console.error(JSON.stringify(parsed.error.flatten(), null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(
    `Importing ${parsed.data.length} storefront package(s) from ${fileArg}…`,
  );
  let created = 0;
  let updated = 0;
  const failures: { username: string; ref: string; error: string }[] = [];

  for (const pkg of parsed.data) {
    try {
      const res = await importPackage(pkg);
      if (res.created) created++;
      else updated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ username: pkg.username, ref: pkg.legacyRef, error: msg });
      console.error(`  ✖ @${pkg.username} (${pkg.legacyRef}): ${msg}`);
    }
  }

  console.log(
    `\nDone. ${created} created, ${updated} updated, ${failures.length} failed.`,
  );
  const rows = await loadLegacyPackageIntegrityRows(prisma);
  const integrity = inspectLegacyPackageIntegrity(rows);
  const reconciliation = reconcileLegacyPackageSource(parsed.data, rows);
  const verificationErrors = [...integrity.errors, ...reconciliation.errors];
  console.log(
    `Verified ${reconciliation.matched}/${parsed.data.length} source offers against persisted package, provider, price, cadence, checkout, tracking, order, and publication fields.`,
  );
  for (const warning of integrity.warnings) console.warn(`  ! ${warning}`);
  for (const error of verificationErrors) console.error(`  ✖ ${error}`);
  if (failures.length || verificationErrors.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
