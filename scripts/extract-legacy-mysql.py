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


def stat_cell(row: dict, prefix: str) -> dict | None:
    """One (sport | total) slice of a legacy stats row, or None if it's empty."""
    w = int(num(row.get(f"{prefix}_w")) or 0)
    l = int(num(row.get(f"{prefix}_l")) or 0)
    p = int(num(row.get(f"{prefix}_p")) or 0)
    if w + l + p <= 0:
        return None
    return {
        "wins": w, "losses": l, "pushes": p,
        "unitsRisked": round(num(row.get(f"{prefix}_ur")) or 0.0, 2),
        "unitsNet": round(num(row.get(f"{prefix}_ue")) or 0.0, 2),
    }


def sub_cell(total: dict, imported: dict | None) -> dict | None:
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


def clean(v) -> str | None:
    s = (v or "").strip()
    return s or None


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
    ap.add_argument("--captured-at", default="2026-07-30T21:17:00-04:00",
                    help="when the legacy export was taken (stamped on records)")
    ap.add_argument("--include-pending", action="store_true",
                    help="also import active_plays as PENDING (default: skip)")
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
    # User.email is unique in the new schema, but several legacy brands run
    # multiple capper accounts off one address. Keep the bare address on the
    # account with the most history and plus-address the rest, so a claim email
    # still lands in the same real inbox instead of being lost to a placeholder.
    by_email: dict[str, list[dict]] = defaultdict(list)
    for c in cappers:
        e = (clean(c.get("email")) or "").lower()
        if e:
            by_email[e].append(c)
    email_for: dict[str, str] = {}
    shared: list[str] = []
    for e, group in by_email.items():
        if len(group) == 1:
            email_for[group[0]["account_number"]] = e
            continue
        group = sorted(group, key=lambda c: -len(plays_by_acct.get(str(c["account_number"]), [])))
        local, _, domain = e.partition("@")
        for i, c in enumerate(group):
            user = (clean(c.get("user")) or c["account_number"]).lower()
            email_for[c["account_number"]] = e if i == 0 else f"{local}+{user}@{domain}"
        shared.append(f"{e} -> {len(group)} accounts "
                      f"({', '.join(c['user'] for c in group)})")

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
        rec: dict = {"username": username, "displayName": display[:60]}
        email = email_for.get(acct)
        if email:
            rec["email"] = email

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

        # Legacy has no free-form bio; the staking note and best-win blurb are
        # the only prose the capper actually wrote, so carry those across.
        bio_bits = []
        unit_size = clean(prof.get("unit_size"))
        big_win = clean(prof.get("big_win"))
        if unit_size:
            bio_bits.append(f"Unit sizing: {unit_size}")
        if big_win:
            bio_bits.append(f"Biggest win: {big_win}")
        if bio_bits:
            rec["bio"] = " · ".join(bio_bits)[:800]

        for src, dst in (("inst", "instagram"), ("twit", "twitter"),
                         ("face", "facebook"), ("tik", "tiktok"),
                         ("other_social", "website")):
            v = clean(prof.get(src))
            if v:
                rec[dst] = v[:200]

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
                    cell = stat_cell(row, prefix)
                    if cell:
                        entries.append({"scope": scope, "sport": sport, **cell})

            # PRE_IMPORT: the season total minus what we imported as real plays.
            # This is the only scope the leaderboard adds, so the overlap between
            # legacy totals and imported picks can never be counted twice.
            season = scoped.get("CURRENT_SEASON", {}).get(acct)
            if season:
                for prefix, sport in [("TOT", ALL_SPORTS), *STAT_SPORTS.items()]:
                    total = stat_cell(season, prefix)
                    if not total:
                        continue
                    imported = totals_from_plays(
                        mine, None if sport == ALL_SPORTS else sport
                    )
                    residual = sub_cell(total, imported)
                    if residual:
                        entries.append(
                            {"scope": "PRE_IMPORT", "sport": sport, **residual}
                        )

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
        print("\n  shared emails (plus-addressed to keep them unique):")
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
