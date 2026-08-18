#!/usr/bin/env python3
"""Convert the legacy cPanel MySQL export into the legacy-import JSON contract.

    python scripts/extract-legacy-mysql.py \
        --site   ~/Downloads/scleaderboard_sclsite.sql \
        --records ~/Downloads/scleaderboard_sclsite_records.sql \
        --out    prisma/legacy-cappers.json

Output validates against `src/lib/schemas/legacy-import.schema.ts` and is fed to
`npm run db:import-legacy -- prisma/legacy-cappers.json`. See docs/LEGACY_MIGRATION.md.

The legacy stake convention is the one thing worth knowing before reading this:
`Units` is the amount the capper played *to win*, not the amount risked. The real
stake is `urisk` (verified: it equals risk-to-win(Units, odds) on 4432/4433 rows)
and the realized profit is `uret` (equals -urisk on 100% of losses, and
payout(urisk, odds) on 100% of wins). We therefore map units<-urisk and
profitUnits<-uret; using `Units` as the stake would understate every favorite's
risk and inflate ROI across the board.
"""

from __future__ import annotations

import argparse
import html as _html_mod
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta

# --------------------------------------------------------------------------
# MySQL dump reader (phpMyAdmin/cPanel dialect)
# --------------------------------------------------------------------------

_ESCAPES = {"0": "\0", "b": "\b", "n": "\n", "r": "\r",
            "t": "\t", "Z": "\x1a", "\\": "\\", "'": "'", '"': '"'}
_INSERT_RE = re.compile(r"INSERT INTO `([^`]+)`\s*\(([^)]*)\)\s*VALUES", re.I)


def _scan_rows(txt: str, i: int):
    rows, n = [], len(txt)
    while i < n:
        while i < n and txt[i] in " \t\r\n,":
            i += 1
        if i >= n or txt[i] == ";":
            return rows, i + 1
        if txt[i] != "(":
            return rows, i
        i += 1
        vals, cur, quoted = [], [], False

        def flush():
            raw = "".join(cur)
            if quoted:
                vals.append(raw)
            else:
                s = raw.strip()
                vals.append(None if s.upper() == "NULL" else s)

        while i < n:
            c = txt[i]
            if c == "'":
                # Whitespace before the opening quote is dump formatting.
                if not quoted and not "".join(cur).strip():
                    cur = []
                quoted = True
                i += 1
                while i < n:
                    c2 = txt[i]
                    if c2 == "\\" and i + 1 < n:
                        cur.append(_ESCAPES.get(txt[i + 1], txt[i + 1]))
                        i += 2
                        continue
                    if c2 == "'":
                        if i + 1 < n and txt[i + 1] == "'":
                            cur.append("'")
                            i += 2
                            continue
                        i += 1
                        break
                    cur.append(c2)
                    i += 1
                continue
            if c == ",":
                flush()
                cur, quoted = [], False
                i += 1
                continue
            if c == ")":
                flush()
                i += 1
                break
            cur.append(c)
            i += 1
        rows.append(vals)
    return rows, i


def parse_dump(path: str) -> dict:
    txt = open(path, encoding="utf-8", errors="replace").read()
    out: dict = {}
    for m in _INSERT_RE.finditer(txt):
        table = m.group(1)
        cols = [c.strip().strip("`") for c in m.group(2).split(",")]
        rows, _ = _scan_rows(txt, m.end())
        entry = out.setdefault(table, {"cols": cols, "rows": [], "malformed": 0})
        good = [r for r in rows if len(r) == len(cols)]
        entry["rows"].extend(dict(zip(cols, r)) for r in good)
        entry["malformed"] += len(rows) - len(good)
    return out


def rows(dump: dict, table: str) -> list[dict]:
    return dump.get(table, {}).get("rows", [])


# --------------------------------------------------------------------------
# Mapping tables
# --------------------------------------------------------------------------

# Legacy per-sport opt-in flags on `cappers` -> canonical SPORT_KEYS.
SPORT_FLAGS = {
    "nfl": "NFL", "ncaaf": "NCAAF", "cfl": "CFL", "ufl": "UFL",
    "nba": "NBA", "ncaab": "NCAAB", "wnba": "WNBA", "mlb": "MLB",
    "nhl": "NHL", "soccer": "SOCCER", "nascar": "NASCAR", "mma": "MMA",
    "boxing": "BOXING", "tennis": "TENNIS", "golf": "PGA",
}
# The `Sport` value written on picks (differs from the flag names).
SPORT_VALUES = {
    "NFL": "NFL", "NCAAF": "NCAAF", "CFL": "CFL", "UFL": "UFL",
    "NBA": "NBA", "NCAAB": "NCAAB", "WNBA": "WNBA", "MLB": "MLB",
    "NHL": "NHL", "SOCCER": "SOCCER", "NASCAR": "NASCAR", "MMA": "MMA",
    "BOXING": "BOXING", "TENNIS": "TENNIS", "GOLF": "PGA",
}
BET_TYPES = {
    "straight bets": "STRAIGHT", "parlays": "PARLAY", "prop bets": "PROP",
    "teaser bets": "TEASER", "totals": "TOTAL",
}
# Legacy `cappers_profiles.bet_vol` reads like "MODERATE (6-10 PICKS)".
DAILY_VOLUMES = {
    "low": "LOW", "moderate": "MODERATE", "high": "HIGH", "very high": "VERY_HIGH",
}
OUTCOMES = {"W": "WIN", "L": "LOSS", "P": "PUSH"}

