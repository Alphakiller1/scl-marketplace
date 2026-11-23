import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as files from "node:fs/promises";
import * as path from "node:path";
import test from "node:test";
import * as jsx from "react/jsx-runtime";
import sharp from "sharp";

import type { HonorAward } from "@/lib/honors";
import * as card from "@/lib/og/honor-og-card";
import { loadTestModule } from "@/lib/test-support/load-module";
import type * as Images from "@/lib/og/honor-image";
import type * as Route from "@/app/api/og/honor/[id]/route";

const award: HonorAward = {
  id: "annual-2025-all-units",
  name: "2025 Capper of the Year",
  title: "Capper of the Year",
  abbreviation: "2025 COTY",
  period: "annual",
  periodKey: "2025",
  periodLabel: "2025",
  periodEnd: 1767243600000,
  sport: "ALL",
  sportLabel: "All sports",
  metric: "units",
  minimumPicks: 100,
  winner: {
    id: "capper",
    name: "testcapper",
    handle: "testcapper",
    record: { w: 300, l: 200, p: 10 },
    settled: 510,
    units: 450,
    roi: 30,
  },
};

function persistentCache() {
  const entries = new Map<string, string>();
  const reads: string[] = [];
  return {
    entries,
    reads,
    cachedQuery: <Args extends unknown[], T>(
      loader: (...args: Args) => Promise<T>,
      parts: string[],
      options: { revalidate: number; tags: string[] },
    ) => {
      assert.equal(options.revalidate, 86_400);
      assert.ok(options.tags.includes("honors"));
      return async (...args: Args): Promise<T> => {
        reads.push(parts[0]);
        const key = JSON.stringify([parts, args]);
        const cached = entries.get(key);
        if (cached) return JSON.parse(cached) as T;
        const value = JSON.stringify(await loader(...args));
        assert.ok(
          Buffer.byteLength(value) < 2 * 1024 * 1024,
          "binary cache entry fits Next's limit",
        );
        entries.set(key, value);
        return JSON.parse(value) as T;
      };
    },
  };
}

test("responsive honor images share one render and survive a JSON cache hit in a new worker", async () => {
  const cache = persistentCache();
  let renders = 0;
  let reads = 0;
  // Isolate next/og's native image library from the app's Sharp build on Windows.
  const rendered = spawnSync(
    process.execPath,
    [
      "--require",
      "tsx/cjs",
      "-e",
      `
    const fs=require('node:fs');
    const React=require('react');
    const {ImageResponse}=require('next/og');
    const {HonorOgCard,HONOR_OG_SIZE}=require('./src/lib/og/honor-og-card.tsx');
    const award=JSON.parse(fs.readFileSync(0,'utf8'));
    const plate='data:image/jpeg;base64,'+fs.readFileSync('data/og/honor-neon-plate.jpg').toString('base64');
    const font=(file)=>new Uint8Array(fs.readFileSync('data/og/fonts/'+file)).buffer;
    const image=new ImageResponse(React.createElement(HonorOgCard,{award,host:'sportscappersleaderboard.com',plate}),{
      ...HONOR_OG_SIZE,fonts:[
        {name:'Barlow Condensed',data:font('barlow-condensed-latin-700.ttf'),style:'normal',weight:700},
        {name:'Inter',data:font('inter-latin-500.ttf'),style:'normal',weight:500}
      ]
    });
    image.arrayBuffer().then(bytes=>process.stdout.write(Buffer.from(bytes))).catch(e=>{console.error(e);process.exitCode=1;});
  `,
    ],
    { input: JSON.stringify(award), maxBuffer: 4 * 1024 * 1024 },
  );
  assert.equal(rendered.status, 0, rendered.stderr.toString());
  const originalPng = rendered.stdout;
  class Render {
    constructor() {
      renders++;
    }
    async arrayBuffer() {
      return originalPng;
    }
  }
  const worker = () =>
    loadTestModule<typeof Images>(
      "src/lib/og/honor-image.tsx",
      {
        "server-only": {},
        "node:fs/promises": {
          readFile: async (file: string) => {
            reads++;
            return files.readFile(file);
          },
        },
        "node:path": path,
        "next/og": { ImageResponse: Render },
        sharp,
        "react/jsx-runtime": jsx,
        "@/lib/brand": { SCL_PUBLIC_DOMAIN: "sportscappersleaderboard.com" },
        "@/lib/cached-query": cache,
        "@/lib/og/honor-og-card": card,
      },
      { process, Buffer },
    );
  const first = worker();
  const responsive = await Promise.all([
    first.getHonorImage(award, 360),
    first.getHonorImage(award, 540),
  ]);
  assert.equal(renders, 1);
  assert.equal(
    reads,
    3,
    "both fonts and the plate load once without network requests",
  );
  for (const [index, image] of responsive.entries()) {
    const metadata = await sharp(Buffer.from(image.data, "base64")).metadata();
    assert.equal(image.contentType, "image/webp");
    assert.equal(metadata.width, index === 0 ? 360 : 540);
    assert.equal(metadata.height, index === 0 ? 450 : 675);
  }
  const sourceEntry = [...cache.entries.entries()].find(([key]) =>
    key.includes("honor-image-source-v1"),
  );
  assert.ok(sourceEntry);
  const source = Buffer.from(JSON.parse(sourceEntry[1]) as string, "base64");
  assert.deepEqual(
    await sharp(source).ensureAlpha().raw().toBuffer(),
    await sharp(originalPng).ensureAlpha().raw().toBuffer(),
    "the shared source preserves every original pixel",
  );
  const restarted = worker();
  const beforeNewWidth = cache.reads.length;
  const larger = await restarted.getHonorImage(award, 720);
  assert.equal(
    cache.reads.length - beforeNewWidth,
    1,
    "another width reads only the small display bundle, not the lossless source",
  );
  assert.equal(
    (await sharp(Buffer.from(larger.data, "base64")).metadata()).width,
    720,
  );
  const download = await restarted.getHonorImage(award, null);
  const full = await sharp(Buffer.from(download.data, "base64")).metadata();
  assert.equal(full.format, "png");
  assert.equal(full.width, 1080);
  assert.equal(full.height, 1350);
  assert.equal(
    renders,
    1,
    "a new size and PNG download reuse persisted artwork after restart",
  );
  assert.equal(reads, 3);
  await restarted.getHonorImage(
    { ...award, winner: { ...award.winner, units: 451 } },
    360,
  );
  assert.equal(renders, 2, "changed award content gets a fresh render");
});

