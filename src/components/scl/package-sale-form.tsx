"use client";

import { useState } from "react";
import type { SaleSource, SaleStatus } from "@prisma/client";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordPackageSaleAction } from "@/lib/actions/admin-sales.action";
import {
  SALE_SOURCE_LABEL,
  SALE_STATUS_LABEL,
} from "@/lib/schemas/admin-commerce-phase-c.schema";

type PackageOption = {
  id: string;
  title: string;
  priceCents: number;
  capper: { user: { username: string | null } };
};

export function PackageSaleForm({ packages }: { packages: PackageOption[] }) {
  const router = useRouter();
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [source, setSource] = useState<SaleSource>("MANUAL");
  const [status, setStatus] = useState<SaleStatus>("REPORTED");
  const [grossDollars, setGrossDollars] = useState("");
  const [externalOrderId, setExternalOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  async function save() {
    if (!packageId) {
      toast.error("Select a package first.");
      return;
    }
    setPending(true);
    const result = await recordPackageSaleAction({
      packageId,
      source,
      status,
      grossCents: Math.round(Number(grossDollars || "0") * 100),
      externalOrderId,
      notes,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Sale recorded");
    setGrossDollars("");
    setExternalOrderId("");
    setNotes("");
    router.refresh();
  }

  return (
    <div className="border-border bg-card space-y-4 rounded-xl border p-4">
      <div>
        <h3 className="font-semibold">Record sale</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Manual reconciliation for Winible, Whop, or future SCL native
          checkout.
        </p>
      </div>
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground font-medium">Package</span>
        <select
          value={packageId}
          onChange={(event) => setPackageId(event.target.value)}
          className="border-input bg-background min-h-10 rounded-lg border px-2.5 text-sm"
        >
          {packages.map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.title}
              {pkg.capper.user.username
                ? ` · @${pkg.capper.user.username.replace(/^@/, "")}`
                : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground font-medium">Source</span>
          <select
            value={source}
            onChange={(event) => setSource(event.target.value as SaleSource)}
            className="border-input bg-background min-h-10 rounded-lg border px-2.5 text-sm"
          >
            {Object.entries(SALE_SOURCE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground font-medium">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as SaleStatus)}
            className="border-input bg-background min-h-10 rounded-lg border px-2.5 text-sm"
          >
            {Object.entries(SALE_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground font-medium">
          Gross sale (USD)
        </span>
        <Input
          inputMode="decimal"
          value={grossDollars}
          onChange={(event) => setGrossDollars(event.target.value)}
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground font-medium">
          External order ID
        </span>
        <Input
          value={externalOrderId}
          onChange={(event) => setExternalOrderId(event.target.value)}
          placeholder="Winible/Whop order reference"
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground font-medium">Notes</span>
        <Input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      <Button type="button" disabled={pending} onClick={() => void save()}>
        <Save className="size-4" />
        Record sale
      </Button>
    </div>
  );
}
