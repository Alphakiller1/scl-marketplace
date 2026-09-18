import {
  AnnualMark,
  HelmetIcon,
  HoopIcon,
  honorEmoji,
} from "@/components/scl/honor-icons";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";
import { ALL_SPORTS, SUPERMAX, type HonorAward } from "@/lib/honors";
import { NeonTrophy } from "@/lib/og/honor-neon-trophy";
import { OG } from "@/lib/og/tokens";
import { CROSS_SPORTS } from "@/lib/parlay-sport";

export const HONOR_OG_SIZE = { width: 1080, height: 1350 } as const;

/**
 * Spec palette only: ink surfaces, pink conviction marks (the rank-medal
 * treatment), AA text tokens. No gold, no per-award hue.
 */
const PINK = "#BA008E";
const PINK_TEXT = "#FF74C8";
const PINK_INK = "#FFF3FC";

function titleLines(award: HonorAward): [string, string] {
  if (award.sport === SUPERMAX) {
    return [
      "SCL Supermax",
      award.period === "annual" ? "Champion" : "All-Star",
    ];
  }
  if (award.period === "annual") {
    return award.metric === "units"
      ? ["SCL Capper", "of the Year"]
      : ["SCL Annual", "Performance Award"];
  }
  if (award.sport === CROSS_SPORTS)
    return ["SCL Cross Sport", "Parlay Allstar"];
  return award.period === "season"
    ? ["SCL Season", "Champion"]
    : ["SCL Monthly", "Champion"];
}

function subtitle(award: HonorAward): string {
  const metric =
    award.metric === "units" ? "Highest net units" : "Highest ROI%";
  if (award.sport === SUPERMAX) {
    return `Highest net units from Supermax plays · ${award.periodLabel}`;
  }
  if (award.period === "annual") return `${metric} across all sports`;
  if (award.period === "season")
    return `${metric} · ${award.sportLabel} season`;
  return `${metric} · ${award.periodLabel}`;
}

function blurb(award: HonorAward): string {
  const what =
    award.metric === "units" ? "the most net units" : "the highest ROI";
  if (award.sport === ALL_SPORTS) {
    return `Awarded to the capper with ${what} across all sports for ${award.periodKey}.`;
  }
  if (award.sport === CROSS_SPORTS) {
    return `Awarded to the capper with the most net units from Cross-Sports parlays in ${award.periodLabel}.`;
  }
  if (award.sport === SUPERMAX) {
    return `Awarded to the capper with the most net units from 20u Supermax plays in ${award.periodLabel}.`;
  }
  return award.period === "season"
    ? `Awarded to the capper with ${what} in ${award.sportLabel} for the ${award.periodLabel}.`
    : `Awarded to the capper with ${what} in ${award.sportLabel} for ${award.periodLabel}.`;
}

function ribbon(award: HonorAward): string {
  if (award.sport === SUPERMAX) return `Supermax · ${award.periodLabel}`;
  if (award.period === "annual") return award.periodKey;
  if (award.period === "season") {
    return `${award.sportLabel} · ${award.periodKey}`;
  }
  return `${award.sport === CROSS_SPORTS ? "Cross-Sports" : award.sportLabel} · ${award.periodLabel}`;
}

function Emblem({ award }: { award: HonorAward }) {
  const glyph =
    award.sport === ALL_SPORTS ? (
      <AnnualMark metric={award.metric} size={170} color={PINK_TEXT} />
    ) : award.sport === "NCAAF" ? (
      <HelmetIcon size={170} />
    ) : award.sport === "NCAAB" ? (
      <HoopIcon size={170} />
    ) : (
      <span style={{ fontSize: 150, lineHeight: 1 }}>{honorEmoji(award)}</span>
    );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 300,
        height: 300,
        borderRadius: 150,
        border: `12px solid ${PINK}`,
        backgroundColor: OG.card,
        boxShadow: "0 12px 30px rgba(0,0,0,.55)",
      }}
    >
      {glyph}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: 1,
      }}
    >
      <span style={{ fontSize: 50, color: OG.text, fontFamily: "Inter" }}>
        {value}
      </span>
      <span
        style={{
          fontSize: 22,
          color: OG.mutedData,
          letterSpacing: 3,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/** 1080×1350 (4:5) share graphic for one award. Inline styles for next/og. */
export function HonorOgCard({
  award,
  host,
}: {
  award: HonorAward;
  host: string;
}) {
  const [line1, line2] = titleLines(award);
  const { winner } = award;
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "56px 64px 44px",
        color: OG.text,
        fontFamily: "Barlow Condensed",
        backgroundColor: OG.bg,
        borderTop: `10px solid ${PINK}`,
      }}
    >
      {/* Neon trophy behind the record, per the owner's reference art. */}
      <div
        style={{
          position: "absolute",
          top: 232,
          left: 235,
          display: "flex",
        }}
      >
        <NeonTrophy width={610} height={610} color={PINK} core={PINK_INK} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <span
          style={{ fontSize: 40, letterSpacing: 4, textTransform: "uppercase" }}
        >
          Sports Cappers Leaderboard
        </span>
        <span
          style={{
            fontSize: 20,
            letterSpacing: 6,
            color: OG.mutedData,
            textTransform: "uppercase",
          }}
        >
          Verified. Transparent. Trusted.
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: 34,
          textTransform: "uppercase",
          lineHeight: 0.95,
        }}
      >
        <span style={{ fontSize: 118, color: OG.text }}>{line1}</span>
        <span style={{ fontSize: 84, color: PINK_TEXT }}>{line2}</span>
        <span
          style={{
            marginTop: 16,
            fontSize: 28,
            letterSpacing: 3,
            color: OG.mutedData,
          }}
        >
          {subtitle(award)}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: 36,
        }}
      >
        <Emblem award={award} />
        <div
          style={{
            display: "flex",
            marginTop: -26,
            padding: "8px 40px",
            backgroundColor: PINK,
            color: PINK_INK,
            fontSize: 40,
            textTransform: "uppercase",
            borderRadius: 8,
          }}
        >
          {ribbon(award)}
        </div>
      </div>

      <span
        style={{
          marginTop: 40,
          fontSize: 76,
          textTransform: "uppercase",
          color: OG.text,
        }}
      >
        @{winner.handle}
      </span>

      <div
        style={{
          display: "flex",
          width: "100%",
          marginTop: 18,
          padding: "20px 0",
          borderTop: `2px solid ${OG.line}`,
          borderBottom: `2px solid ${OG.line}`,
        }}
      >
        <Stat value={formatUnits(winner.units)} label="Units" />
        <Stat
          value={formatRecord(
            winner.record.w,
            winner.record.l,
            winner.record.p,
          )}
          label="Record"
        />
        <Stat value={formatRoi(winner.roi)} label="ROI" />
      </div>

      <span
        style={{
          marginTop: 26,
          fontSize: 30,
          color: OG.mutedData,
          textAlign: "center",
          fontFamily: "Inter",
          maxWidth: 860,
        }}
      >
        {blurb(award)}
      </span>

      <span
        style={{
          marginTop: "auto",
          alignSelf: "center",
          fontSize: 24,
          letterSpacing: 6,
          color: OG.mutedData,
          textTransform: "uppercase",
        }}
      >
        {host}
      </span>
    </div>
  );
}
