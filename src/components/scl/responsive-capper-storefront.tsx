"use client";

import type { ComponentProps } from "react";

import { CapperStorefront } from "@/components/scl/capper-storefront";
import { useIsLg } from "@/lib/use-media-query";

type ResponsiveCapperStorefrontProps = ComponentProps<
  typeof CapperStorefront
> & {
  viewport: "mobile" | "desktop";
};

export function ResponsiveCapperStorefront({
  viewport,
  ...storefrontProps
}: ResponsiveCapperStorefrontProps) {
  const isLg = useIsLg();
  const shouldRender =
    isLg !== null &&
    ((viewport === "desktop" && isLg) || (viewport === "mobile" && !isLg));

  return shouldRender ? <CapperStorefront {...storefrontProps} /> : null;
}
