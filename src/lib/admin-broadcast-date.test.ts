import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatAdminBroadcastDate } from "./admin-broadcast-date";

describe("admin broadcast date formatting", () => {
  it("renders campaign history with an explicit SCL time-zone label", () => {
    const formatted = formatAdminBroadcastDate(
      new Date("2026-10-02T16:57:24.000Z"),
    );

    assert.match(formatted, /Oct 2, 2026/);
    assert.match(formatted, /12:57 PM/);
    assert.match(formatted, /(EDT|GMT-4)/);
  });
});
