import {
  AnnualMark,
  HelmetIcon,
  HoopIcon,
  honorEmoji,
} from "@/components/scl/honor-icons";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";
import { ALL_SPORTS, SUPERMAX, type HonorAward } from "@/lib/honors";
import { OG } from "@/lib/og/tokens";
import { CROSS_SPORTS } from "@/lib/parlay-sport";

export const HONOR_OG_SIZE = { width: 1080, height: 1350 } as const;
export const HONOR_OG_VERSION = "20261017c";
/** Display widths `/api/og/honor/[id]?w=` serves for on-site cards. */
export const HONOR_GRAPHIC_WIDTHS = [360, 540, 720] as const;

const PINK = "#D000A0";
const PINK_BRIGHT = "#FF65CB";
const PINK_INK = "#FFF3FC";
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
    // The ribbon right below names the period; repeating it here pushed the
    // line past the cup's walls.
    return "Highest net units from Supermax plays";
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

/**
 * Lucide Link, pink like the annual marks. The 🔗 emoji is mid-grey and all
 * but vanished on the dark emblem.
 */
function CrossSportsMark({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={PINK_BRIGHT}
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function Emblem({ award }: { award: HonorAward }) {
  const glyph =
    award.sport === ALL_SPORTS ? (
      <AnnualMark metric={award.metric} size={160} color={PINK_BRIGHT} />
    ) : award.sport === CROSS_SPORTS ? (
      <CrossSportsMark size={156} />
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
        backgroundImage:
          "radial-gradient(circle at 50% 38%, #1D2A44 0%, #111A2A 58%, #0A101C 100%)",
        boxShadow:
          "0 0 0 4px rgba(255,101,203,.2), 0 0 44px rgba(208,0,160,.48), 0 16px 36px rgba(0,0,0,.62)",
      }}
    >
      {glyph}
    </div>
  );
}

/**
 * One size for all three stats, stepped down by the longest value: a third of
 * the band is ~317px, which a 12-character record (`1201-1088-44`) overflows
 * at full size.
 */
function statSize(values: string[]): number {
  const longest = Math.max(...values.map((v) => v.length));
  if (longest <= 8) return 58;
  if (longest <= 10) return 52;
  if (longest <= 11) return 47;
  return 42;
}

function Stat({
  value,
  label,
  size,
  divider,
}: {
  value: string;
  label: string;
  size: number;
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
        height: 96,
      }}
    >
      {divider ? (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 8,
            width: 2,
            height: 80,
            backgroundColor: OG.line,
          }}
        />
      ) : null}
      <span
        style={{
          fontSize: size,
          lineHeight: 1.05,
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
          fontSize: 24,
          color: OG.mutedData,
          letterSpacing: 5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * The subtitle sits between the cup's walls (~560px) and runs from 26
 * characters (`Highest ROI% · 2025-26 season`) to 52 (Supermax), so it steps
 * down rather than spilling across the neon.
 */
function subtitleStyle(text: string): {
  fontSize: number;
  letterSpacing: number;
} {
  if (text.length <= 30) return { fontSize: 30, letterSpacing: 3 };
  if (text.length <= 38) return { fontSize: 27, letterSpacing: 2.5 };
  if (text.length <= 46) return { fontSize: 24, letterSpacing: 2 };
  return { fontSize: 22, letterSpacing: 1.5 };
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
  plate,
}: {
  award: HonorAward;
  host: string;
  /** Background artwork as a data URL — see `loadHonorPlate`. */
  plate: string;
}) {
  const [line1, line2] = titleLines(award);
  const { winner } = award;
  const units = formatUnits(winner.units);
  const record = formatRecord(
    winner.record.w,
    winner.record.l,
    winner.record.p,
  );
  const roi = formatRoi(winner.roi);
  const size = statSize([units, record, roi]);
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
        padding: "80px 64px 38px",
        color: OG.text,
        fontFamily: "Barlow Condensed",
        backgroundColor: OG.bg,
        backgroundImage:
          "linear-gradient(180deg, #07090F 0%, #07101D 52%, #05070D 100%)",
        borderTop: `10px solid ${PINK}`,
      }}
    >
      {/* The owner's neon trophy and stage artwork (text removed), laid out
          so the emblem sits in the cup and the stats sit above the stage. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain img */}
      <img
        src={plate}
        alt=""
        width={HONOR_OG_SIZE.width}
        height={HONOR_OG_SIZE.height - 10}
        style={{ position: "absolute", top: 0, left: 0 }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 40,
            letterSpacing: 5,
            textTransform: "uppercase",
            textShadow: "0 2px 14px rgba(0,0,0,.95)",
          }}
        >
          Sports Cappers Leaderboard
        </span>
        <span
          style={{
            marginTop: 2,
            fontSize: 22,
            letterSpacing: 6,
            color: OG.mutedData,
            textTransform: "uppercase",
            textShadow: "0 2px 10px rgba(0,0,0,.95)",
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
            textShadow:
              "0 4px 18px rgba(0,0,0,.9), 0 0 24px rgba(208,0,160,.35)",
          }}
        >
          {line2}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            height: 46,
            marginTop: 16,
            padding: "0 20px 1px",
            borderRadius: 8,
            backgroundColor: "rgba(5,9,17,.62)",
            lineHeight: 1,
            color: OG.mutedData,
            ...subtitleStyle(subtitle(award)),
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
          marginTop: 30,
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

      {/* Fixed height: a long handle steps its type down, and the stats
          below must still land on the stage whatever the handle's size. */}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          height: 90,
          marginTop: 20,
          maxWidth: 950,
          overflow: "hidden",
          padding: "0 22px 3px",
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
          padding: "16px 0 14px",
          borderTop: `2px solid ${OG.line}`,
          borderBottom: `2px solid ${OG.line}`,
          backgroundColor: "rgba(5,9,17,.46)",
        }}
      >
        <Stat value={units} label="Units" size={size} />
        <Stat value={record} label="Record" size={size} divider />
        <Stat value={roi} label="ROI" size={size} divider />
      </div>

      <span
        style={{
          marginTop: 20,
          maxWidth: 900,
          fontFamily: "Inter",
          fontSize: 30,
          lineHeight: 1.22,
          color: OG.mutedData,
          textAlign: "center",
          textShadow: "0 2px 12px rgba(0,0,0,.9)",
        }}
      >
        {blurb(award)}
      </span>

      <span
        style={{
          marginTop: "auto",
          alignSelf: "center",
          fontSize: 25,
          letterSpacing: 6,
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
