"use server";

import { revalidatePath } from "next/cache";

import {
  applyStorefrontHealthFlags,
  scanStorefrontHealth,
} from "@/lib/storefront-health";
import { requireAdmin } from "@/lib/session";

type ActionResult =
  | { ok: true; flagged: number; updated: number }
  | { ok: false; error: string };

export async function runStorefrontHealthCheckAction(): Promise<ActionResult> {
  const admin = await requireAdmin();
  const issues = await scanStorefrontHealth();
  const updated = await applyStorefrontHealthFlags(issues, admin.id);

  revalidatePath("/admin/storefronts");
  revalidatePath("/admin/analytics");
  revalidatePath("/admin/cappers");

  return { ok: true, flagged: issues.length, updated };
}

export async function previewStorefrontHealthAction() {
  await requireAdmin();
  return scanStorefrontHealth();
}
