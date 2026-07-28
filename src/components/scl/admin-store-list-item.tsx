/* eslint-disable @typescript-eslint/no-unsafe-assignment */
"use client";

import React from "react";
import Link from "next/link";
import { Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StoreStatusChip } from "@/components/scl/store-status-chip";

export function AdminStoreListItem({ row }: { row: any }) {
  const handle = row.capper.user.username;
  const name =
    row.capper.user.displayName?.trim() ||
    (handle ? `@${handle.replace(/^@/, "")}` : row.capper.user.email);

  const requiresAttention = row.requiresAttention;

  return (
    <article
      className={`bg-card grid gap-3 p-4 lg:grid-cols-[1.2fr_6rem_1fr_7rem_1fr_auto] lg:items-center ${
        requiresAttention ? "ring-2 ring-amber-400/30" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="truncate font-semibold">{name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {row.capper.user.email}
        </p>
      </div>

      <div>
        <span className="inline-block">
          <span className="sr-only">Provider</span>
          <span className="text-xs">{row.provider}</span>
        </span>
      </div>

      <div>
        <StoreStatusChip status={row.status} />
      </div>

      <div>
        <p className="text-muted-foreground text-xs tabular-nums">
          {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "—"}
        </p>
      </div>

      <div className="text-xs text-muted-foreground">
        <div>{row.packageCount ?? row._count?.packages ?? 0} packages</div>
        {row.affiliatePercent ? (
          <div>{Number(row.affiliatePercent).toFixed(0)}% affiliate</div>
        ) : null}
      </div>

      <div>
        <Button
          size="sm"
          variant="secondary"
          className="min-h-10"
          render={<Link href={`/admin/store-setup?id=${row.id}`} />}
          nativeButton={false}
        >
          Open
        </Button>
      </div>
    </article>
  );
}
