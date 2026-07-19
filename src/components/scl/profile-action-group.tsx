"use client";

import Link from "next/link";
import { GitCompareArrows, Store, UserPlus, UserCheck } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { useCompareTray } from "@/lib/compare-store";
import { cn } from "@/lib/utils";

const FOLLOW_KEY = "scl-follow-handles";
const listeners = new Set<() => void>();

function readFollows(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FOLLOW_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (h): h is string => typeof h === "string" && h.length > 0,
    );
  } catch {
    return [];
  }
}

function writeFollows(handles: string[]) {
  window.localStorage.setItem(FOLLOW_KEY, JSON.stringify(handles));
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === FOLLOW_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function useLocalFollow(handle: string) {
  const clean = handle.replace(/^@/, "").trim().toLowerCase();
  const raw = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readFollows()),
    () => "[]",
  );
  const follows: string[] = JSON.parse(raw) as string[];
  const following = follows.includes(clean);

  const toggle = useCallback(() => {
    if (!clean) return;
    const current = readFollows();
    if (current.includes(clean)) {
      writeFollows(current.filter((h) => h !== clean));
      return;
    }
    writeFollows([...current, clean]);
  }, [clean]);

  return { following, toggle };
}

const BLUE_CTA =
  "border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)] hover:bg-[color:var(--scl-blue-deep)] hover:text-[color:var(--scl-blue-ink)]";
const BLUE_OUTLINE =
  "border-[color:var(--scl-blue)] bg-transparent text-[color:var(--scl-text)] hover:bg-[color:var(--scl-blue)]/10";

/**
 * Proof-mode first-viewport actions — Follow · Compare · View offers as one group.
 * Follow is blue (navigation/relationship) — never pink (verification-only).
 */
export function ProfileActionGroup({
  handle,
  className,
}: {
  handle: string;
  className?: string;
}) {
  const { following, toggle: toggleFollow } = useLocalFollow(handle);
  const { toggle, isSelected, canAdd } = useCompareTray();
  const comparing = isSelected(handle);
  const compareDisabled = !comparing && !canAdd;

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="group"
      aria-label="Profile actions"
    >
      <Button
        data-profile-action-role="relationship"
        type="button"
        size="sm"
        className={cn("min-h-11 gap-1.5 sm:min-h-10", BLUE_CTA)}
        onClick={toggleFollow}
        aria-pressed={following}
      >
        {following ? (
          <UserCheck className="size-3.5" aria-hidden />
        ) : (
          <UserPlus className="size-3.5" aria-hidden />
        )}
        {following ? "Following" : "Follow"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "min-h-11 gap-1.5 sm:min-h-10",
          comparing ? BLUE_OUTLINE : undefined,
        )}
        disabled={compareDisabled}
        aria-pressed={comparing}
        onClick={() => toggle(handle)}
      >
        <GitCompareArrows className="size-3.5" aria-hidden />
        {comparing ? "In compare" : "Compare"}
      </Button>
      <Button
        render={<Link href="#storefront" />}
        nativeButton={false}
        variant="outline"
        size="sm"
        className="min-h-11 gap-1.5 sm:min-h-10"
      >
        <Store className="size-3.5" aria-hidden />
        View offers
      </Button>
    </div>
  );
}
