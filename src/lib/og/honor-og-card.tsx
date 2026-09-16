import { HelmetIcon, HoopIcon, honorEmoji } from "@/components/scl/honor-icons";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";
import { ALL_SPORTS, type HonorAward } from "@/lib/honors";
import { CROSS_SPORTS } from "@/lib/parlay-sport";

export const HONOR_OG_SIZE = { width: 1080, height: 1350 } as const;

/** One scheme per award family, after the owner's inspiration set. */
const SCHEMES = {
  coty: { bg: "#06163f", glow: "#1d4ed8", accent: "#60a5fa" },
  performance: { bg: "#3a060c", glow: "#b91c1c", accent: "#f87171" },
  season: { bg: "#04260f", glow: "#15803d", accent: "#4ade80" },
  monthly: { bg: "#1f0942", glow: "#7e22ce", accent: "#c084fc" },
} as const;

const GOLD = "#f1c35b";
const GOLD_BRIGHT = "#ffe7a3";
const GOLD_DEEP = "#8a5d12";
const TEXT = "#f8f5ec";
const MUTED = "#c9c3b3";

function scheme(award: HonorAward) {
  if (award.period === "annual") {
    return award.metric === "units" ? SCHEMES.coty : SCHEMES.performance;
  }
  return award.period === "season" ? SCHEMES.season : SCHEMES.monthly;
}

function titleLines(award: HonorAward): [string, string] {
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
  return award.period === "season"
    ? `Awarded to the capper with ${what} in ${award.sportLabel} for the ${award.periodLabel}.`
    : `Awarded to the capper with ${what} in ${award.sportLabel} for ${award.periodLabel}.`;
}

function ribbon(award: HonorAward): string {
  if (award.period === "annual") return award.periodKey;
  if (award.period === "season") {
    return `${award.sportLabel} · ${award.periodKey}`;
  }
  return `${award.sport === CROSS_SPORTS ? "Cross-Sports" : award.sportLabel} · ${award.periodLabel}`;
}

function Emblem({ award }: { award: HonorAward }) {
  const glyph =
    award.sport === "NCAAF" ? (
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
        border: `10px solid ${GOLD}`,
        backgroundImage: `radial-gradient(circle at 35% 30%, ${GOLD_BRIGHT}, ${GOLD} 45%, ${GOLD_DEEP})`,
        boxShadow: `0 0 80px ${GOLD}`,
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
      <span style={{ fontSize: 50, color: TEXT, fontFamily: "Inter" }}>
        {value}
      </span>
      <span
        style={{
          fontSize: 22,
          color: MUTED,
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
  const colors = scheme(award);
  const [line1, line2] = titleLines(award);
  const { winner } = award;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "56px 64px 44px",
        color: TEXT,
        fontFamily: "Barlow Condensed",
        backgroundColor: colors.bg,
        backgroundImage: `radial-gradient(circle at 50% 42%, ${colors.glow}, ${colors.bg} 62%)`,
        border: `8px solid ${GOLD_DEEP}`,
      }}
    >
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
            color: MUTED,
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
        <span style={{ fontSize: 118, color: GOLD }}>{line1}</span>
        <span style={{ fontSize: 84, color: TEXT }}>{line2}</span>
        <span
          style={{
            marginTop: 16,
            fontSize: 28,
            letterSpacing: 3,
            color: colors.accent,
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
            backgroundImage: `linear-gradient(${GOLD_BRIGHT}, ${GOLD})`,
            color: "#231703",
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
          color: TEXT,
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
          borderTop: `2px solid ${GOLD_DEEP}`,
          borderBottom: `2px solid ${GOLD_DEEP}`,
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
          color: MUTED,
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
          fontSize: 24,
          letterSpacing: 6,
          color: GOLD,
          textTransform: "uppercase",
        }}
      >
        {host}
      </span>
    </div>
  );
}
