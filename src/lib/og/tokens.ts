/** Dark-frame palette for Open Graph cards (matches scl-ink-950 theme). */
export const OG = {
  bg: "#07090F",
  card: "#121A28",
  line: "#243045",
  text: "#EDF1F7",
  muted: "#7E8AA0",
  mutedData: "#AAB6C9",
  blue: "#105FD9",
  blueInk: "#F1F9FF",
  win: "#2FBF7B",
  loss: "#E5484D",
} as const;

export type CapperOgPayload = {
  handle: string;
  verified: boolean;
  record: { w: number; l: number; p: number };
  units: number;
  roi: number;
  topSport: string;
  settledPicks: number;
  performanceTrend: number[];
};
