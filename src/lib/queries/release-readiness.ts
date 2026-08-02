import "server-only";

import { prisma } from "@/lib/prisma";
import {
  evaluateReleaseConfiguration,
  releaseReadinessSummary,
  type ReleaseReadinessCheck,
} from "@/lib/release-readiness";

type CoreSchemaRow = {
  playPackage: boolean;
  parlayPackage: boolean;
  eventLabel: boolean;
};

export type CoreSchemaHealth = CoreSchemaRow & {
  database: boolean;
  ready: boolean;
};

export async function getCoreSchemaHealth(): Promise<CoreSchemaHealth> {
  try {
    const [row] = await prisma.$queryRaw<CoreSchemaRow[]>`
      SELECT
        to_regclass('"PlayPackage"') IS NOT NULL AS "playPackage",
        to_regclass('"ParlayPackage"') IS NOT NULL AS "parlayPackage",
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'Play'
            AND column_name = 'eventLabel'
        ) AS "eventLabel"
    `;
    const schema = row ?? {
      playPackage: false,
      parlayPackage: false,
      eventLabel: false,
    };
    return {
      database: true,
      ...schema,
      ready: schema.playPackage && schema.parlayPackage && schema.eventLabel,
    };
  } catch (error) {
    console.error("[release-readiness] database health check failed", error);
    return {
      database: false,
      playPackage: false,
      parlayPackage: false,
      eventLabel: false,
      ready: false,
    };
  }
}

export async function getReleaseReadinessReport() {
  const configurationChecks = evaluateReleaseConfiguration(process.env);

  try {
    const [schema, realAdmins, enabledSeedAdmins, incompletePackages] =
      await Promise.all([
        getCoreSchemaHealth(),
        prisma.user.count({
          where: {
            role: "ADMIN",
            accountStatus: "ACTIVE",
            emailVerified: { not: null },
            NOT: { email: { endsWith: "@scl.local" } },
          },
        }),
        prisma.user.count({
          where: {
            email: { endsWith: "@scl.local" },
            accountStatus: { not: "DISABLED" },
          },
        }),
        prisma.package.count({
          where: {
            isActive: true,
            OR: [{ checkoutUrl: null }, { trackingUrls: { none: {} } }],
          },
        }),
      ]);

    const dataChecks: ReleaseReadinessCheck[] = [
      {
        id: "owner-admin",
        label: "Real owner administrator",
        status: realAdmins > 0 ? "ready" : "blocked",
        detail:
          realAdmins > 0
            ? `${realAdmins} verified, active non-seed administrator${realAdmins === 1 ? "" : "s"} can access the Admin Console.`
            : "Promote at least one verified owner account with the Provision existing production owner workflow.",
      },
      {
        id: "seed-admins",
        label: "Seed account lockout",
        status: enabledSeedAdmins === 0 ? "ready" : "blocked",
        detail:
          enabledSeedAdmins === 0
            ? "No @scl.local seed account remains enabled."
            : `${enabledSeedAdmins} @scl.local seed account${enabledSeedAdmins === 1 ? " is" : "s are"} still enabled and must be disabled before launch.`,
      },
      {
        id: "release-schema",
        label: "Launch database migration",
        status: schema.ready ? "ready" : "blocked",
        detail: schema.ready
          ? "Package attribution tables and human-readable event labels are live."
          : "The production package-attribution migration has not completed yet.",
      },
      {
        id: "package-links",
        label: "Active package links",
        status: incompletePackages === 0 ? "ready" : "warning",
        detail:
          incompletePackages === 0
            ? "Every active package has a checkout URL and tracked outbound link."
            : `${incompletePackages} active package${incompletePackages === 1 ? " is" : "s are"} missing a checkout or tracking link and should be corrected in Store Setup.`,
      },
    ];

    const checks = [...dataChecks, ...configurationChecks];
    return {
      checks,
      summary: releaseReadinessSummary(checks),
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error("[release-readiness] report failed", error);
    const checks: ReleaseReadinessCheck[] = [
      {
        id: "database-audit",
        label: "Database readiness audit",
        status: "blocked",
        detail:
          "The launch audit could not read production data. Check the database connection and migration status.",
      },
      ...configurationChecks,
    ];
    return {
      checks,
      summary: releaseReadinessSummary(checks),
      generatedAt: new Date(),
    };
  }
}