test("a failed honor render is retried instead of pinning a rejected promise", async () => {
  const png = await sharp({
    create: { width: 1080, height: 1350, channels: 4, background: "#111a2a" },
  })
    .png()
    .toBuffer();
  let attempts = 0;
  class FlakyRender {
    async arrayBuffer() {
      if (++attempts === 1) throw new Error("render interrupted");
      return png;
    }
  }
  const images = loadTestModule<typeof Images>(
    "src/lib/og/honor-image.tsx",
    {
      "server-only": {},
      "node:fs/promises": files,
      "node:path": path,
      "next/og": { ImageResponse: FlakyRender },
      sharp,
      "react/jsx-runtime": jsx,
      "@/lib/brand": { SCL_PUBLIC_DOMAIN: "sportscappersleaderboard.com" },
      "@/lib/cached-query": persistentCache(),
      "@/lib/og/honor-og-card": card,
    },
    { process, Buffer },
  );
  await assert.rejects(images.getHonorImage(award, 360), /render interrupted/);
  assert.equal(
    (await images.getHonorImage(award, 360)).contentType,
    "image/webp",
  );
  assert.equal(attempts, 2);
});

test("the image route preserves WebP, full PNG downloads and uncached missing-award responses", async () => {
  const widths: (number | null)[] = [];
  const { GET } = loadTestModule<typeof Route>(
    "src/app/api/og/honor/[id]/route.tsx",
    {
      "@/lib/og/honor-og-card": card,
      "@/lib/queries/honors": {
        getHonorAwardById: async (id: string) =>
          id === award.id ? award : null,
      },
      "@/lib/og/honor-image": {
        getHonorImage: async (_award: HonorAward, width: number | null) => {
          widths.push(width);
          return {
            data: Buffer.from("bytes").toString("base64"),
            contentType: width == null ? "image/png" : "image/webp",
          };
        },
      },
    },
    { Response, URL, Buffer },
  );
  const params = { params: Promise.resolve({ id: award.id }) };
  const image = await GET(
    new Request("https://scl.example/api/og/honor/test?w=540"),
    params,
  );
  assert.equal(image.headers.get("content-type"), "image/webp");
  const download = await GET(
    new Request("https://scl.example/api/og/honor/test?w=360&download=1"),
    params,
  );
  assert.equal(download.headers.get("content-type"), "image/png");
  assert.match(
    download.headers.get("content-disposition") ?? "",
    /attachment; filename="scl-honors-annual-2025-all-units.png"/,
  );
  assert.match(download.headers.get("cache-control") ?? "", /max-age=86400/);
  assert.equal(
    (
      await GET(new Request("https://scl.example/api/og/honor/missing"), {
        params: Promise.resolve({ id: "missing" }),
      })
    ).status,
    404,
  );
  assert.deepEqual(widths, [540, null]);
});
