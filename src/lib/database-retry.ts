const TRANSIENT_DATABASE_CODES = new Set([
  "P1001", // database server unreachable
  "P1002", // database server timeout
  "P1017", // pooler/server closed the connection
  "P2024", // Prisma connection-pool timeout
]);

function errorCode(error: unknown, depth = 0): string | null {
  if (depth > 2 || typeof error !== "object" || error === null) return null;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return errorCode(error.cause, depth + 1);
  return null;
}

export function isTransientDatabaseError(error: unknown): boolean {
  const code = errorCode(error);
  return code !== null && TRANSIENT_DATABASE_CODES.has(code);
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
  const maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 100);

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientDatabaseError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const code = errorCode(error) ?? "unknown";
      const message = `[database] ${options.label} hit transient ${code}; retrying ${attempt + 1}/${maxAttempts}`;
      (options.onRetry ?? console.warn)(message);
      if (retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }
}
