"use client";

import Link from "next/link";
import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogIn,
  Menu,
  Package,
  Plus,
  Trophy,
  UserRound,
  UserRoundPlus,
  Users,
  Zap,
} from "lucide-react";

import { SclLogo } from "@/components/scl-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import type { WorkspaceDestination } from "@/lib/auth-routing";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavItem = {
  href: string;
  label: string;
};

const MARKETING_NAV = [
  { href: "/picks", label: "Picks", icon: Zap },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/discover", label: "Discover", icon: Users },
  { href: "/packages", label: "Packages", icon: Package },
];

const navLinkClass =
  "border-border bg-surface-2/50 hover:bg-surface-2 focus-visible:ring-ring flex min-h-12 items-center gap-3 rounded-xl border px-4 text-base font-semibold outline-none transition-colors focus-visible:ring-2";

export function MobileSiteNav({
  workspace,
}: {
  workspace?: WorkspaceDestination;
}) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-11 sm:hidden"
            aria-label="Open Main Menu"
            title="Open Main Menu"
          />
        }
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="border-border w-[calc(100%-1rem)] max-w-sm pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="border-border border-b px-5 py-5">
          <BrandLabel label="Explore SCL" />
          <SheetTitle className="mt-3 text-xl font-bold">Main Menu</SheetTitle>
          <SheetDescription>
            Latest picks, rankings, capper records, and marketplace access.
          </SheetDescription>
        </SheetHeader>

        <nav className="grid gap-2 px-4" aria-label="Mobile Navigation">
          {MARKETING_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <SheetClose
                key={item.href}
                nativeButton={false}
                render={<Link href={item.href} className={navLinkClass} />}
              >
                <Icon
                  className="size-5 text-[color:var(--scl-blue)]"
                  aria-hidden
                />
                {item.label}
              </SheetClose>
            );
          })}
        </nav>

        <SheetFooter className="border-border border-t">
          {workspace ? (
            <>
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    href={workspace.href}
                    className="scl-cta-nav flex min-h-12 items-center justify-center gap-2 px-4"
                  />
                }
              >
                <LayoutDashboard className="size-4" aria-hidden />
                {workspace.label}
              </SheetClose>
              <SignOutButton className="border-border min-h-12 w-full justify-center rounded-lg border" />
            </>
          ) : (
            <>
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    href="/signup"
                    className="scl-cta-brand flex min-h-12 items-center justify-center gap-2 px-4"
                  />
                }
              >
                <UserRoundPlus className="size-4" aria-hidden />
                Join SCL
              </SheetClose>
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    href="/login"
                    className="border-border hover:bg-surface-2 flex min-h-12 items-center justify-center gap-2 rounded-lg border px-4 font-semibold transition-colors"
                  />
                }
              >
                <LogIn className="size-4" aria-hidden />
                Log In
              </SheetClose>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function MobileAppNav({ area, nav }: { area: string; nav: NavItem[] }) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-11 sm:hidden"
            aria-label={`Open ${area} Menu`}
            title={`Open ${area} Menu`}
          />
        }
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="border-border w-[calc(100%-1rem)] max-w-sm pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="border-border border-b px-5 py-5">
          <BrandLabel label={`${area} Workspace`} />
          <SheetTitle className="mt-3 text-xl font-bold">
            Workspace Menu
          </SheetTitle>
          <SheetDescription>
            Manage your public record and capper identity.
          </SheetDescription>
        </SheetHeader>

        <nav className="grid gap-2 px-4" aria-label={`${area} Navigation`}>
          {nav.map((item) => {
            const Icon = workspaceIcon(item.href);
            const primary = item.href.includes("/picks/new");
            return (
              <SheetClose
                key={item.href}
                nativeButton={false}
                render={
                  <Link
                    href={item.href}
                    className={
                      primary
                        ? "scl-cta-brand flex min-h-12 items-center justify-center gap-2 px-4"
                        : navLinkClass
                    }
                  />
                }
              >
                <Icon
                  className={
                    primary ? "size-5" : "size-5 text-[color:var(--scl-blue)]"
                  }
                  aria-hidden
                />
                {item.label}
              </SheetClose>
            );
          })}
        </nav>

        <SheetFooter className="border-border border-t">
          <SignOutButton className="min-h-12 w-full justify-center" />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function workspaceIcon(href: string) {
  if (href.includes("/picks/new")) return Plus;
  if (href.endsWith("/picks")) return ClipboardList;
  if (href.endsWith("/plays")) return ClipboardList;
  if (href.endsWith("/policies")) return FileText;
  if (href.endsWith("/cappers")) return Users;
  if (href.endsWith("/store-setup")) return Package;
  if (href.endsWith("/profile")) return UserRound;
  return LayoutDashboard;
}

function BrandLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="ring-border-strong flex size-10 items-center justify-center rounded-xl bg-[color:var(--scl-ink-800)] ring-1">
        <SclLogo className="size-6" />
      </span>
      <div>
        <p className="scl-display font-bold tracking-[0.08em] uppercase">SCL</p>
        <p className="text-muted-foreground text-xs">{label}</p>
      </div>
    </div>
  );
}