# Legacy stat tables -> LegacyRecordScope. The names are misleading and were
# decoded by matching stored totals against the live pages: `stats1` drives
# current-year.php (it is the current YEAR, not one day) and `stats_current`
# drives current-season.php. `stats90` matched past-90days.php.
SCOPE_TABLES = {
    "stats_current": "CURRENT_SEASON",
    "stats1": "CURRENT_YEAR",
    "y2025": "YEAR_2025",
    "s2025": "SEASON_2025",
    # Mapped but EMPTY in every export to date: y2024 (120 rows), s2024 (111)
    # and stats_post (111) each carry one scaffolding row per capper with the
    # name filled and every counter at zero -- 0 settled results between them.
    # stat_cell returns None for an all-zero row, so these emit nothing today.
    # Wired up so the data flows if the source ever starts recording it.
    "y2024": "YEAR_2024",
    "s2024": "SEASON_2024",
    "stats_post": "POSTSEASON",
    "stats90": "LAST_90D",
    "stats60": "LAST_60D",
    "stats30": "LAST_30D",
    "stats7": "LAST_7D",
}
# Per-sport column prefixes inside those tables (GOLF is PGA in the new taxonomy).
STAT_SPORTS = {
    "NFL": "NFL", "NCAAF": "NCAAF", "NBA": "NBA", "NCAAB": "NCAAB",
    "WNBA": "WNBA", "MMA": "MMA", "MLB": "MLB", "NHL": "NHL",
    "SOCCER": "SOCCER", "NASCAR": "NASCAR", "CFL": "CFL", "UFL": "UFL",
    "BOXING": "BOXING", "TENNIS": "TENNIS", "GOLF": "PGA",
}
ALL_SPORTS = "ALL"  # sentinel for the combined total (matches LeaderboardFilters)
STANDINGS_BASELINE_SCOPE = "CURRENT_YEAR"

# Legacy stores local event time with no zone. Every row in the export falls in
# 2026-04-18..2026-07-29, entirely inside US Eastern daylight time (UTC-4), so a
# fixed offset is exact here rather than an approximation. Asserted below.
ET_OFFSET = "-04:00"
DST_WINDOW = ("2026-03-08", "2026-11-01")

_STAT_WORDS = (
    "pts", "points", "reb", "rebound", "ast", "assist", "strikeout", "so ",
    "ks", "bases", "hits", "goals", "saves", "yards", "td", "receptions",
    "steals", "blocks", "runs",
)


def classify_custom(pick: str, sport: str) -> str:
    """Market label for a free-text (CP) pick.

    Deliberately high-precision: anything that isn't an obvious pattern lands on
    "Custom" rather than being guessed at. The full original text is always kept
    verbatim in `selection`, so nothing is lost by declining to classify.
    """
    t = (pick or "").strip()
    low = t.lower()
    if "dfs" in low:
        return "DFS"
    if re.search(r"\b(f5|1st 5|first five)\b", low):
        return "First Five Innings"
    # "And"/"+" joins two legs -> a parlay, not a single market.
    if re.search(r"\b(and|\+)\b.*\b(ml|u\d|o\d|over|under|total)\b", low):
        return "Parlay"
    # Player prop: an over/under number next to a stat word.
    if re.search(r"[ou]\s?\d+(\.\d+)?", low) and any(w in low for w in _STAT_WORDS):
        return "Player Prop"
    if re.search(r"\b(over|under)\b\s*\d+(\.\d+)?$", low) or re.fullmatch(
        r"[a-z /]*[ou]\s?\d+(\.\d+)?", low
    ):
        return "Total"
    # Team followed by a whole/half-point handicap.
    if re.search(r"[+-]\d+(\.\d+)?\b", t) and not re.search(r"[+-]\d{3,}", t):
        return "Run Line" if sport == "MLB" else "Spread"
    # Bare team name, or team + a 3-digit American price.
    if re.fullmatch(r"[A-Za-z .'\-]+([+-]\d{3,})?", t):
        return "Moneyline"
    return "Custom"


def market_for(ptype: str, pick: str, sport: str) -> str:
    if ptype == "ML":
        return "Moneyline"
    if ptype == "TO":
        return "Total"
    if ptype == "RL":
        return "Run Line" if sport == "MLB" else "Spread"
    return classify_custom(pick, sport)


def selection_for(ptype: str, pick: str, pts) -> str:
    """Fold the line into the selection text — the import contract has no `line`."""
    pick = (pick or "").strip()
    if ptype in ("TO", "RL") and pts is not None:
        try:
            n = float(pts)
        except (TypeError, ValueError):
            return pick[:120]
        if n:
            num = f"{n:g}"
            if ptype == "TO":  # "Over" + 8.5 -> "Over 8.5"
                return f"{pick} {num}"[:120]
            return f"{pick} {n:+g}"[:120]  # team + signed handicap
    return pick[:120]


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# --------------------------------------------------------------------------
# Storefront packages (legacy `aff_subscriptions`)
# --------------------------------------------------------------------------

