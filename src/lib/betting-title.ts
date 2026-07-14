/**
 * Split a pick/selection string so numeric betting tokens can use IBM Plex Mono
 * while team/market words keep display type (SCL-DESIGN-SPEC data typography).
 */
const BETTING_NUM_RE = /([+-]?\d+(?:\.\d+)?(?:u)?)/g;

export type BettingTitlePart =
  | { kind: "text"; value: string }
  | { kind: "num"; value: string };

export function splitBettingTitle(text: string): BettingTitlePart[] {
  const parts: BettingTitlePart[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(BETTING_NUM_RE.source, "g");

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ kind: "text", value: text.slice(last, match.index) });
    }
    parts.push({ kind: "num", value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ kind: "text", value: text.slice(last) });
  }
  return parts.length ? parts : [{ kind: "text", value: text }];
}
