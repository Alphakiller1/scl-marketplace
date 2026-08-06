import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const role = session?.user?.role;
  const accountStatus = session?.user?.accountStatus;

  // Production hard-block for /qa/* fixtures. Page-level notFound() can stream
  // a 404 body with HTTP 200 under App Router; respond with a real 404 status
  // so monitors never treat QA fixtures as live. Opt-in via ALLOW_QA_SHOTS=1.
  if (nextUrl.pathname.startsWith("/qa")) {
    const allowQa =
      process.env.ALLOW_QA_SHOTS === "1" ||
      process.env.NODE_ENV !== "production";
    if (!allowQa) {
      return new NextResponse("Not Found", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "x-robots-tag": "noindex",
          "cache-control": "private, no-store",
        },
      });
    }
    return NextResponse.next();
  }

  const isCapperArea = nextUrl.pathname.startsWith("/dashboard");
  const isAdminArea = nextUrl.pathname.startsWith("/admin");

  // Not signed in → send to login with a return path.
  if ((isCapperArea || isAdminArea) && !session) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (
    (isCapperArea || isAdminArea) &&
    (accountStatus === "SUSPENDED" || accountStatus === "DISABLED")
  ) {
    return NextResponse.redirect(new URL("/account-restricted", nextUrl));
  }

  if (
    (isCapperArea || isAdminArea) &&
    (accountStatus === "PENDING" || !session?.user?.emailVerified)
  ) {
    return NextResponse.redirect(new URL("/verify", nextUrl));
  }

  // Signed in but not an admin → bounce out of admin.
  if (isAdminArea && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/qa/:path*"],
};
