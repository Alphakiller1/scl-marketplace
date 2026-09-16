import { redirect } from "next/navigation";

import { HONORS_DOCUMENT } from "@/lib/policy-metadata";

/** Honors copy is edited under Policy Documents. */
export default function AdminHonorsPage() {
  redirect(`/admin/policies?document=${HONORS_DOCUMENT}`);
}
