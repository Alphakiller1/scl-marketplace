const MINUTE_MS = 60_000;

/** Paid/public picks stay sealed until 90 minutes after the scheduled start. */
export const PUBLIC_PICK_EMBARGO_MS = 90 * MINUTE_MS;

export type PublicPickEmbargoState = {
  isEmbargoed: boolean;
  embargoedUntil: Date | null;
};

/**
 * A missing start time fails closed while a pick is pending. That prevents an
 * incomplete odds-provider record from leaking a selection before settlement.
 */
export function publicPickEmbargoState(
  pick: { outcome: string; eventStartsAt: Date | null },
  now: Date = new Date(),
): PublicPickEmbargoState {
  if (pick.outcome !== "PENDING") {
    return { isEmbargoed: false, embargoedUntil: null };
  }

  if (!pick.eventStartsAt) {
    return { isEmbargoed: true, embargoedUntil: null };
  }

  const embargoedUntil = new Date(
    pick.eventStartsAt.getTime() + PUBLIC_PICK_EMBARGO_MS,
  );
  return {
    isEmbargoed: now.getTime() < embargoedUntil.getTime(),
    embargoedUntil,
  };
}
