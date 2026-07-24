import { redirect } from "next/navigation";

import { AcceptTermsForm } from "./accept-terms-form";
import { getCurrentPolicyVersion } from "@/lib/legal";
import { defaultPathForRole } from "@/lib/commerce-settings";
import { requireActiveUser } from "@/lib/session";

export const metadata = { title: "Accept policies" };

export default async function AcceptTermsPage() {
  const account = await requireActiveUser();
  if (account.legalAcceptance) redirect(defaultPathForRole(account.role));
  const policyVersion = await getCurrentPolicyVersion();

  return (
    <AcceptTermsForm
      policyVersion={policyVersion}
      homePath={defaultPathForRole(account.role)}
    />
  );
}
