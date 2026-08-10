import assert from "node:assert/strict";
import test from "node:test";

import {
  isTransientDatabaseError,
  withTransientDatabaseRetry,
} from "@/lib/database-retry";

function databaseError(code: string) {
  return Object.assign(new Error(code), { code });
}

test("database reads retry a closed pooler connection", async () => {
  let attempts = 0;
  const retries: string[] = [];
  const value = await withTransientDatabaseRetry(
    async () => {
      attempts += 1;
      if (attempts === 1) throw databaseError("P1017");
      return "recovered";
    },
    {
      label: "test read",
      retryDelayMs: 0,
      onRetry: (message) => retries.push(message),
    },
  );

  assert.equal(value, "recovered");
  assert.equal(attempts, 2);
  assert.equal(retries.length, 1);
});

test("connection-pool timeouts are transient but data errors fail immediately", async () => {
  assert.equal(isTransientDatabaseError(databaseError("P2024")), true);
  assert.equal(
    isTransientDatabaseError({ cause: databaseError("P1001") }),
    true,
  );
  assert.equal(isTransientDatabaseError(databaseError("P2002")), false);

  let attempts = 0;
  await assert.rejects(
    withTransientDatabaseRetry(
      async () => {
        attempts += 1;
        throw databaseError("P2002");
      },
      { label: "test write", retryDelayMs: 0 },
    ),
  );
  assert.equal(attempts, 1);
});

test("a persistent pool failure stops after the bounded retry", async () => {
  let attempts = 0;
  await assert.rejects(
    withTransientDatabaseRetry(
      async () => {
        attempts += 1;
        throw databaseError("P2024");
      },
      {
        label: "test read",
        maxAttempts: 3,
        retryDelayMs: 0,
        onRetry: () => undefined,
      },
    ),
  );
  assert.equal(attempts, 3);
});

test("nested retry guards do not multiply attempts after exhaustion", async () => {
  let attempts = 0;
  await assert.rejects(
    withTransientDatabaseRetry(
      () =>
        withTransientDatabaseRetry(
          async () => {
            attempts += 1;
            throw databaseError("P2024");
          },
          { label: "inner", retryDelayMs: 0, onRetry: () => undefined },
        ),
      { label: "outer", retryDelayMs: 0, onRetry: () => undefined },
    ),
  );
  assert.equal(attempts, 3);
});
