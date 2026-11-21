import { NextResponse } from "next/server";

import { emailVerificationEnforced } from "@/lib/email-verification-policy";
import { getAdminSiteTraffic } from "@/lib/queries/site-traffic";
import { getCurrentAccount } from "@/lib/session";

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) return new NextResponse(null, { status: 401 });
  if (
    account.role !== "ADMIN" ||
    account.accountStatus !== "ACTIVE" ||
    !account.legalAcceptance ||
    (emailVerificationEnforced() && !account.emailVerified)
  ) {
    return new NextResponse(null, { status: 403 });
  }
  const report = await getAdminSiteTraffic();
  return NextResponse.json(report, {
    status: report ? 200 : 503,
    headers: { "Cache-Control": "private, no-store" },
  });
}
