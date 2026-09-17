"use client";

import { useRouter } from "next/navigation";

import { Label } from "@/components/ui/label";
import {
  HONORS_DOCUMENT,
  POLICY_METADATA,
  POLICY_SLUGS,
} from "@/lib/policy-metadata";

export function PolicyDocumentSelect({ value }: { value: string }) {
  const router = useRouter();
  return (
    <div className="space-y-1.5">
      <Label htmlFor="policy-document">Policy document</Label>
      <select
        id="policy-document"
        value={value}
        onChange={(event) =>
          router.push(`/admin/policies?document=${event.target.value}`)
        }
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-10 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
      >
        {POLICY_SLUGS.map((slug) => (
          <option key={slug} value={slug}>
            {POLICY_METADATA[slug].label}
          </option>
        ))}
        <option value={HONORS_DOCUMENT}>SCL Honors</option>
      </select>
    </div>
  );
}
