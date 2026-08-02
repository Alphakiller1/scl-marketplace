const AUTOMATED_USER_AGENT =
  /\b(bot|crawler|spider|curl|wget|python-requests|httpclient|headless)\b/i;

/**
 * Only treat a user-activated document navigation as a marketplace click.
 * The redirect remains public; this guard protects the analytics row only.
 */
export function shouldRecordPackageClick(headers: Headers) {
  const purpose = `${headers.get("purpose") ?? ""} ${
    headers.get("sec-purpose") ?? ""
  }`.toLowerCase();
  if (
    purpose.includes("prefetch") ||
    headers.get("next-router-prefetch") === "1"
  ) {
    return false;
  }

  const userAgent = headers.get("user-agent")?.trim() ?? "";
  if (!userAgent || AUTOMATED_USER_AGENT.test(userAgent)) return false;

  const mode = headers.get("sec-fetch-mode");
  const destination = headers.get("sec-fetch-dest");
  const userActivation = headers.get("sec-fetch-user");

  if (mode && mode !== "navigate") return false;
  if (destination && destination !== "document") return false;
  if (userActivation && userActivation !== "?1") return false;

  const hasFetchMetadata = Boolean(mode || destination || userActivation);
  if (hasFetchMetadata) {
    return (
      mode === "navigate" &&
      destination === "document" &&
      userActivation === "?1"
    );
  }

  // Conservative compatibility path for older browsers without Fetch
  // Metadata headers. Command-line and automation clients were rejected above.
  return /\bMozilla\/5\.0\b/i.test(userAgent);
}
