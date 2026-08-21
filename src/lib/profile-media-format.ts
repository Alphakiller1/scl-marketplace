/** Shared HEIC/HEIF detection for profile media uploads. */

const HEIC_FTYP_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "mif1",
  "msf1",
  "avif", // some containers share the ftyp box shape
]);

export function isHeicFileName(name: string): boolean {
  const extension = name.split(".").pop()?.toLowerCase();
  return extension === "heic" || extension === "heif";
}

export function isHeicMimeType(type: string): boolean {
  const normalized = type.trim().toLowerCase();
  return normalized === "image/heic" || normalized === "image/heif";
}

export function isHeicUpload(name: string, type: string): boolean {
  return isHeicFileName(name) || isHeicMimeType(type);
}

/** ISO-BMFF `ftyp` box — Mac Photos / iPhone camera roll default. */
export function isHeicBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = buffer.toString("ascii", 8, 12).toLowerCase();
  return HEIC_FTYP_BRANDS.has(brand);
}
