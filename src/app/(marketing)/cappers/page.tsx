import { redirect } from "next/navigation";

/**
 * Legacy /cappers directory → Discover.
 * Profile routes under /cappers/[handle] are unchanged.
 * Also covered by next.config redirects for hard navigations.
 */
export default async function CappersDirectoryRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else {
      qs.set(key, value);
    }
  }
  const suffix = qs.toString();
  redirect(suffix ? `/discover?${suffix}` : "/discover");
}
