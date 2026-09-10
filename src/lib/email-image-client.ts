"use client";

import { resolveUploadImageMimeType } from "@/lib/schemas/upload-image";

/**
 * Getting a picture out of a browser event, whichever way the owner supplied it.
 *
 * The first version of this read only `DataTransfer.files` and returned silently
 * when it was empty, which is exactly what an owner reported as "it won't let me
 * paste". `files` is empty more often than it looks:
 *
 *   - During a **dragover** it is always empty — the browser withholds the data
 *     until the drop — so a drag has to be recognised from `items` alone.
 *   - Several sources put the bitmap only in `items` (`getAsFile()`), notably
 *     paste out of Office and some Linux/Firefox builds.
 *   - Copying a picture out of a web page, Google Docs, Canva or a mail client
 *     often puts **no file at all** on the clipboard — just `text/html` with a
 *     remote `<img src>`. Nothing local to read; the URL has to be fetched.
 *
 * So the rule is: try files, then items, then the HTML flavour — and when none of
 * them yields anything, say so out loud instead of doing nothing.
 */

/** A file the upload endpoint would accept, by MIME or by extension. */
export function looksLikeImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  // Finder and some Windows shells hand over a file with an empty MIME type;
  // the extension is all there is to go on.
  return resolveUploadImageMimeType(file) !== null;
}

/** Files carried by a drop or a paste, from either place a browser puts them. */
export function imageFilesFromTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];

  const found: File[] = [];
  for (const file of Array.from(data.files ?? [])) found.push(file);

  if (found.length === 0) {
    for (const item of Array.from(data.items ?? [])) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file) found.push(file);
    }
  }

  return found.filter(looksLikeImageFile);
}

/** Any file at all — used during a drag, where the type is often unknown. */
export function transferHasFile(data: DataTransfer | null): boolean {
  if (!data) return false;
  if ((data.files?.length ?? 0) > 0) return true;
  return Array.from(data.items ?? []).some((item) => item.kind === "file");
}

/**
 * The first remote image URL in a pasted HTML fragment.
 *
 * This is the "copied it off a web page" path. Only absolute http(s) URLs are
 * returned — a `data:` or `blob:` URL is either already covered by the file
 * paths above or is not ours to fetch.
 */
export function imageUrlFromPastedHtml(html: string): string | null {
  if (!html) return null;

  // DOMParser rather than a regex: the fragment is arbitrary third-party markup,
  // and parsing it inertly means no request is issued and no script can run.
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return null;
  }

  for (const img of Array.from(doc.querySelectorAll("img"))) {
    const src = img.getAttribute("src")?.trim();
    if (!src) continue;
    try {
      const url = new URL(src);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.toString();
      }
    } catch {
      // Relative or malformed src — nothing we could fetch on its own.
    }
  }

  return null;
}
