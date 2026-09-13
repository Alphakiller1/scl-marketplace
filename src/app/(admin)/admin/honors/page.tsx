import { Award } from "lucide-react";
import { AdminHonorsEditor } from "@/components/scl/admin-honors-editor";
import { SectionHeader } from "@/components/scl/section";
import { Card } from "@/components/ui/card";
import { getHonorsContent } from "@/lib/queries/honors-content";

export const metadata = { title: "SCL Honors admin" };
export default async function AdminHonorsPage() {
  const content = await getHonorsContent();
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Award}
        title="SCL Honors"
        subtitle="Edit the public award rules and criteria"
      />
      <Card className="p-4 sm:p-5">
        <AdminHonorsEditor title={content.title} body={content.body} />
      </Card>
    </div>
  );
}
