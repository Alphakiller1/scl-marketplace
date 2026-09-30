import {
  AnnualMark,
  HelmetIcon,
  HoopIcon,
  honorEmoji,
} from "@/components/scl/honor-icons";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";
import { ALL_SPORTS, SUPERMAX, type HonorAward } from "@/lib/honors";
import { HonorNeonStage, NeonTrophy } from "@/lib/og/honor-neon-trophy";
import { OG } from "@/lib/og/tokens";
import { CROSS_SPORTS } from "@/lib/parlay-sport";

export const HONOR_OG_SIZE = { width: 1080, height: 1350 } as const;
export const HONOR_OG_VERSION = "20260930b";

const PINK = "#D000A0";
const PINK_BRIGHT = "#FF65CB";
const PINK_INK = "#FFF3FC";
const BLUE = "#1688FF";
const PURPLE = "#7B2BFF";
const EMBLEM_BG = "#111A2A";

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
      <AnnualMark metric={award.metric} size={160} color={PINK_BRIGHT} />
    ) : award.sport === "NCAAF" ? (
      <HelmetIcon size={164} />
    ) : award.sport === "NCAAB" ? (
      <HoopIcon size={164} />
    ) : (
      <span style={{ fontSize: 146, lineHeight: 1 }}>{honorEmoji(award)}</span>
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
        backgroundColor: EMBLEM_BG,
        boxShadow:
          "0 0 0 4px rgba(255,101,203,.2), 0 0 44px rgba(208,0,160,.48), 0 16px 36px rgba(0,0,0,.62)",
      }}
    >
      {glyph}
    </div>
  );
}

function Stat({
  value,
  label,
  divider,
}: {
  value: string;
  label: string;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        minWidth: 0,
      }}
    >
      {divider ? (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 10,
            width: 2,
            height: 76,
            backgroundColor: OG.line,
          }}
        />
      ) : null}
      <span
        style={{
          fontSize: 50,
          color: OG.text,
          fontFamily: "Inter",
          letterSpacing: -2,
        }}
      >
        {value}
      </span>
      <span
        style={{
          marginTop: 6,
          fontSize: 21,
          color: OG.mutedData,
          letterSpacing: 4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function handleSize(handle: string): number {
  const length = handle.length + 1;
  if (length <= 17) return 76;
  if (length <= 22) return 62;
  return 50;
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
        overflow: "hidden",
        padding: "48px 64px 38px",
        color: OG.text,
        fontFamily: "Barlow Condensed",
        backgroundColor: OG.bg,
        backgroundImage:
          "linear-gradient(180deg, #07090F 0%, #07101D 52%, #05070D 100%)",
        borderTop: `10px solid ${PINK}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
        }}
      >
        <HonorNeonStage />
      </div>

      <div
        style={{
          position: "absolute",
          top: 358,
          left: 70,
          display: "flex",
        }}
      >
        <NeonTrophy
          width={940}
          height={590}
          blue={BLUE}
          purple={PURPLE}
          pink={PINK_BRIGHT}
          core={PINK_INK}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 38,
            letterSpacing: 5,
            textTransform: "uppercase",
          }}
        >
          Sports Cappers Leaderboard
        </span>
        <span
          style={{
            marginTop: 2,
            fontSize: 19,
            letterSpacing: 7,
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
          marginTop: 32,
          textTransform: "uppercase",
          lineHeight: 0.92,
        }}
      >
        <span
          style={{
            fontSize: 112,
            color: OG.text,
            letterSpacing: 1,
            textShadow: "0 5px 20px rgba(0,0,0,.8)",
          }}
        >
          {line1}
        </span>
        <span
          style={{
            fontSize: 82,
            color: PINK_BRIGHT,
            letterSpacing: 1,
            textShadow: "0 0 24px rgba(208,0,160,.35)",
          }}
        >
          {line2}
        </span>
        <span
          style={{
            marginTop: 18,
            fontSize: 27,
            letterSpacing: 4,
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
          marginTop: 34,
        }}
      >
        <Emblem award={award} />
        <div
          style={{
            display: "flex",
            marginTop: -25,
            padding: "9px 38px 10px",
            border: "2px solid rgba(255,255,255,.18)",
            borderRadius: 8,
            backgroundColor: PINK,
            backgroundImage:
              "linear-gradient(180deg, #E016B6 0%, #C00092 58%, #990073 100%)",
            color: PINK_INK,
            boxShadow: "0 10px 28px rgba(0,0,0,.45)",
            fontSize: 39,
            textTransform: "uppercase",
          }}
        >
          {ribbon(award)}
        </div>
      </div>

      <span
        style={{
          marginTop: 30,
          maxWidth: 950,
          overflow: "hidden",
          padding: "5px 22px 8px",
          borderRadius: 8,
          backgroundColor: "rgba(5,9,17,.46)",
          fontSize: handleSize(winner.handle),
          lineHeight: 1,
          textAlign: "center",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          color: OG.text,
          textShadow: "0 4px 20px rgba(0,0,0,.95)",
        }}
      >
        @{winner.handle}
      </span>

      <div
        style={{
          display: "flex",
          width: "100%",
          marginTop: 18,
          padding: "18px 0 16px",
          borderTop: `2px solid ${OG.line}`,
          borderBottom: `2px solid ${OG.line}`,
          backgroundColor: "rgba(5,9,17,.46)",
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
          divider
        />
        <Stat value={formatRoi(winner.roi)} label="ROI" divider />
      </div>

      <span
        style={{
          marginTop: 23,
          maxWidth: 880,
          fontFamily: "Inter",
          fontSize: 28,
          lineHeight: 1.25,
          color: OG.mutedData,
          textAlign: "center",
        }}
      >
        {blurb(award)}
      </span>

      <span
        style={{
          marginTop: "auto",
          alignSelf: "center",
          fontSize: 23,
          letterSpacing: 7,
          color: OG.mutedData,
          textTransform: "uppercase",
          textShadow: "0 2px 8px rgba(0,0,0,.9)",
        }}
      >
        {host}
      </span>
    </div>
  );
}
