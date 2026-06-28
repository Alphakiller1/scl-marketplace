import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const role = session?.user?.role;
  const accountStatus = session?.user?.accountStatus;

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
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
