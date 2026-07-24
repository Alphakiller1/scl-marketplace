import { requireCustomerAccess } from "@/lib/session";
import { AppHeader } from "@/components/app-header";

const CUSTOMER_NAV = [{ href: "/account", label: "My Account" }];

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCustomerAccess();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader area="Customer" nav={CUSTOMER_NAV} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
