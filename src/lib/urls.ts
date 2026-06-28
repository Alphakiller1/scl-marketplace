export function safeHttpUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function socialProfileUrl(
  origin: "https://x.com" | "https://instagram.com",
  handle: string,
) {
  const normalized = handle.trim().replace(/^@/, "");
  return `${origin}/${encodeURIComponent(normalized)}`;
}
