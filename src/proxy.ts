import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { defaultPathForRole } from "@/lib/commerce-settings";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const role = session?.user?.role;
  const accountStatus = session?.user?.accountStatus;

  const isCapperArea = nextUrl.pathname.startsWith("/dashboard");
  const isCustomerArea = nextUrl.pathname.startsWith("/account");
  const isAdminArea = nextUrl.pathname.startsWith("/admin");
  const isProtected = isCapperArea || isAdminArea || isCustomerArea;

  if (isProtected && !session) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (
    isProtected &&
    (accountStatus === "SUSPENDED" || accountStatus === "DISABLED")
  ) {
    return NextResponse.redirect(new URL("/account-restricted", nextUrl));
  }

  if (
    isProtected &&
    (accountStatus === "PENDING" || !session?.user?.emailVerified)
  ) {
    return NextResponse.redirect(new URL("/verify", nextUrl));
  }

  if (isAdminArea && role !== "ADMIN") {
    return NextResponse.redirect(new URL(defaultPathForRole(role), nextUrl));
  }

  if (isCapperArea && role === "CUSTOMER") {
    return NextResponse.redirect(new URL("/account", nextUrl));
  }

  if (isCustomerArea && role !== "CUSTOMER") {
    return NextResponse.redirect(new URL(defaultPathForRole(role), nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/account/:path*"],
};
