import { AdminRouteSkeleton } from "@/components/scl/admin-route-skeleton";

/** Admin route fallback — instant click feedback while gated RSC resolves. */
export default function AdminLoading() {
  return <AdminRouteSkeleton />;
}
