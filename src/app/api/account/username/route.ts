import { NextResponse } from "next/server";

import { updateUsernameAction } from "@/lib/actions/profile.action";
import { userFacingProfileSaveError } from "@/lib/profile-save-error";
import { isTrustedUsernameRequest } from "@/lib/profile-username-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Username changes go through fetch + JSON, not a Server Action.
 *
 * Next.js Server Actions throw a client digest when the Origin/Host pair
 * does not match (www vs apex) or when Safari drops the action POST. That
 * digest was toasted as "We couldn't save your profile" and never wrote the
 * handle. This route always returns JSON.
 */
export async function POST(request: Request) {
  try {
    if (!isTrustedUsernameRequest(request)) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "We couldn't save your username. Try again.",
        },
        { status: 403 },
      );
    }
    const body: unknown = await request.json();
    const username =
      typeof body === "object" &&
      body !== null &&
      "username" in body &&
      typeof body.username === "string"
        ? body.username
        : "";
    const result = await updateUsernameAction(username);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[profile] username API failed:", error);
    return NextResponse.json(
      {
        ok: false as const,
        error: userFacingProfileSaveError(error, "username"),
      },
      { status: 500 },
    );
  }
}
