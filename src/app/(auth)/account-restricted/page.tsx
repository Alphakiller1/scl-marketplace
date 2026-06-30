import Link from "next/link";
import { ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata = { title: "Account restricted" };

export default function AccountRestrictedPage() {
  return (
    <div className="space-y-5 text-center">
      <span className="bg-neg/15 text-neg mx-auto flex size-12 items-center justify-center rounded-xl">
        <ShieldX className="size-6" />
      </span>
      <div>
        <h1 className="text-2xl font-bold">Account Access Restricted</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          This account cannot access protected SCL tools. Contact SCL support
          for a status review.
        </p>
      </div>
      <Button
        render={<Link href="/" />}
        nativeButton={false}
        variant="outline"
        className="min-h-10 w-full"
      >
        Return to SCL
      </Button>
    </div>
  );
}
