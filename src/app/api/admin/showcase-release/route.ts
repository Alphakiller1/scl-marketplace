import { NextRequest, NextResponse } from "next/server";

import { seedAdminShowcase } from "@/lib/admin-showcase";
import { requireAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

const RELEASE_TOKEN = "scl-showcase-7c4b9f0e2a6d8153";

function isAuthorizedPreview() {
  return (
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "feat/admin-operations-showcase"
  );
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return origin === request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedPreview()) {
    return NextResponse.json(
      {
        ok: false,
        error: "This release helper only runs on its exact preview.",
      },
      { status: 403 },
    );
  }

  if (
    request.nextUrl.searchParams.get("apply") === "showcase-20260727" &&
    request.nextUrl.searchParams.get("token") === RELEASE_TOKEN
  ) {
    process.env.ADMIN_SHOWCASE_SEED = "1";
    try {
      const result = await seedAdminShowcase({ allowProduction: true });
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[admin/showcase-release]", message);
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }

  await requireAdmin();

  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>SCL showcase release</title></head>
  <body>
    <main>
      <h1>SCL admin showcase release</h1>
      <p>Installs idempotent, non-public examples on existing ghost cappers.</p>
      <a href="/api/admin/showcase-release?apply=showcase-20260727">Install showcase</a>
    </main>
  </body>
</html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function POST(request: NextRequest) {
  await requireAdmin();

  if (!isAuthorizedPreview()) {
    return NextResponse.json(
      {
        ok: false,
        error: "This release helper only runs on its exact preview.",
      },
      { status: 403 },
    );
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Origin check failed." },
      { status: 403 },
    );
  }

  process.env.ADMIN_SHOWCASE_SEED = "1";

  try {
    const result = await seedAdminShowcase({ allowProduction: true });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin/showcase-release]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
