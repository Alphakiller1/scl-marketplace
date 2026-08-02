import { redirect } from "next/navigation";

import { AcceptTermsForm } from "./accept-terms-form";
import { requireActiveUser } from "@/lib/session";

export const metadata = { title: "Accept policies" };

export default async function AcceptTermsPage() {
  const account = await requireActiveUser();
  if (account.legalAcceptance) redirect("/dashboard");

  return <AcceptTermsForm policyBundle={account.currentPolicyBundle} />;
}
