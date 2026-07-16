import { NextResponse } from "next/server";

import { getSchemaStatusReport } from "@/lib/results/schema-status";
import { getCurrentUser } from "@/lib/session";

/** Admin-only: confirm SUPABASE_SQL_PATCHES.md columns/tables exist. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schema = await getSchemaStatusReport();
  return NextResponse.json({ schema });
}
