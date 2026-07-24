import { Mail } from "lucide-react";

import { BulkCapperEmailForm } from "@/components/scl/bulk-capper-email-form";
import { BulkCustomerEmailForm } from "@/components/scl/bulk-customer-email-form";
import { SectionHeader } from "@/components/scl/section";
import { BULK_EMAIL_AUDIENCE_LABEL } from "@/lib/schemas/admin-communications.schema";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Communications" };

export default async function AdminCommunicationsPage() {
  const campaigns = await prisma.bulkEmailCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      subject: true,
      audience: true,
      recipientKind: true,
      recipientCount: true,
      deliveredCount: true,
      failedCount: true,
      createdAt: true,
      sentBy: { select: { username: true, displayName: true } },
    },
  });

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={Mail}
        title="Communications"
        subtitle="Bulk email to capper and customer audiences via Resend"
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <BulkCapperEmailForm />
        <BulkCustomerEmailForm />
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase">Recent campaigns</h2>
        {campaigns.length ? (
          <div className="border-border divide-border divide-y overflow-hidden rounded-xl border">
            {campaigns.map((campaign) => (
              <article key={campaign.id} className="bg-card p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{campaign.subject}</p>
                  <span className="text-muted-foreground text-xs">
                    {campaign.createdAt.toLocaleString()}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1">
                  {campaign.recipientKind.toLowerCase()} ·{" "}
                  {BULK_EMAIL_AUDIENCE_LABEL[campaign.audience]} ·{" "}
                  {campaign.recipientCount} recipients ·{" "}
                  {campaign.deliveredCount} delivered · {campaign.failedCount}{" "}
                  failed
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No broadcasts sent yet.
          </p>
        )}
      </section>
    </div>
  );
}
