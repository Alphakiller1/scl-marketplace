export type SettlementProgress = {
  completed: number;
  total: number;
  allComplete: boolean;
};

/**
 * Observe independent requests as each one settles without waiting for the
 * slowest request. Keep this orchestration outside React so the progressive
 * rendering guarantee is regression-testable.
 */
export async function settleProgressively<T>(
  requests: readonly Promise<T>[],
  onSettled: (value: T, progress: SettlementProgress) => void,
): Promise<void> {
  let completed = 0;

  await Promise.all(
    requests.map(async (request) => {
      const value = await request;
      completed += 1;
      onSettled(value, {
        completed,
        total: requests.length,
        allComplete: completed === requests.length,
      });
    }),
  );
}
