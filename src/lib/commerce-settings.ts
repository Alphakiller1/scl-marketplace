import type { Role } from "@prisma/client";

export function defaultPathForRole(role: Role | undefined | null): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "CUSTOMER":
      return "/account";
    default:
      return "/dashboard";
  }
}

export function resolveAffiliatePercent(input: {
  packagePercent?: number | null;
  capperPercent?: number | null;
  platformPercent?: number | null;
}): number {
  return (
    input.packagePercent ?? input.capperPercent ?? input.platformPercent ?? 20
  );
}

export function calcAffiliateCents(
  grossCents: number,
  percent: number,
): number {
  return Math.round(grossCents * (percent / 100));
}
