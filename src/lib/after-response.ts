import { after } from "next/server";

/**
 * Run post-response work without leaking a database connection.
 *
 * A bare `void somePrismaWrite()` is not safe on serverless. Once the response
 * is sent the isolate can be frozen or torn down, so a write that has issued
 * `BEGIN` but not yet `COMMIT` leaves its connection wedged `idle in
 * transaction` until the pooler times it out. With `max_connections = 60` on
 * this instance, a handful of those exhausts the pooler and every subsequent
 * query fails with `ECHECKOUTTIMEOUT` — which is exactly how odds telemetry and
 * the grading throttle took down pick entry with 500s.
 *
 * `after()` keeps the invocation alive until the work settles, so the
 * transaction commits and the connection returns to the pool.
 *
 * Outside a request scope — scripts, the cron worker, tests — `after()` throws;
 * there is no response to race there, so running it directly is correct.
 */
export function afterResponse(work: () => Promise<unknown>): void {
  const guarded = async () => {
    try {
      await work();
    } catch {
      // Post-response work must never surface as a broken page.
    }
  };

  try {
    after(guarded);
  } catch {
    void guarded();
  }
}
