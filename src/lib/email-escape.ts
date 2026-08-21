/**
 * Shared so the renderer and the mailer escape identically. It lived inside
 * `email.ts`, which pulls in the Resend client — more than a pure renderer or a
 * test should have to load.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
