import { buildSparklinePath } from "@/lib/og/sparkline";
import { OG, type CapperOgPayload } from "@/lib/og/tokens";
import { hasSignal } from "@/lib/sample";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";

function unitsColor(units: number): string {
  if (units > 0) return OG.win;
  if (units < 0) return OG.loss;
  return OG.mutedData;
}

/**
 * JSX tree for the 1200×630 capper OG card (consumed by ImageResponse).
 * Intentionally inline styles — next/og does not support Tailwind.
 */
export function CapperOgCard({ data }: { data: CapperOgPayload }) {
  const showTrend = hasSignal(data.settledPicks);
  const spark = showTrend
    ? buildSparklinePath(data.performanceTrend, 520, 140, 10)
    : null;
  const sparkStroke =
    spark?.strokeTone === "win"
      ? OG.win
      : spark?.strokeTone === "loss"
        ? OG.loss
        : OG.mutedData;

  const handleLabel = data.handle.startsWith("@")
    ? data.handle
    : `@${data.handle}`;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: OG.bg,
        color: OG.text,
        padding: "48px 56px",
        fontFamily: "Barlow Condensed",
      }}
    >
      {/* Top row: lettermark + league chip */}
      <div
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 72,
            height: 72,
            borderRadius: 18,
            backgroundColor: OG.card,
            border: `1.5px solid ${OG.line}`,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: OG.text,
          }}
        >
          SCL
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 22px",
            borderRadius: 999,
            backgroundColor: OG.blue,
            color: OG.blueInk,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: "IBM Plex Mono",
          }}
        >
          {data.topSport || "MULTI"}
        </div>
      </div>

      {/* Handle + verified */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginTop: 36,
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
          }}
        >
          {handleLabel}
        </div>
        {data.verified ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 999,
              backgroundColor: "rgba(16, 95, 217, 0.18)",
              border: `1px solid ${OG.blue}`,
              color: OG.blue,
              fontSize: 22,
              fontWeight: 600,
              fontFamily: "IBM Plex Mono",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill={OG.blue} />
              <path
                d="M7.5 12.5l3 3 6-6"
                stroke={OG.blueInk}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Verified
          </div>
        ) : null}
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          width: "100%",
          gap: 48,
          marginTop: 40,
        }}
      >
        <Stat
          label="Record"
          value={formatRecord(data.record.w, data.record.l, data.record.p)}
          mono
        />
        <Stat
          label="Units"
          value={formatUnits(data.units)}
          color={unitsColor(data.units)}
          mono
        />
        <Stat label="ROI" value={formatRoi(data.roi)} mono />
      </div>

      {/* Sparkline or provisional */}
      <div
        style={{
          display: "flex",
          flex: 1,
          width: "100%",
          marginTop: 28,
          alignItems: "flex-end",
        }}
      >
        {showTrend && spark ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: OG.muted,
                fontFamily: "IBM Plex Mono",
              }}
            >
              Cumulative units
            </div>
            <svg
              width="520"
              height="140"
              viewBox="0 0 520 140"
              style={{ display: "flex" }}
            >
              <path
                d={`M10 130 H510`}
                stroke={OG.line}
                strokeWidth="2"
                fill="none"
              />
              <path
                d={spark.d}
                stroke={sparkStroke}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <circle
                cx={spark.lastX}
                cy={spark.lastY}
                r="7"
                fill={sparkStroke}
              />
            </svg>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "20px 28px",
              borderRadius: 14,
              border: `1.5px dashed ${OG.line}`,
              backgroundColor: OG.card,
              color: OG.mutedData,
              fontSize: 28,
              fontWeight: 600,
              fontFamily: "IBM Plex Mono",
              letterSpacing: "0.02em",
            }}
          >
            Provisional record
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  mono,
}: {
  label: string;
  value: string;
  color?: string;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: OG.muted,
          fontFamily: "IBM Plex Mono",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: color ?? OG.text,
          fontFamily: mono ? "IBM Plex Mono" : "Barlow Condensed",
          letterSpacing: mono ? "-0.02em" : "-0.03em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}
