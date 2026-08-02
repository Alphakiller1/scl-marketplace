import assert from "node:assert/strict";
import test from "node:test";

import { shouldRecordPackageClick } from "@/lib/package-click";

const browserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36";

test("records a user-activated browser navigation", () => {
  const headers = new Headers({
    "user-agent": browserAgent,
    "sec-fetch-mode": "navigate",
    "sec-fetch-dest": "document",
    "sec-fetch-user": "?1",
  });

  assert.equal(shouldRecordPackageClick(headers), true);
});

test("does not record prefetches, subresource fetches, or automation", () => {
  assert.equal(
    shouldRecordPackageClick(
      new Headers({ "user-agent": browserAgent, purpose: "prefetch" }),
    ),
    false,
  );
  assert.equal(
    shouldRecordPackageClick(
      new Headers({
        "user-agent": browserAgent,
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
      }),
    ),
    false,
  );
  assert.equal(
    shouldRecordPackageClick(new Headers({ "user-agent": "curl/8.10.1" })),
    false,
  );
});

test("retains a conservative compatibility path for older browsers", () => {
  assert.equal(
    shouldRecordPackageClick(new Headers({ "user-agent": browserAgent })),
    true,
  );
});
