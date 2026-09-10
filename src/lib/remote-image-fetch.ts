/**
 * Fetch a picture the owner pasted as a link rather than as a file.
 *
 * Copying an image out of a web page, Google Docs or Canva usually puts no file
 * on the clipboard at all — only `text/html` carrying a remote `<img src>`. To
 * make that paste work, the server has to go and get it, which means this module
 * takes a URL chosen by a user and asks our own network to open it. That is the
 * shape of an SSRF, so the guards below are the point of the file, not garnish:
 *
 *   - http(s) only, so `file:`, `gopher:` and friends are out.
 *   - Every hop is checked, not just the first — a public URL is free to redirect
 *     to `127.0.0.1`, so redirects are followed by hand and re-validated.
 *   - Hostnames are resolved and every returned address must be public, which
 *     closes the "public name, private A record" trick.
 *   - The response must look like an image and must stop at a size cap, so this
 *     cannot be used to pull an unbounded body into the function.
 *
 * It is also admin-only at the call site. None of that makes it free, so it stays
 * narrow: one image, small cap, few redirects.
 */

import { lookup } from "node:dns/promises";

export const REMOTE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

export type RemoteImageResult =
  | { ok: true; data: Buffer; contentType: string | null; fileName: string }
  | { ok: false; error: string };

/**
 * Is this *IP literal* one we must never ask our own network to open?
 *
 * Answers only for literals: a hostname is not its business and returns false,
 * because `hostIsPublic` resolves those and re-checks every address DNS returns.
 * Pure and exported so the ranges are unit-tested rather than trusted — this is
 * the check that decides whether a redirect to `169.254.169.254` goes through.
 */
export function isBlockedAddress(address: string): boolean {
  const value = address.trim().toLowerCase();
  if (!value) return true;

  // IPv4-mapped IPv6 (`::ffff:127.0.0.1`) is the same host by another spelling.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  const target = mapped?.[1] ?? value;

  if (/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
    const parts = target.split(".").map(Number);
    if (
      parts.length !== 4 ||
      parts.some((n) => !Number.isInteger(n) || n > 255)
    ) {
      return true;
    }
    const [a = 0, b = 0] = parts;
    if (a === 0) return true; // "this network"
    if (a === 10) return true; // private
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  // IPv6
  if (target === "::1" || target === "::") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(target)) return true; // unique local fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(target)) return true; // link-local fe80::/10
  if (/^ff[0-9a-f]{2}:/.test(target)) return true; // multicast

  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".internal") || host.endsWith(".local")) return true;
  return false;
}

/** Resolve the name and refuse if any address it answers with is private. */
async function hostIsPublic(hostname: string): Promise<boolean> {
  if (isBlockedHostname(hostname)) return false;
  // A bare IP in the URL never reaches DNS, so check it directly too.
  if (isBlockedAddress(hostname.replace(/^\[|\]$/g, ""))) return false;

  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) return false;
    return addresses.every((entry) => !isBlockedAddress(entry.address));
  } catch {
    return false;
  }
}

function fileNameFromUrl(url: URL): string {
  const last = url.pathname.split("/").filter(Boolean).pop();
  return last && last.length <= 120 ? decodeURIComponent(last) : "pasted-image";
}

/** Read the body with a hard ceiling, so a huge file cannot be streamed in. */
async function readCapped(response: Response): Promise<Buffer | null> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > REMOTE_IMAGE_MAX_BYTES)
    return null;

  const reader = response.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > REMOTE_IMAGE_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function fetchRemoteImage(
  rawUrl: string,
): Promise<RemoteImageResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: "That link isn't a valid URL." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return {
          ok: false,
          error: "Only http and https links can be fetched.",
        };
      }
      if (!(await hostIsPublic(url.hostname))) {
        return {
          ok: false,
          error: "That link doesn't point at a public host.",
        };
      }

      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        cache: "no-store",
        headers: { accept: "image/*" },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          return { ok: false, error: "That link redirected nowhere." };
        }
        // Re-validated at the top of the next turn of the loop — the whole point
        // of following redirects by hand.
        url = new URL(location, url);
        continue;
      }

      if (!response.ok) {
        return {
          ok: false,
          error: `That image couldn't be fetched (${response.status}). Save it and drag it in instead.`,
        };
      }

      const contentType = response.headers.get("content-type");
      if (contentType && !contentType.toLowerCase().startsWith("image/")) {
        return { ok: false, error: "That link isn't an image." };
      }

      const data = await readCapped(response);
      if (!data || data.length === 0) {
        return {
          ok: false,
          error:
            "That image is too large to bring in. Save it and drag it in instead.",
        };
      }

      return { ok: true, data, contentType, fileName: fileNameFromUrl(url) };
    }

    return { ok: false, error: "That link redirected too many times." };
  } catch (error) {
    console.error("[email-image] remote fetch failed:", error);
    return {
      ok: false,
      error: "That image couldn't be fetched. Save it and drag it in instead.",
    };
  } finally {
    clearTimeout(timer);
  }
}
