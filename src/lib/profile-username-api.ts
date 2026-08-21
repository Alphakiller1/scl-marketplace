/** Same-origin JSON endpoint that writes the public @handle. */
export const PROFILE_USERNAME_API_PATH = "/api/account/username";

export const PROFILE_USERNAME_ALLOWED_HOSTS = [
  "sportscappersleaderboard.com",
  "www.sportscappersleaderboard.com",
  "scl-marketplace.vercel.app",
  "localhost:3000",
] as const;

export type UsernameSaveResult =
  | { ok: true; usernameChanged: boolean; username: string }
  | { ok: false; error: string };

const FALLBACK_USERNAME_ERROR = "We couldn't save your username. Try again.";

export function isTrustedUsernameRequest(request: {
  headers: { get(name: string): string | null };
}): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = new URL(origin).host.toLowerCase();
    return (PROFILE_USERNAME_ALLOWED_HOSTS as readonly string[]).includes(host);
  } catch {
    return false;
  }
}

export function parseUsernameSavePayload(payload: unknown): UsernameSaveResult {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: FALLBACK_USERNAME_ERROR };
  }
  const record = payload as {
    ok?: unknown;
    error?: unknown;
    username?: unknown;
    usernameChanged?: unknown;
  };
  if (record.ok === true && typeof record.username === "string") {
    return {
      ok: true,
      usernameChanged: Boolean(record.usernameChanged),
      username: record.username,
    };
  }
  return {
    ok: false,
    error:
      typeof record.error === "string" && record.error.trim()
        ? record.error
        : FALLBACK_USERNAME_ERROR,
  };
}
