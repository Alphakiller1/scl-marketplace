import { redirect } from "next/navigation";

import { AcceptTermsForm } from "./accept-terms-form";
import { requireActiveUser } from "@/lib/session";
import { getDefaultWorkspace, getSafeCallbackPath } from "@/lib/auth-routing";

export const metadata = { title: "Accept policies" };

export default async function AcceptTermsPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const [account, { callbackUrl }] = await Promise.all([
    requireActiveUser(),
    searchParams,
  ]);

  // Send people back where the gate caught them, and admins to the Admin
  // Console rather than a dashboard they were never headed for. A callback
  // pointing back here would redirect this page to itself once accepted.
  const requested = getSafeCallbackPath(callbackUrl);
  const destination =
    requested && !requested.startsWith("/accept-terms")
      ? requested
      : getDefaultWorkspace(account.role).href;

  if (account.legalAcceptance) redirect(destination);

  return (
    <AcceptTermsForm
      policyBundle={account.currentPolicyBundle}
      destination={destination}
    />
  );
}
