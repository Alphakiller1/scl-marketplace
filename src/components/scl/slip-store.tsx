"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import type { OddsPick } from "@/components/scl/game-picker";
import {
  findConflict,
  findInternalParlayConflicts,
  seedSinglesUnitsFromParlayStake,
  selectedKeysFromSelections,
  toSlipSelection,
  type SlipConflict,
  type SlipMode,
  type SlipSelection,
} from "@/lib/slip";

const DEFAULT_UNITS = 1;

type PendingConflict = {
  conflict: SlipConflict;
  pick: OddsPick;
};

type SlipStoreValue = {
  mode: SlipMode;
  selections: SlipSelection[];
  parlayUnits: number;
  selectedKeys: Set<string>;
  pendingConflict: PendingConflict | null;
  internalConflicts: ReturnType<typeof findInternalParlayConflicts>;
  setMode: (mode: SlipMode) => void;
  setParlayUnits: (units: number) => void;
  setSelectionUnits: (id: string, units: number) => void;
  addPick: (pick: OddsPick) => void;
  removeSelection: (id: string) => void;
  clearSlip: () => void;
  resolveConflictReplace: () => void;
  resolveConflictCancel: () => void;
};

const SlipStoreContext = createContext<SlipStoreValue | null>(null);

export function SlipStoreProvider({
  initialMode = "singles",
  children,
}: {
  initialMode?: SlipMode;
  children: ReactNode;
}) {
  const [mode, setModeState] = useState<SlipMode>(initialMode);
  const [selections, setSelections] = useState<SlipSelection[]>([]);
  const [parlayUnits, setParlayUnits] = useState(DEFAULT_UNITS);
  const [pendingConflict, setPendingConflict] =
    useState<PendingConflict | null>(null);
  const [unitsDropWarned, setUnitsDropWarned] = useState(false);

  const selectedKeys = useMemo(
    () => selectedKeysFromSelections(selections),
    [selections],
  );

  const internalConflicts = useMemo(
    () => (mode === "parlay" ? findInternalParlayConflicts(selections) : []),
    [mode, selections],
  );

  const setMode = useCallback(
    (next: SlipMode) => {
      if (next === mode) return;

      if (mode === "singles" && next === "parlay") {
        // Per-line units dropped in favor of the single parlay stake (§2.4).
        if (
          !unitsDropWarned &&
          selections.some((s) => s.units !== parlayUnits)
        ) {
          toast.message("Per-line stakes reset", {
            description:
              "Parlay uses one stake for all legs. Your per-line units were cleared.",
          });
          setUnitsDropWarned(true);
        }
        const conflicts = findInternalParlayConflicts(selections);
        if (conflicts.length) {
          toast.message("Parlay conflict", {
            description:
              "Some selections share the same market — remove or replace a leg before submitting.",
          });
        }
      }

      if (mode === "parlay" && next === "singles") {
        setSelections((curr) =>
          seedSinglesUnitsFromParlayStake(curr, parlayUnits),
        );
      }

      setPendingConflict(null);
      setModeState(next);
    },
    [mode, parlayUnits, selections, unitsDropWarned],
  );

  const addPick = useCallback(
    (pick: OddsPick) => {
      if (mode === "singles") {
        const next = toSlipSelection(pick, DEFAULT_UNITS);
        setSelections((curr) => {
          if (curr.some((s) => s.id === next.id)) return curr;
          return [...curr, next];
        });
        setPendingConflict(null);
        return;
      }

      // Parlay: enforce findConflict.
      setSelections((curr) => {
        const conflict = findConflict(curr, pick);
        if (!conflict) {
          setPendingConflict(null);
          return [...curr, toSlipSelection(pick, parlayUnits)];
        }
        if (conflict.kind === "duplicate") {
          setPendingConflict(null);
          return curr;
        }
        setPendingConflict({ conflict, pick });
        return curr;
      });
    },
    [mode, parlayUnits],
  );

  const resolveConflictReplace = useCallback(() => {
    setPendingConflict((pending) => {
      if (!pending) return null;
      const { conflict, pick } = pending;
      setSelections((curr) => {
        const next = [...curr];
        next[conflict.index] = toSlipSelection(pick, parlayUnits);
        return next;
      });
      return null;
    });
  }, [parlayUnits]);

  const resolveConflictCancel = useCallback(() => {
    setPendingConflict(null);
  }, []);

  const removeSelection = useCallback((id: string) => {
    setSelections((curr) => curr.filter((s) => s.id !== id));
    setPendingConflict(null);
  }, []);

  const clearSlip = useCallback(() => {
    setSelections([]);
    setPendingConflict(null);
  }, []);

  const setSelectionUnits = useCallback((id: string, units: number) => {
    setSelections((curr) =>
      curr.map((s) => (s.id === id ? { ...s, units } : s)),
    );
  }, []);

  const value = useMemo<SlipStoreValue>(
    () => ({
      mode,
      selections,
      parlayUnits,
      selectedKeys,
      pendingConflict,
      internalConflicts,
      setMode,
      setParlayUnits,
      setSelectionUnits,
      addPick,
      removeSelection,
      clearSlip,
      resolveConflictReplace,
      resolveConflictCancel,
    }),
    [
      mode,
      selections,
      parlayUnits,
      selectedKeys,
      pendingConflict,
      internalConflicts,
      setMode,
      setSelectionUnits,
      addPick,
      removeSelection,
      clearSlip,
      resolveConflictReplace,
      resolveConflictCancel,
    ],
  );

  return (
    <SlipStoreContext.Provider value={value}>
      {children}
    </SlipStoreContext.Provider>
  );
}

export function useSlipStore(): SlipStoreValue {
  const ctx = useContext(SlipStoreContext);
  if (!ctx) {
    throw new Error("useSlipStore must be used within SlipStoreProvider");
  }
  return ctx;
}
