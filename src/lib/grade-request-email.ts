/**
 * The email SCL support receives when a capper sends a regrade or
 * injury-protection request. Pure — rendered separately from the sender so the
 * content (every pre-populated field, both admin links, escaping) is tested.
 */
import type { GradeRequestType } from "@prisma/client";

import { adminGradingHref } from "@/lib/admin-grading-link";
import { escapeHtml } from "@/lib/email-escape";
import {
  clipForSubject,
  formatRequestDateTime,
  formatRequestGameDate,
  GRADE_REQUEST_SUBJECT,
  legLine,
  outcomeLabel,
  resultLabel,
  type GradeRequestPickDetails,
} from "@/lib/grade-requests";

export type GradeRequestEmailInput = {
  requestId: string;
  type: GradeRequestType;
  capper: {
    handle: string | null;
    displayName: string | null;
    email: string;
    userId: string;
  };
  details: GradeRequestPickDetails;
  /** Parlay only: the leg the capper named. */
  legId: string | null;
  commentary: string;
  submittedAt: Date;
};

export const ADMIN_GRADE_REQUEST_QUEUE_PATH = "/admin/grading/requests";

/** The pick correction screen, scrolled to this request. */
export function adminGradeRequestPath(input: {
  requestId: string;
  kind: "straight" | "parlay";
  pickId: string;
}): string {
  const base = adminGradingHref(
    input.kind === "parlay"
      ? { id: input.pickId, parlayId: input.pickId }
      : { id: input.pickId, parlayId: null },
  );
  return `${base}?request=${encodeURIComponent(input.requestId)}#capper-requests`;
}

function handleOf(handle: string | null): string | null {
  const clean = handle?.trim().replace(/^@/, "");
  return clean ? `@${clean}` : null;
}

export function renderGradeRequestEmail(
  input: GradeRequestEmailInput,
  appUrl: string,
) {
  const { details } = input;
  const subjectLine = GRADE_REQUEST_SUBJECT[input.type];
  const handle = handleOf(input.capper.handle);
  const who = handle ?? input.capper.displayName ?? input.capper.email;
  const leg = input.legId
    ? (details.legs.find((candidate) => candidate.id === input.legId) ?? null)
    : null;
  const legNumber = leg ? details.legs.indexOf(leg) + 1 : null;
  const gameDate = formatRequestGameDate(details.eventStartsAt);
  const subjectPick = leg
    ? `${details.title} — ${leg.selection}`
    : details.title;
  const subject = `${subjectLine} — ${who} — ${clipForSubject(subjectPick, 70)}${gameDate ? ` (${gameDate})` : ""}`;

  const correctionUrl = `${appUrl}${adminGradeRequestPath({
    requestId: input.requestId,
    kind: details.kind,
    pickId: details.id,
  })}`;
  const queueUrl = `${appUrl}${ADMIN_GRADE_REQUEST_QUEUE_PATH}`;
  const profileUrl = handle
    ? `${appUrl}/cappers/${encodeURIComponent(handle.slice(1))}`
    : null;

  const rows: [string, string][] = [
    ["Request", subjectLine],
    ["Capper", handle ?? "No handle"],
    ...(input.capper.displayName && input.capper.displayName !== handle
      ? ([["Name", input.capper.displayName]] as [string, string][])
      : []),
    ["Capper email", input.capper.email],
    ["Pick", details.title],
    ...(leg && legNumber
      ? ([["Leg in question", `Leg ${legNumber}: ${legLine(leg)}`]] as [
          string,
          string,
        ][])
      : details.kind === "parlay"
        ? ([["Leg in question", "Whole ticket"]] as [string, string][])
        : []),
    ...(details.market && details.kind === "straight"
      ? ([["Market", details.market]] as [string, string][])
      : []),
    ...(details.sport
      ? ([
          [
            "Sport",
            details.league && details.league !== details.sport
              ? `${details.sport} · ${details.league}`
              : details.sport,
          ],
        ] as [string, string][])
      : []),
    ...(details.matchup
      ? ([["Matchup", details.matchup]] as [string, string][])
      : []),
    ["Odds", details.odds],
    ["Stake", details.stake],
    ...(details.book ? ([["Book", details.book]] as [string, string][]) : []),
    ["Game date", gameDate ?? "Not recorded"],
    ["Logged", formatRequestDateTime(details.loggedAt) ?? "—"],
    ["Result on record", resultLabel(details.outcome, details.profitUnits)],
    ["Pick ID", details.id],
    ["Request ID", input.requestId],
    ["Submitted", formatRequestDateTime(input.submittedAt) ?? "—"],
  ];

  const legsHtml =
    details.kind === "parlay" && details.legs.length
      ? `<p style="margin:16px 0 4px;color:#666">Legs</p>
          <ol style="margin:0;padding-left:20px">${details.legs
            .map(
              (candidate) =>
                `<li style="margin:2px 0${candidate.id === input.legId ? ";font-weight:700" : ""}">${escapeHtml(legLine(candidate))} — ${escapeHtml(outcomeLabel(candidate.outcome))}</li>`,
            )
            .join("")}</ol>`
      : "";

  const button = (href: string, label: string, primary: boolean) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 18px;border-radius:8px;text-decoration:none;${
      primary
        ? "background:#5b4bdb;color:#fff"
        : "background:#fff;color:#5b4bdb;border:1px solid #5b4bdb"
    }">${escapeHtml(label)}</a>`;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:640px;margin:auto">
      <h2 style="margin-bottom:4px">${escapeHtml(subjectLine)}</h2>
      <p style="margin-top:0;color:#666">${escapeHtml(who)} is asking SCL to review a graded pick.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`,
          )
          .join("")}
      </table>
      ${legsHtml}
      <p style="margin:20px 0 4px;color:#666">Capper commentary</p>
      <blockquote style="margin:0 0 20px;padding:12px 16px;border-left:3px solid #5b4bdb;background:#f6f5ff;white-space:pre-wrap">${escapeHtml(input.commentary)}</blockquote>
      <p>
        ${button(correctionUrl, "Open pick correction screen", true)}
        ${button(queueUrl, "All open requests", false)}
      </p>
      <p style="color:#666;font-size:13px">
        On the correction screen you can apply the result to this capper only, or to every capper who logged the same pick — straight bets and parlays are re-settled together.
        Reply to this email to answer ${escapeHtml(who)} directly.${
          profileUrl
            ? ` Public profile: <a href="${escapeHtml(profileUrl)}">${escapeHtml(profileUrl)}</a>`
            : ""
        }
      </p>
    </div>
  `;

  const text = [
    subjectLine,
    `${who} is asking SCL to review a graded pick.`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...(details.kind === "parlay"
      ? [
          "",
          "Legs:",
          ...details.legs.map(
            (candidate, index) =>
              `${index + 1}. ${legLine(candidate)} — ${outcomeLabel(candidate.outcome)}${candidate.id === input.legId ? "  <-- in question" : ""}`,
          ),
        ]
      : []),
    "",
    "Capper commentary:",
    input.commentary,
    "",
    `Open pick correction screen: ${correctionUrl}`,
    `All open requests: ${queueUrl}`,
  ].join("\n");

  return { subject, html, text, correctionUrl, queueUrl };
}
