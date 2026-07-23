"""Download self-hosted sportsbook logo PNGs for SCL BookMark.

Source: OpticOdds public CDN (nominative source attribution marks).
Re-run after adding books in src/lib/books.ts, then bump BOOK_MARK_ASSET_VERSION.

Requires network. Uses a browser User-Agent — bare urllib gets 403.
"""

from __future__ import annotations

import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "marks" / "books"

# SCL book key → OpticOdds CDN slug
CDN_SLUGS: dict[str, str] = {
    "draftkings": "draftkings",
    "fanduel": "fanduel",
    "betmgm": "betmgm",
    "williamhill_us": "caesars",  # Caesars (Odds API key: williamhill_us)
    "fanatics": "fanatics",
    "espnbet": "thescore",  # ESPN BET mark on OpticOdds CDN
    "hardrockbet": "hardrock",
    "betrivers": "betrivers",
    "bovada": "bovada",
    "betonlineag": "betonline",
}

UA = "Mozilla/5.0 (compatible; SCL-Asset-Sync/1.0)"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ok = 0
    for key, slug in CDN_SLUGS.items():
        url = f"https://cdn.opticodds.com/sportsbook-logos/{slug}.jpg"
        dest = OUT / f"{key}.png"
        data = fetch(url)
        if len(data) < 500:
            raise RuntimeError(f"{key}: suspicious payload ({len(data)} bytes)")
        dest.write_bytes(data)
        print(f"{dest.name}\t{len(data)} bytes\t<- {slug}")
        ok += 1
    print(f"synced {ok} book marks -> {OUT}")


if __name__ == "__main__":
    main()
