import { canonicalMmaFighterName } from "@/lib/results/mma-fighter-aliases";

export const MMA_WINNING_METHOD = "Winning Method";

export const MMA_METHOD_LABELS = {
  koTkoDq: "KO/TKO/DQ",
  submission: "Submission",
  points: "Decision",
} as const;

export type MmaWinningMethod = keyof typeof MMA_METHOD_LABELS;
export type MmaFinish = MmaWinningMethod | "draw" | "noContest";

export type MmaBoutIdentity = {
  home: string;
  away: string;
  startsAt: number;
};

export function mmaFighterKey(name: string): string {
  return canonicalMmaFighterName(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** ESPN often lists a bout at the card or prelim start. */
export function sameMmaBout(a: MmaBoutIdentity, b: MmaBoutIdentity): boolean {
  if (!(Math.abs(a.startsAt - b.startsAt) <= 12 * 3_600_000)) return false;
  const aHome = mmaFighterKey(a.home);
  const aAway = mmaFighterKey(a.away);
  const bHome = mmaFighterKey(b.home);
  const bAway = mmaFighterKey(b.away);
  return Boolean(
    aHome &&
    aAway &&
    aHome !== aAway &&
    ((aHome === bHome && aAway === bAway) ||
      (aHome === bAway && aAway === bHome)),
  );
}

export function parseMmaWinningMethod(text: string): {
  fighter: string;
  method: MmaWinningMethod;
} | null {
  for (const [method, label] of Object.entries(MMA_METHOD_LABELS)) {
    const suffix = ` by ${label}`;
    if (!text.endsWith(suffix)) continue;
    const fighter = text.slice(0, -suffix.length).trim();
    if (fighter) return { fighter, method: method as MmaWinningMethod };
  }
  return null;
}

/** The result code from ESPN's final bout status. */
export function espnMmaFinish(name: string | undefined): MmaFinish | undefined {
  const key = name?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  if (key === "nocontest") return "noContest";
  if (key.includes("draw")) return "draw";
  if (key.includes("submission")) return "submission";
  if (key.includes("decision")) return "points";
  if (
    [
      "ko",
      "tko",
      "kotko",
      "knockout",
      "technicalknockout",
      "dq",
      "disqualification",
    ].includes(key)
  ) {
    return "koTkoDq";
  }
  return undefined;
}
