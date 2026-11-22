const TRANSIENT_DATABASE_CODES = new Set([
  "P1001", // database server unreachable
  "P1002", // database server timeout
  "P1017", // pooler/server closed the connection
  "P2024", // Prisma connection-pool timeout
]);

const RETRY_EXHAUSTED = Symbol.for("scl.database-retry-exhausted");

export function databaseErrorCode(error: unknown, depth = 0): string | null {
  if (depth > 2 || typeof error !== "object" || error === null) return null;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return databaseErrorCode(error.cause, depth + 1);
  return null;
}

export function isTransientDatabaseError(error: unknown): boolean {
  const code = databaseErrorCode(error);
  return code !== null && TRANSIENT_DATABASE_CODES.has(code);
}

function wasRetryExhausted(error: unknown): boolean {
  return Boolean(
    typeof error === "object" &&
    error !== null &&
    RETRY_EXHAUSTED in error &&
    error[RETRY_EXHAUSTED as keyof typeof error],
  );
}

function markRetryExhausted(error: unknown): void {
  if (typeof error !== "object" || error === null) return;
  try {
    Object.defineProperty(error, RETRY_EXHAUSTED, { value: true });
  } catch {
    // Some third-party errors are frozen. The original error still propagates.
  }
}

/**
 * Postgres answers SCL's reads in milliseconds (pg_stat_statements, 2026-11-13),
 * yet public pages were timing out after 300s with nothing logged. A read this
 * slow is waiting on the app side — a starved instance, the pool, a dead
 * socket — and saying so, with its label, is how the next one gets found.
 */
export const SLOW_DATABASE_READ_MS = 5_000;

function warnIfSlow(label: string, startedAt: number, attempt: number) {
  const elapsed = Date.now() - startedAt;
  if (elapsed >= SLOW_DATABASE_READ_MS) {
    console.warn(
      `[database] slow: ${label} took ${elapsed}ms (attempt ${attempt})`,
    );
  }
}

export async function withTransientDatabaseRetry<T>(
  operation: () => Promise<T>,
  options: {
    label: string;
    maxAttempts?: number;
    retryDelayMs?: number;
    onRetry?: (message: string) => void;
  },
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 100);
  const startedAt = Date.now();

  for (let attempt = 1; ; attempt += 1) {
    try {
      const result = await operation();
      warnIfSlow(options.label, startedAt, attempt);
      return result;
    } catch (error) {
      warnIfSlow(options.label, startedAt, attempt);
      if (
        !isTransientDatabaseError(error) ||
        wasRetryExhausted(error) ||
        attempt >= maxAttempts
      ) {
        if (isTransientDatabaseError(error)) markRetryExhausted(error);
        throw error;
      }

      const code = databaseErrorCode(error) ?? "unknown";
      const message = `[database] ${options.label} hit transient ${code}; retrying ${attempt + 1}/${maxAttempts}`;
      (options.onRetry ?? console.warn)(message);
      if (retryDelayMs > 0) {
        const delayMs = Math.min(retryDelayMs * 2 ** (attempt - 1), 1_000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}
