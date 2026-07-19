import type { ComponentProps } from "react";

import { CapperStorefront } from "@/components/scl/capper-storefront";
import { cn } from "@/lib/utils";

type ResponsiveCapperStorefrontProps = ComponentProps<
  typeof CapperStorefront
> & {
  viewport: "mobile" | "desktop";
};

export function ResponsiveCapperStorefront({
  viewport,
  ...storefrontProps
}: ResponsiveCapperStorefrontProps) {
  return (
    <CapperStorefront
      {...storefrontProps}
      className={cn(
        viewport === "desktop" ? "hidden lg:block" : "lg:hidden",
        storefrontProps.className,
      )}
    />
  );
}
