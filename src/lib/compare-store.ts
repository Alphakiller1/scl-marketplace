"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "scl-compare-tray";
const MAX_COMPARE = 3;

type Listener = () => void;
const listeners = new Set<Listener>();

function readHandles(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((h): h is string => typeof h === "string" && h.length > 0)
      .slice(0, MAX_COMPARE);
  } catch {
    return [];
  }
}

function writeHandles(handles: string[]) {
  const next = handles.slice(0, MAX_COMPARE);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  return JSON.stringify(readHandles());
}

function getServerSnapshot() {
  return "[]";
}

export function useCompareTray() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const handles: string[] = JSON.parse(raw) as string[];

  const toggle = useCallback((handle: string) => {
    const clean = handle.replace(/^@/, "").trim().toLowerCase();
    if (!clean) return;
    const current = readHandles();
    if (current.includes(clean)) {
      writeHandles(current.filter((h) => h !== clean));
      return;
    }
    if (current.length >= MAX_COMPARE) return;
    writeHandles([...current, clean]);
  }, []);

  const remove = useCallback((handle: string) => {
    const clean = handle.replace(/^@/, "").trim().toLowerCase();
    writeHandles(readHandles().filter((h) => h !== clean));
  }, []);

  const clear = useCallback(() => writeHandles([]), []);

  const isSelected = useCallback(
    (handle: string) =>
      handles.includes(handle.replace(/^@/, "").trim().toLowerCase()),
    [handles],
  );

  const canAdd = handles.length < MAX_COMPARE;

  return {
    handles,
    toggle,
    remove,
    clear,
    isSelected,
    canAdd,
    max: MAX_COMPARE,
  };
}
