import { CapperRouteSkeleton } from "@/components/scl/capper-route-skeleton";

/**
 * Capper route fallback — paints instantly on dashboard nav clicks so the UI
 * does not feel frozen while layout auth + page RSC resolve.
 */
export default function CapperLoading() {
  return <CapperRouteSkeleton />;
}
