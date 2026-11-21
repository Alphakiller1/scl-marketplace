import assert from "node:assert/strict";
import test from "node:test";
import * as jsx from "react/jsx-runtime";

import { loadTestModule } from "@/lib/test-support/load-module";
import * as traffic from "@/lib/site-traffic";
import type * as TrafficComponent from "@/components/scl/admin-site-traffic";
import type * as VisitClient from "@/lib/site-visit-client";
import type * as VisitTracker from "@/components/providers/site-visit-tracker";
import * as etDay from "@/lib/et-day";

test("the visit panel polls each minute, resumes on focus, and keeps its last good count on failure", async () => {
  let effect: (() => void | (() => void)) | undefined;
  let tick: (() => void) | undefined;
  const events = new Map<string, () => void>();
  let visibility = "visible";
  const latest = traffic.siteTrafficReport(
    [{ day: "2026-11-21", visits: 5 }],
    new Date("2026-11-21T20:00Z"),
    new Date("2026-11-21T20:05Z"),
  );
  let requests = 0;
  let fail = false;
  let displayed: unknown;
  let delayed: unknown;
  let stateIndex = 0;
  const noop = () => null;
  const { AdminSiteTraffic } = loadTestModule<typeof TrafficComponent>(
    "src/components/scl/admin-site-traffic.tsx",
    {
      "react/jsx-runtime": jsx,
      react: {
        useEffect: (callback: () => void | (() => void)) => {
          effect = callback;
        },
        useState: (initial: unknown) => {
          const index = stateIndex++;
          return [
            initial,
            (value: unknown) => {
              if (index === 0) displayed = value;
              else delayed = value;
            },
          ];
        },
      },
      "lucide-react": { Globe: noop },
      "@/components/ui/card": { Card: noop },
      "@/components/scl/section": { SectionHeader: noop },
      "@/components/scl/stat": { StatBlock: noop },
      "@/lib/site-traffic": traffic,
    },
    {
      setInterval: (callback: () => void, ms: number) => {
        assert.equal(ms, 60_000);
        tick = callback;
        return 1;
      },
      clearInterval: () => {
        tick = undefined;
      },
      document: {
        get visibilityState() {
          return visibility;
        },
        addEventListener: (name: string, callback: () => void) =>
          events.set(name, callback),
        removeEventListener: (name: string) => events.delete(name),
      },
      window: {
        addEventListener: (name: string, callback: () => void) =>
          events.set(name, callback),
        removeEventListener: (name: string) => events.delete(name),
      },
      fetch: async (_url: string, options: RequestInit) => {
        requests++;
        assert.equal(options.cache, "no-store");
        return { ok: !fail, json: async () => latest };
      },
    },
  );
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  AdminSiteTraffic({ data: traffic.siteTrafficReport([], null) });
  const cleanup = effect?.();
  await flush();
  assert.equal((displayed as typeof latest).today, 5);
  assert.equal(requests, 1);
  tick?.();
  await flush();
  assert.equal(requests, 2);
  visibility = "hidden";
  tick?.();
  await flush();
  assert.equal(requests, 2);
  visibility = "visible";
  fail = true;
  events.get("visibilitychange")?.();
  await flush();
  assert.equal(delayed, true);
  assert.equal((displayed as typeof latest).today, 5);
  fail = false;
  events.get("focus")?.();
  await flush();
  assert.equal(delayed, false);
  if (cleanup) cleanup();
  assert.equal(tick, undefined);
  assert.equal(events.size, 0);
});

test("a transient visit-send failure retries the same request identity", async () => {
  const sent: string[] = [];
  const { sendSiteVisit } = loadTestModule<typeof VisitClient>(
    "src/lib/site-visit-client.ts",
    {},
    {
      setTimeout: (callback: () => void) => {
        callback();
        return 1;
      },
      fetch: async (_url: string, options: RequestInit) => {
        sent.push(String(options.body));
        if (sent.length === 1) throw new Error("response lost after write");
        return { ok: true };
      },
    },
  );
  await sendSiteVisit("/", "22e04cd8-926e-4f45-b7c3-48bda6ee41c5");
  assert.equal(sent.length, 2);
  assert.equal(sent[0], sent[1]);
});

test("returning to an existing tab records an expired session or a new Eastern day", async () => {
  const effects: (() => void | (() => void))[] = [];
  const events = new Map<string, () => void>();
  let now = Date.parse("2026-11-21T15:00:00Z");
  class Clock extends Date {
    static now() {
      return now;
    }
  }
  const sent: string[] = [];
  const { SiteVisitTracker } = loadTestModule<typeof VisitTracker>(
    "src/components/providers/site-visit-tracker.tsx",
    {
      "next/navigation": { usePathname: () => "/" },
      react: {
        useRef: (current: unknown) => ({ current }),
        useEffect: (callback: () => void | (() => void)) =>
          effects.push(callback),
      },
      "@/lib/et-day": etDay,
      "@/lib/site-traffic": traffic,
      "@/lib/site-visit-client": {
        sendSiteVisit: async (path: string) => {
          sent.push(path);
        },
      },
    },
    {
      Date: Clock,
      crypto: { randomUUID: () => "22e04cd8-926e-4f45-b7c3-48bda6ee41c5" },
      document: {
        visibilityState: "visible",
        addEventListener: (name: string, callback: () => void) =>
          events.set(name, callback),
        removeEventListener: (name: string) => events.delete(name),
      },
      window: {
        addEventListener: (name: string, callback: () => void) =>
          events.set(name, callback),
        removeEventListener: (name: string) => events.delete(name),
      },
    },
  );
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  SiteVisitTracker({ enabled: true });
  const cleanup = effects[0]();
  await flush();
  assert.equal(sent.length, 1);
  now += 5 * 60_000;
  events.get("visibilitychange")?.();
  await flush();
  assert.equal(
    sent.length,
    1,
    "a short tab switch does not create another visit",
  );
  now += 26 * 60_000;
  events.get("pageshow")?.();
  await flush();
  assert.equal(
    sent.length,
    2,
    "a return after the session expires can be counted",
  );
  now = Date.parse("2026-11-22T04:59:00Z");
  events.get("visibilitychange")?.();
  await flush();
  assert.equal(sent.length, 3);
  now = Date.parse("2026-11-22T05:00:00Z");
  events.get("visibilitychange")?.();
  await flush();
  assert.equal(
    sent.length,
    4,
    "a return after Eastern midnight is recorded for the new day",
  );
  if (cleanup) cleanup();
  assert.equal(events.size, 0);
});
