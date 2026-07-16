import { NextResponse } from "next/server";

import { getCurrentAccount } from "@/lib/session";
import { getSchemaStatusReport } from "@/lib/results/schema-status";

/** Admin-only: confirm SUPABASE_SQL_PATCHES.md columns/tables exist. */
export async function GET() {
  const account = await getCurrentAccount();
  if (!account || account.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schema = await getSchemaStatusReport();
  return NextResponse.json({ schema });
}
