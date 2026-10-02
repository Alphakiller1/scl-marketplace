export function normalizeBrevoMessageId(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("<") && trimmed.endsWith(">")
    ? trimmed.slice(1, -1).trim()
    : trimmed;
}
