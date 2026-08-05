import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * Verification of credentials carried over from the previous platform.
 *
 * Cappers migrating to SCL sign in with the email and password they already
 * had, so their old hash has to be checkable here — in whatever format the old
 * PHP stack wrote it. A matched legacy password is re-hashed with bcrypt at
 * login (see `src/auth.ts`), so each account passes through this path once and
 * the imported hash is discarded.
 *
 * Formats are detected from the stored hash. `PLAINTEXT` is never detected —
 * an unsalted-looking string is far more likely to be a digest — so an import
 * carrying bare passwords has to say so explicitly.
 */
export const LEGACY_PASSWORD_FORMATS = [
  "BCRYPT",
  "PHPASS",
  "MD5",
  "SHA1",
  "SHA256",
  "PLAINTEXT",
] as const;

export type LegacyPasswordFormat = (typeof LEGACY_PASSWORD_FORMATS)[number];

const HEX_DIGEST_FORMATS: Record<number, LegacyPasswordFormat> = {
  32: "MD5",
  40: "SHA1",
  64: "SHA256",
};

const DIGEST_ALGORITHMS: Partial<Record<LegacyPasswordFormat, string>> = {
  MD5: "md5",
  SHA1: "sha1",
  SHA256: "sha256",
};

/** Best-effort format detection from the shape of the stored hash. */
export function detectLegacyPasswordFormat(
  hash: string,
): LegacyPasswordFormat | null {
  const value = hash.trim();
  if (!value) return null;
  if (/^\$2[aby]?\$\d{2}\$.{53}$/.test(value)) return "BCRYPT";
  // WordPress / phpBB portable hashes: $P$ or $H$, 8-char salt, 22-char checksum.
  if (/^\$[PH]\$.{31}$/.test(value)) return "PHPASS";
  if (/^[0-9a-f]+$/i.test(value)) {
    return HEX_DIGEST_FORMATS[value.length] ?? null;
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // Compare a fixed-width digest of each side so a length mismatch can't throw
  // and can't be distinguished by timing.
  return timingSafeEqual(
    createHash("sha256").update(left).digest(),
    createHash("sha256").update(right).digest(),
  );
}

const ITOA64 =
  "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** phpass's non-standard base64 alphabet and bit order. */
function encode64(input: Buffer, count: number): string {
  let output = "";
  let i = 0;
  do {
    let value: number = input[i++];
    output += ITOA64[value & 0x3f];
    if (i < count) value |= input[i] << 8;
    output += ITOA64[(value >> 6) & 0x3f];
    if (i++ >= count) break;
    if (i < count) value |= input[i] << 16;
    output += ITOA64[(value >> 12) & 0x3f];
    if (i++ >= count) break;
    output += ITOA64[(value >> 18) & 0x3f];
  } while (i < count);
  return output;
}

/**
 * phpass "portable" MD5 hashing — the scheme behind WordPress `$P$` and phpBB3
 * `$H$` hashes. Iteration count is encoded in the 4th character.
 */
export function phpassCrypt(password: string, setting: string): string | null {
  const id = setting.slice(0, 3);
  if (id !== "$P$" && id !== "$H$") return null;

  const countLog2 = ITOA64.indexOf(setting[3] ?? "");
  if (countLog2 < 7 || countLog2 > 30) return null;

  const salt = setting.slice(4, 12);
  if (salt.length !== 8) return null;

  const secret = Buffer.from(password, "binary");
  let hash = createHash("md5")
    .update(Buffer.concat([Buffer.from(salt, "binary"), secret]))
    .digest();
  for (let count = 1 << countLog2; count > 0; count--) {
    hash = createHash("md5")
      .update(Buffer.concat([hash, secret]))
      .digest();
  }

  return setting.slice(0, 12) + encode64(hash, 16);
}

/**
 * Check a plaintext password against a hash imported from the previous platform.
 * Unknown or unparseable formats fail closed — never treat an uncheckable hash
 * as a match.
 */
export async function verifyLegacyPassword(
  password: string,
  storedHash: string | null | undefined,
  format?: string | null,
): Promise<boolean> {
  if (!password || !storedHash) return false;
  const hash = storedHash.trim();
  if (!hash) return false;

  const declared = LEGACY_PASSWORD_FORMATS.find((known) => known === format);
  const resolved = declared ?? detectLegacyPasswordFormat(hash);
  if (!resolved) return false;

  switch (resolved) {
    case "BCRYPT":
      try {
        return await bcrypt.compare(password, hash);
      } catch {
        return false;
      }
    case "PHPASS": {
      const computed = phpassCrypt(password, hash);
      return computed ? safeEqual(computed, hash) : false;
    }
    case "MD5":
    case "SHA1":
    case "SHA256": {
      const algorithm = DIGEST_ALGORITHMS[resolved];
      if (!algorithm) return false;
      const computed = createHash(algorithm).update(password).digest("hex");
      return safeEqual(computed, hash.toLowerCase());
    }
    case "PLAINTEXT":
      return safeEqual(password, hash);
  }
}