_PERIOD_PATTERNS = [
    (r"/\s*day|per\s+day|\bdaily\b|\b1\s*day\b", "DAY"),
    (r"/\s*w(?:k|eek)|per\s+week|\bweekly\b|\b(?:3|5|7)\s*days?\b", "WEEK"),
    (r"/\s*mo(?:nth)?|per\s+month|\bmonthly\b|\b30\s*days?\b", "MONTH"),
    (r"\bseason\b|\bplayoffs?\b", "SEASON"),
    (r"/\s*(?:yr|year)|per\s+year|\byearly\b|\bannual\b", "YEAR"),
]


def html_to_text(raw: str | None) -> str:
    """Legacy descriptions are HTML, double-escaped by the dump."""
    s = _html_mod.unescape(_html_mod.unescape(raw or ""))
    s = re.sub(r"<br\s*/?>|</p>|</div>|</h\d>", " \n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = _html_mod.unescape(s)
    # Repair encoding BEFORE touching \xa0. 0xA0 is a legitimate UTF-8
    # continuation byte — 🧠 is F0 9F A7 A0 — so collapsing it to a space first
    # truncates the sequence and leaves the emoji unrecoverable.
    s = demojibake(s) or ""
    s = s.replace("\xa0", " ")
    return re.sub(r"[ \t]+", " ", s).strip()


def parse_package_price(text: str) -> tuple[int, str, bool]:
    """(cents, billingPeriod, confident).

    A description may quote several prices ("$5/week or $15/month"); the first
    is taken and the row is marked unconfident so a human can confirm it. When
    no price is found cents is 0, which renders no price label at all rather
    than claiming the offer is free — the checkout page remains authoritative.
    """
    prices = re.findall(r"\$\s?(\d{1,5}(?:\.\d{1,2})?)", text)
    low = text.lower()

    period = "MONTH"
    for pat, name in _PERIOD_PATTERNS:
        if re.search(pat, low):
            period = name
            break

    if not prices:
        return 0, period, False
    cents = int(round(float(prices[0]) * 100))
    # More than one distinct non-zero price means the offer bundles tiers.
    distinct = {p for p in prices if float(p) > 0}
    return cents, period, len(distinct) <= 1


def store_provider(checkout_url: str) -> str | None:
    """Which storefront the offer checks out on, from its host.

    Drives the package CTA ("Subscribe on Whop" vs "Subscribe on Winible") and
    the storefront badge, so a missed host silently degrades to a generic
    "Subscribe" button.
    """
    host = checkout_url.lower()
    if "winible.com" in host:
        return "WINIBLE"
    if "whop.com" in host:
        return "WHOP"
    return None


def parse_package_title(text: str) -> str:
    """Leading label before the price/colon; falls back to the first few words."""
    head = text.split("\n")[0].strip()
    if ":" in head[:70]:
        title = head.split(":", 1)[0]
    elif "$" in head:
        title = head.split("$", 1)[0]
    else:
        title = " ".join(head.split()[:7])
    title = re.sub(r"[\s\-–—•|]+$", "", title.strip())
    return clip(title or "Package", 100)


def stat_cell(row: dict, prefix: str, warn: Counter | None = None) -> dict | None:
    """One (sport | total) slice of a legacy stats row, or None if unusable.

    The legacy accumulator is not always sound — some slices carry a NEGATIVE
    count (a regrade decrementing twice), which is not a number of results but a
    bug. Those are floored at zero so the valid part of the slice survives, and
    counted so a run never hides it.
    """
    def count(suffix: str) -> int:
        n = int(num(row.get(f"{prefix}_{suffix}")) or 0)
        if n < 0:
            if warn is not None:
                warn[f"negative {suffix} count in legacy stats — floored to 0"] += 1
            return 0
        return n

    w, l, p = count("w"), count("l"), count("p")
    if w + l + p <= 0:
        return None

    risk = round(num(row.get(f"{prefix}_ur")) or 0.0, 2)
    if risk <= 0:
        # Push-only slices are recorded with no accumulated risk (the stake is
        # returned), so they carry neither a W/L record nor a computable ROI.
        # Decided results with no risk are a genuine source error. Both are
        # dropped rather than stored as a row the app can't reason about.
        if warn is not None:
            warn[
                "push-only slice with no risk — dropped"
                if w + l == 0
                else "decided results with no units risked — dropped"
            ] += 1
        return None

    units_net = round(num(row.get(f"{prefix}_ue")) or 0.0, 2)
    if w + l == 0 and units_net != 0:
        if warn is not None:
            warn["push-only slice with nonzero net units — normalized to 0"] += 1
        units_net = 0.0

    return {
        "wins": w, "losses": l, "pushes": p,
        "unitsRisked": risk,
        "unitsNet": units_net,
    }


def sub_cell(
    total: dict, imported: dict | None, warn: Counter | None = None
) -> dict | None:
    """total - imported, clamped at zero. The residual is the pre-import history
    we hold no picks for; clamping guards the handful of cappers where recovered
    `past_plays` rows push the imported side slightly past the legacy window."""
    if not imported:
        return dict(total)
    out = {
        "wins": max(0, total["wins"] - imported["wins"]),
        "losses": max(0, total["losses"] - imported["losses"]),
        "pushes": max(0, total["pushes"] - imported["pushes"]),
        "unitsRisked": round(max(0.0, total["unitsRisked"] - imported["unitsRisked"]), 2),
        "unitsNet": round(total["unitsNet"] - imported["unitsNet"], 2),
    }
    if out["wins"] + out["losses"] + out["pushes"] == 0:
        return None
    if out["wins"] + out["losses"] == 0 and out["unitsNet"] != 0:
        if warn is not None:
            warn["push-only residual with nonzero net units — normalized to 0"] += 1
        out["unitsNet"] = 0.0
    # Same rule as `stat_cell`: a residual the app can't compute ROI from is
    # not worth storing, and must never reach the leaderboard baseline.
    if out["unitsRisked"] <= 0:
        return None
    return out


def totals_from_plays(plays: list[dict], sport: str | None = None) -> dict | None:
    """Aggregate imported plays the same way `computeCapperStats` does."""
    sel = plays if sport is None else [p for p in plays if p["sport"] == sport]
    w = sum(1 for p in sel if p["outcome"] == "WIN")
    l = sum(1 for p in sel if p["outcome"] == "LOSS")
    p_ = sum(1 for p in sel if p["outcome"] == "PUSH")
    if w + l + p_ == 0:
        return None
    return {
        "wins": w, "losses": l, "pushes": p_,
        "unitsRisked": round(sum(p["units"] for p in sel), 2),
        "unitsNet": round(sum(p.get("profitUnits", 0.0) for p in sel), 2),
    }


def pre_import_entries(
    scoped: dict[str, dict], acct: str, plays: list[dict], warn: Counter
) -> list[dict]:
    """Build the non-overlapping calendar-year residual used by standings."""
    current_year = scoped.get(STANDINGS_BASELINE_SCOPE, {}).get(acct)
    if not current_year:
        return []

    entries = []
    for prefix, sport in [("TOT", ALL_SPORTS), *STAT_SPORTS.items()]:
        total = stat_cell(current_year, prefix, warn)
        if not total:
            continue
        imported = totals_from_plays(
            plays, None if sport == ALL_SPORTS else sport
        )
        residual = sub_cell(total, imported, warn)
        if residual:
            entries.append({"scope": "PRE_IMPORT", "sport": sport, **residual})
    return entries


def event_iso(rdate: str, ltime) -> str | None:
    """Legacy Rdate + Ltime (military int, e.g. 2100) -> ISO 8601 with offset."""
    if not rdate:
        return None
    try:
        datetime.strptime(rdate, "%Y-%m-%d")
    except ValueError:
        return None
    hh, mm = 12, 0
    n = num(ltime)
    if n is not None and 0 <= n <= 2359:
        hh, mm = int(n) // 100, int(n) % 100
        if hh > 23 or mm > 59:
            hh, mm = 12, 0
    return f"{rdate}T{hh:02d}:{mm:02d}:00{ET_OFFSET}"


# UTF-8 text that was stored through a latin-1/cp1252 column comes back as a run
# of Latin-1/cp1252 characters: 🔥 becomes "ðŸ”¥", ✅ becomes "âœ…".
#
# The legacy descriptions are MIXED — corrupted runs sit alongside characters
# that were stored correctly (— • –), so re-encoding the whole string always
# fails on one of the good ones. Repair each run on its own instead.
# Reverse cp1252 table, falling back to the identity mapping for 0x00-0xFF so
# byte values cp1252 leaves undefined (0x81, 0x8D, 0x8F, 0x90, 0x9D) still round-trip.
_CP1252_TO_BYTE: dict[str, int] = {chr(b): b for b in range(256)}
for _b in range(0x80, 0xA0):
    try:
        _CP1252_TO_BYTE[bytes([_b]).decode("cp1252")] = _b
    except UnicodeDecodeError:
        pass

# Derive the character classes from that table rather than hand-listing them.
# cp1252 maps 0x80-0x9F to scattered code points (0x9C is the ligature, 0x85 an
# ellipsis), and a hand-written class is far too easy to get subtly wrong — one
# missing character silently leaves a whole emoji unrepaired.
_LEAD_CHARS = "".join(ch for ch, b in _CP1252_TO_BYTE.items() if 0xC2 <= b <= 0xF4)
_CONT_CHARS = "".join(ch for ch, b in _CP1252_TO_BYTE.items() if 0x80 <= b <= 0xBF)
_MOJI_RUN = re.compile(f"[{re.escape(_LEAD_CHARS)}][{re.escape(_CONT_CHARS)}]+")


def demojibake(s: str | None) -> str | None:
    """Undo UTF-8-read-as-cp1252 corruption, run by run."""
    if not s:
        return s

    def fix(m: re.Match[str]) -> str:
        run = m.group(0)
        # Decode the longest valid prefix rather than all-or-nothing. The run is
        # matched greedily, so it can absorb a trailing character that is not
        # part of the sequence — an &nbsp; unescapes to  , which is a legal
        # UTF-8 continuation byte, and swallowing it turns a good 3-byte emoji
        # into an invalid 4-byte one. Shrinking from the end recovers the emoji
        # and leaves the stray character alone.
        #
        # A run can also mix cp1252-only characters (0x9F) with byte values
        # cp1252 leaves undefined (0x8F), so bytes are recovered individually.
        for end in range(len(run), 1, -1):
            seg = run[:end]
            try:
                raw = bytes(_CP1252_TO_BYTE[ch] for ch in seg)
            except KeyError:
                continue
            try:
                decoded = raw.decode("utf-8")
            except UnicodeDecodeError:
                continue
            if "�" in decoded:
                continue
            return decoded + run[end:]
        return run

    return _MOJI_RUN.sub(fix, s)


def clip(s: str, limit: int) -> str:
    """Truncate to `limit` UTF-16 code units, which is what the Zod contracts
    count. Python slices by code point, so an emoji (one code point, two UTF-16
    units) would silently push a repaired string past a JS-side max."""
    if not s:
        return s
    out = []
    used = 0
    for ch in s:
        w = 2 if ord(ch) > 0xFFFF else 1
        if used + w > limit:
            break
        out.append(ch)
        used += w
    return "".join(out)


def clean(v) -> str | None:
    s = demojibake((v or "").strip())
    return s or None


# --------------------------------------------------------------------------
# Legacy credentials
# --------------------------------------------------------------------------

# Column names PHP stacks of this era used for the stored credential. The dump
# decides which one exists; --password-column overrides when it is named oddly.
PASSWORD_COLUMNS = ("pass", "password", "passwd", "pwd", "pword",
                    "user_pass", "userpass", "upass", "login_pass")

# Mirrors detectLegacyPasswordFormat() in src/lib/legacy-password.ts. A hash we
# cannot classify here is one login cannot verify either, so it is dropped (and
# counted) rather than imported as a credential that can never work.
_BCRYPT_RE = re.compile(r"^\$2[aby]?\$\d{2}\$.{53}$")
_PHPASS_RE = re.compile(r"^\$[PH]\$.{31}$")
_HEX_RE = re.compile(r"^[0-9a-fA-F]+$")
_HEX_FORMATS = {32: "MD5", 40: "SHA1", 64: "SHA256"}


def detect_password_format(value: str) -> str | None:
    v = (value or "").strip()
    if not v:
        return None
    if _BCRYPT_RE.match(v):
        return "BCRYPT"
    if _PHPASS_RE.match(v):
        return "PHPASS"
    if _HEX_RE.match(v):
        return _HEX_FORMATS.get(len(v))
    return None


def resolve_password_column(dump: dict, override: str | None) -> str | None:
    cols = dump.get("cappers", {}).get("cols", [])
    if override:
        return override if override in cols else None
    lower = {c.lower(): c for c in cols}
    for candidate in PASSWORD_COLUMNS:
        if candidate in lower:
            return lower[candidate]
    return None


# --------------------------------------------------------------------------
# Extraction
# --------------------------------------------------------------------------

def build_play(r: dict, acct_key: str, warn: Counter) -> dict | None:
    sport_raw = (r.get("Sport") or "").strip().upper()
    sport = SPORT_VALUES.get(sport_raw)
    if not sport:
        warn[f"unknown sport {sport_raw!r}"] += 1
        return None

    outcome = OUTCOMES.get((r.get("Results") or "").strip().upper())
    if not outcome:
        warn[f"unknown result {r.get('Results')!r}"] += 1
        return None

    odds = num(r.get("Value"))
    stake = num(r.get("urisk"))
    profit = num(r.get("uret"))
    if odds is None or not stake or stake <= 0:
        warn["missing odds or stake"] += 1
        return None
    if abs(odds) < 100:
        warn[f"odds below +/-100 ({odds:g}) — kept"] += 1

    ptype = (r.get("Ptype") or "").strip().upper()
    selection = selection_for(ptype, r.get("Pick"), r.get("Pts"))
    if not selection:
        warn["empty selection"] += 1
        return None

    when = event_iso(r.get("Rdate"), r.get("Ltime"))
    if not when:
        warn["unparseable date"] += 1
        return None

    # Home/Away are the ONLY thing that can bind a bare pick like "Over 7 total"
    # to a game — nothing in that selection names one. Dropping these columns is
    # why such plays stayed PENDING forever.
    home = clean(r.get("Home"))
    away = clean(r.get("Away"))

    play = {
        "sport": sport,
        "market": market_for(ptype, r.get("Pick"), sport),
        "selection": selection,
        "oddsAmerican": int(round(odds)),
        "units": round(stake, 2),
        "outcome": outcome,
        # Legacy records only the event time, not when the pick was posted.
        # Using the event time for both keeps history in true chronological
        # order without inventing a separate posting timestamp.
        "createdAt": when,
        "gradedAt": when,
    }
    if profit is not None:
        play["profitUnits"] = round(profit, 2)
    if home:
        play["homeTeam"] = home[:60]
    if away:
        play["awayTeam"] = away[:60]
    league = clean(r.get("Leag"))
    if league:
        play["league"] = league[:40]
    return play


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--records", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--records-out",
                    help="also write carried-over aggregate records to this path")
    ap.add_argument("--packages-out",
                    help="also write storefront packages to this path")
    ap.add_argument("--captured-at", default="2026-07-30T21:17:00-04:00",
                    help="when the legacy export was taken (stamped on records)")
    ap.add_argument("--include-pending", action="store_true",
                    help="also import active_plays as PENDING (default: skip)")
    ap.add_argument("--password-column",
                    help="column on `cappers` holding the stored password "
                         f"(auto-detected from {', '.join(PASSWORD_COLUMNS)})")
    ap.add_argument("--password-format",
                    choices=["BCRYPT", "PHPASS", "MD5", "SHA1", "SHA256", "PLAINTEXT"],
                    help="force the format of that column instead of detecting it. "
                         "Required for PLAINTEXT, which is never auto-detected.")
    ap.add_argument("--no-passwords", action="store_true",
                    help="skip credentials entirely; cappers claim their account instead")
    args = ap.parse_args()

    site = parse_dump(args.site)
    recs = parse_dump(args.records)
    malformed = sum(v["malformed"] for v in {**site, **recs}.values())
    if malformed:
        print(f"!! {malformed} malformed rows skipped", file=sys.stderr)

    cappers = rows(site, "cappers")
    profiles = {p["account_number"]: p for p in rows(site, "cappers_profiles")}
    warn: Counter = Counter()

    # ---- plays, keyed by legacy account number -------------------------
    plays_by_acct: dict[str, list[dict]] = defaultdict(list)
    seen: set[tuple] = set()

    def dedupe_key(acct, r):
        return (str(acct), (r.get("Sport") or "").strip(),
                (r.get("Pick") or "").strip(), str(r.get("Rdate")),
                str(r.get("Value")))

    for table, entry in recs.items():
        if not table.startswith("MPicks"):
            continue
        for r in entry["rows"]:
            acct = str(r.get("ACnum") or table[len("MPicks"):])
            seen.add(dedupe_key(acct, r))
            p = build_play(r, acct, warn)
            if p:
                plays_by_acct[acct].append(p)

    # `past_plays` is the settled-daily staging table; most of it is already in
    # MPicks, but it reaches further back, so take only what MPicks lacks.
    extra = 0
    for r in rows(site, "past_plays"):
        acct = str(r.get("Acct") or "")
        if not acct or dedupe_key(acct, r) in seen:
            continue
        seen.add(dedupe_key(acct, r))
        p = build_play(r, acct, warn)
        if p:
            plays_by_acct[acct].append(p)
            extra += 1

    pending = 0
    if args.include_pending:
        for r in rows(site, "active_plays"):
            acct = str(r.get("Acct") or "")
            r = {**r, "Results": "P"}  # placeholder; rewritten below
            p = build_play(r, acct, warn)
            if p:
                p["outcome"] = "PENDING"
                p.pop("profitUnits", None)
                p.pop("gradedAt", None)
                plays_by_acct[acct].append(p)
                pending += 1

    for lst in plays_by_acct.values():
        lst.sort(key=lambda p: p["createdAt"])

    # ---- cappers -------------------------------------------------------
    # Several legacy brands run multiple capper accounts off one inbox. SCL now
    # allows duplicate emails when usernames differ (#372), so every account
    # keeps the bare address the capper actually uses. Login resolves accounts
    # by email + username; older imports that plus-addressed shared inboxes are
    # still matched at login time (see buildLegacyPlusAddressEmail).
    by_email: dict[str, list[dict]] = defaultdict(list)
    for c in cappers:
        e = (clean(c.get("email")) or "").lower()
        if e:
            by_email[e].append(c)
    email_for: dict[str, str] = {}
    shared: list[str] = []
    for e, group in by_email.items():
        for c in group:
            email_for[c["account_number"]] = e
        if len(group) > 1:
            shared.append(f"{e} -> {len(group)} accounts "
                          f"({', '.join(c['user'] for c in group)})")

    password_column = (None if args.no_passwords
                       else resolve_password_column(site, args.password_column))
    if args.password_column and not password_column and not args.no_passwords:
        print(f"!! no `{args.password_column}` column on `cappers` — "
              "cappers will have to claim their accounts instead", file=sys.stderr)
    pw_stats: Counter = Counter()

    out, skipped = [], []
    market_mix: Counter = Counter()
    for c in cappers:
        acct = c["account_number"]
        username = clean(c.get("user"))
        display = clean(c.get("web_name"))
        if not username or not re.fullmatch(r"[A-Za-z0-9_]{3,30}", username):
            skipped.append(f"acct {acct}: unusable username {username!r}")
            continue
        if not display:
            skipped.append(f"acct {acct}: no display name")
            continue

        prof = profiles.get(acct, {})
        rec: dict = {"username": username, "displayName": clip(display, 60)}
        email = email_for.get(acct)
        if email:
            rec["email"] = email

        # The capper's existing credential, so they sign in with the password
        # they already have. SCL verifies it once, re-hashes it with bcrypt, and
        # drops the imported value (src/lib/legacy-password.ts).
        if password_column:
            stored = (c.get(password_column) or "").strip()
            if stored:
                fmt = args.password_format or detect_password_format(stored)
                if fmt:
                    rec["passwordHash"] = stored
                    rec["passwordFormat"] = fmt
                    pw_stats[fmt] += 1
                else:
                    pw_stats["unrecognised"] += 1
            else:
                pw_stats["empty"] += 1

        sports = [key for col, key in SPORT_FLAGS.items()
                  if (c.get(col) or "").strip().upper() == "Y"]
        if sports:
            rec["sports"] = sorted(set(sports))

        bts = []
        for part in (prof.get("bet_type") or "").split(","):
            bt = BET_TYPES.get(part.strip().lower())
            if bt and bt not in bts:
                bts.append(bt)
        if bts:
            rec["betTypes"] = bts

        # The capper's own words. `cappers.profile` is the rich HTML blurb shown
        # on their legacy profile page; `cappers_profiles.writeup` is the same
        # field in the newer table. Prefer whichever is longer — some accounts
        # only ever filled in one of them.
        prose_candidates = [
            html_to_text(c.get("profile")),
            html_to_text(prof.get("writeup")),
        ]
        prose = max(prose_candidates, key=len)

        # A short opening line is a tagline, not a paragraph — promote it to the
        # headline so the profile leads with it instead of burying it.
        lines = [ln.strip() for ln in prose.split("\n") if ln.strip()]
        if len(lines) > 1 and len(lines[0]) <= 120:
            rec["headline"] = clip(lines[0], 160)
            prose = " ".join(lines[1:])
        elif lines:
            prose = " ".join(lines)

        unit_size = clean(prof.get("unit_size"))
        big_win = clean(prof.get("big_win"))
        # Staking convention is genuinely useful context and has no field of its
        # own, so it tails the bio when there is room for it.
        if unit_size:
            note = f"Unit sizing: {unit_size}"
            prose = f"{prose} · {note}" if prose else note
        if prose:
            rec["bio"] = clip(prose, 800)
        if big_win:
            rec["biggestBetWon"] = clip(big_win, 120)

        vol = (prof.get("bet_vol") or "").split("(")[0].strip().lower()
        if vol in DAILY_VOLUMES:
            rec["dailyVolume"] = DAILY_VOLUMES[vol]

        for src, dst in (("inst", "instagram"), ("twit", "twitter"),
                         ("face", "facebook"), ("tik", "tiktok"),
                         ("other_social", "website")):
            v = clean(prof.get(src))
            if v:
                rec[dst] = clip(v, 200)

        ps = plays_by_acct.get(str(acct), [])
        if ps:
            rec["plays"] = ps
            market_mix.update(p["market"] for p in ps)
        out.append(rec)

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    # ---- carried-over aggregate records ---------------------------------
    rec_stats = {"cappers": 0, "rows": 0, "scopes": Counter()}
    if args.records_out:
        username_for = {c["account_number"]: clean(c.get("user")) for c in cappers}
        scoped = {scope: {r["account_number"]: r for r in rows(site, tbl)}
                  for tbl, scope in SCOPE_TABLES.items() if tbl in site}
        records_out = []
        for c in cappers:
            acct = c["account_number"]
            username = username_for.get(acct)
            if not username:
                continue
            mine = plays_by_acct.get(str(acct), [])
            entries = []

            for scope, by_acct in scoped.items():
                row = by_acct.get(acct)
                if not row:
                    continue
                for prefix, sport in [("TOT", ALL_SPORTS), *STAT_SPORTS.items()]:
                    cell = stat_cell(row, prefix, warn)
                    if cell:
                        entries.append({"scope": scope, "sport": sport, **cell})

            # PRE_IMPORT: the calendar-year total minus what we imported as real
            # plays. Cross-sport standings need one coherent time boundary.
            # CURRENT_SEASON cannot provide that: NFL, NBA, MLB, and the other
            # sports all start their seasons on different dates, so summing those
            # rows made an all-sports capper's headline depend on an arbitrary mix
            # of prior and current-year results.
            entries.extend(pre_import_entries(scoped, acct, mine, warn))

            if entries:
                records_out.append({
                    "username": username,
                    "capturedAt": args.captured_at,
                    "records": entries,
                })
                rec_stats["cappers"] += 1
                rec_stats["rows"] += len(entries)
                rec_stats["scopes"].update(e["scope"] for e in entries)

        with open(args.records_out, "w", encoding="utf-8") as fh:
            json.dump(records_out, fh, indent=2, ensure_ascii=False)
            fh.write("\n")

    # ---- storefront packages --------------------------------------------
    pkg_stats = {"rows": 0, "cappers": 0, "unconfident": 0, "nolink": 0, "noprice": 0}
    if args.packages_out:
        username_for = {c["account_number"]: clean(c.get("user")) for c in cappers}
        packages_out = []
        package_review: list[dict] = []
        seen_ref: set[str] = set()
        for r in rows(site, "aff_subscriptions"):
            acct = r.get("Acct")
            username = username_for.get(acct)
            if not username or acct in ("0", "", None):
                continue
            ref = clean(r.get("xinfo"))
            # The legacy column stores the URL HTML-escaped, because the old PHP
            # site interpolated it straight into markup. Left as-is, Winible
            # receives `amp;a=...` instead of `a=...` and the affiliate code and
            # coupon are silently dropped.
            checkout = clean(_html_mod.unescape(r.get("code") or ""))
            if not ref or ref in seen_ref:
                continue
            if not checkout or not checkout.lower().startswith("http"):
                pkg_stats["nolink"] += 1
                continue  # no checkout URL => the offer cannot publish
            seen_ref.add(ref)

            text = html_to_text(r.get("description"))
            cents, period, confident = parse_package_price(text)
            if cents == 0:
                pkg_stats["noprice"] += 1
            if not confident:
                pkg_stats["unconfident"] += 1

            # A wrong price is worse than no price. Offers quoting several
            # figures ("$25 now just $12.50!", "$5/week or $15/month") are
            # published at 0, which renders no price label at all — the
            # checkout page stays authoritative — and are listed for review.
            if not confident:
                package_review.append({
                    "username": username,
                    "legacyRef": ref,
                    "title": parse_package_title(text),
                    "bestGuessCents": cents,
                    "billingPeriod": period,
                    "sourceText": clip(text, 200),
                })

            packages_out.append({
                "username": username,
                # Legacy affiliate code — unique per offer, so it keys both the
                # idempotent upsert and a stable /go slug across re-runs.
                "legacyRef": ref,
                "title": parse_package_title(text),
                "description": clip(text, 600) or None,
                "priceCents": cents if confident else 0,
                "billingPeriod": period,
                "checkoutUrl": checkout,
                "affiliateProvider": store_provider(checkout),
                "sortOrder": int(num(r.get("odr")) or 0),
                "isActive": (r.get("dstatus") or "").strip().upper() == "Y",
            })

        pkg_stats["rows"] = len(packages_out)
        pkg_stats["cappers"] = len({p["username"] for p in packages_out})
        with open(args.packages_out, "w", encoding="utf-8") as fh:
            json.dump(packages_out, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        review_path = args.packages_out.replace(".json", "-review.json")
        with open(review_path, "w", encoding="utf-8") as fh:
            json.dump(package_review, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        pkg_stats["review_path"] = review_path

    # ---- report --------------------------------------------------------
    total = sum(len(c.get("plays", [])) for c in out)
    withplays = sum(1 for c in out if c.get("plays"))
    print(f"\nWrote {args.out}")
    print(f"  cappers        : {len(out)} ({withplays} with plays, {len(out)-withplays} without)")
    print(f"  plays          : {total}  (+{extra} recovered from past_plays"
          f"{f', {pending} pending' if pending else ''})")
    dates = [p["createdAt"][:10] for c in out for p in c.get("plays", [])]
    if dates:
        print(f"  date range     : {min(dates)} -> {max(dates)}")
        assert DST_WINDOW[0] <= min(dates) and max(dates) <= DST_WINDOW[1], \
            "dates fall outside US Eastern DST — the fixed -04:00 offset is no longer exact"
    print(f"  units (stake)  : from `urisk`; profit from `uret`")
    if password_column:
        carried = sum(n for k, n in pw_stats.items()
                      if k not in ("unrecognised", "empty"))
        print(f"  passwords      : {carried} carried from `{password_column}`")
        for fmt, n in pw_stats.most_common():
            label = {"unrecognised": "unrecognised format (dropped)",
                     "empty": "no stored password"}.get(fmt, fmt)
            print(f"    {n:>5}  {label}")
        if pw_stats["unrecognised"]:
            print("    (dropped hashes can't be verified at login; those cappers "
                  "claim their account instead. Pass --password-format if you know it.)")
    else:
        print("  passwords      : none carried — cappers claim their accounts "
              "(no password column found)" if not args.no_passwords else
              "  passwords      : skipped (--no-passwords)")
    if args.packages_out:
        print(f"\nWrote {args.packages_out}")
        print(f"  packages       : {pkg_stats['rows']} across {pkg_stats['cappers']} cappers")
        print(f"  no price parsed: {pkg_stats['noprice']} (render without a price label)")
        print(f"  ambiguous price: {pkg_stats['unconfident']} -> published with no price label; see {pkg_stats.get('review_path')}")
        print(f"  skipped, no checkout link: {pkg_stats['nolink']}")
    if args.records_out:
        print(f"\nWrote {args.records_out}")
        print(f"  cappers        : {rec_stats['cappers']}")
        print(f"  record rows    : {rec_stats['rows']}")
        for s, n in rec_stats["scopes"].most_common():
            print(f"    {n:>5}  {s}")
    print("\n  market mix:")
    for m, n in market_mix.most_common():
        print(f"    {n:>6}  {m}")
    if shared:
        print("\n  shared emails (multiple accounts on one inbox):")
        for s in shared:
            print(f"    {s}")
    if skipped:
        print(f"\n  skipped cappers ({len(skipped)}):")
        for s in skipped:
            print(f"    {s}")
    if warn:
        print("\n  row warnings:")
        for w, n in warn.most_common():
            print(f"    {n:>6}  {w}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
