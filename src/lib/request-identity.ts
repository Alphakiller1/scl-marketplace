import "server-only";

import { headers } from "next/headers";

export async function getRequestIdentity(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const direct = requestHeaders.get("x-real-ip")?.trim();
  return (forwarded || direct || "unknown").slice(0, 128);
}
