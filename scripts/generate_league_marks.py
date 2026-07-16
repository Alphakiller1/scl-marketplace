"""Generate original SCL sport-icon league marks (not trademark logos)."""

from __future__ import annotations

from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "marks" / "leagues"

MARKS: dict[str, tuple[str, str]] = {
    "mlb": (
        "#002d72",
        """
  <circle cx="20" cy="18" r="10" fill="none" stroke="#fff" stroke-width="1.8"/>
  <path d="M12.5 13c3 2.2 3 7.8 0 10M27.5 13c-3 2.2-3 7.8 0 10" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
  <text x="20" y="36" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="7" font-weight="700" fill="#fff">MLB</text>
""",
    ),
    "nba": (
        "#1d428a",
        """
  <circle cx="20" cy="17.5" r="9.5" fill="none" stroke="#fff" stroke-width="1.8"/>
  <path d="M20 8v19M11.2 17.5h17.6M13 11.5c4 2.8 10 2.8 14 0M13 23.5c4-2.8 10-2.8 14 0" fill="none" stroke="#fff" stroke-width="1.35" stroke-linecap="round"/>
  <text x="20" y="36" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="7" font-weight="700" fill="#fff">NBA</text>
""",
    ),
    "nfl": (
        "#013369",
        """
  <ellipse cx="20" cy="17" rx="12" ry="7.5" fill="none" stroke="#fff" stroke-width="1.8"/>
  <path d="M20 10.2v13.6M16.2 17h7.6" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M10 14.5c1.2.8 1.2 4.2 0 5M30 14.5c-1.2.8-1.2 4.2 0 5" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
  <text x="20" y="36" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="7" font-weight="700" fill="#fff">NFL</text>
""",
    ),
    "nhl": (
        "#111111",
        """
  <ellipse cx="20" cy="16" rx="8" ry="8" fill="none" stroke="#fff" stroke-width="1.8"/>
  <ellipse cx="20" cy="16" rx="3.2" ry="3.2" fill="#fff"/>
  <path d="M9 26l6-7 4 3 7-9" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="20" y="36" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="7" font-weight="700" fill="#fff">NHL</text>
""",
    ),
    "wnba": (
        "#fa4616",
        """
  <circle cx="20" cy="17.5" r="9.5" fill="none" stroke="#fff" stroke-width="1.8"/>
  <path d="M20 8v19M11.2 17.5h17.6M13 11.5c4 2.8 10 2.8 14 0M13 23.5c4-2.8 10-2.8 14 0" fill="none" stroke="#fff" stroke-width="1.35" stroke-linecap="round"/>
  <text x="20" y="36" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="6.5" font-weight="700" fill="#fff">WNBA</text>
""",
    ),
    "ncaaf": (
        "#0a5630",
        """
  <ellipse cx="20" cy="16.5" rx="11.5" ry="7" fill="none" stroke="#fff" stroke-width="1.8"/>
  <path d="M20 10v13M16.5 16.5h7" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
  <text x="20" y="36" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="6" font-weight="700" fill="#fff">NCAAF</text>
""",
    ),
    "ncaab": (
        "#0033a0",
        """
  <circle cx="20" cy="16.5" r="9" fill="none" stroke="#fff" stroke-width="1.8"/>
  <path d="M20 7.5v18M11.5 16.5h17M13.2 11c3.6 2.5 9.2 2.5 12.8 0M13.2 22c3.6-2.5 9.2-2.5 12.8 0" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
  <text x="20" y="36" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="6" font-weight="700" fill="#fff">NCAAB</text>
""",
    ),
    "soccer": (
        "#0f6b3d",
        """
  <circle cx="20" cy="17" r="10" fill="none" stroke="#fff" stroke-width="1.8"/>
  <path d="M20 7l3.2 3.2-1.2 4.6H18l-1.2-4.6zm0 20l-3.2-3.2 1.2-4.6h3.8l1.2 4.6zM9.2 12.2l4.6-1.2 2.8 3.8-2.8 3.8-4.6-1.2zm21.6 0l-4.6-1.2-2.8 3.8 2.8 3.8 4.6-1.2z" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
  <text x="20" y="36" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="6.5" font-weight="700" fill="#fff">SOC</text>
""",
    ),
    "mma": (
        "#c0392b",
        """
  <path d="M12 12h6v14h-6zm10 0h6v14h-6z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M14 16h2M24 16h2M14 20h2M24 20h2" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
  <text x="20" y="36" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="7" font-weight="700" fill="#fff">MMA</text>
""",
    ),
    "cfl": (
        "#8b1538",
        """
  <ellipse cx="20" cy="16.5" rx="11.5" ry="7" fill="none" stroke="#fff" stroke-width="1.8"/>
  <path d="M20 10v13M16.5 16.5h7" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
  <text x="20" y="36" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="7" font-weight="700" fill="#fff">CFL</text>
""",
    ),
    "ufl": (
        "#1a3a6e",
        """
  <ellipse cx="20" cy="16.5" rx="11.5" ry="7" fill="none" stroke="#fff" stroke-width="1.8"/>
  <path d="M20 10v13M16.5 16.5h7" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
  <text x="20" y="36" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="7" font-weight="700" fill="#fff">UFL</text>
""",
    ),
    "boxing": (
        "#5b2c6f",
        """
  <rect x="9" y="11" width="9" height="12" rx="4" fill="none" stroke="#fff" stroke-width="1.7"/>
  <rect x="22" y="11" width="9" height="12" rx="4" fill="none" stroke="#fff" stroke-width="1.7"/>
  <path d="M18 17h4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
  <text x="20" y="36" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="6.5" font-weight="700" fill="#fff">BOX</text>
""",
    ),
    "nascar": (
        "#e10600",
        """
  <circle cx="12" cy="18" r="5" fill="none" stroke="#fff" stroke-width="1.6"/>
  <circle cx="28" cy="18" r="5" fill="none" stroke="#fff" stroke-width="1.6"/>
  <path d="M16.5 15h7l2 6H14.5z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
  <text x="20" y="36" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="6.5" font-weight="700" fill="#fff">NAS</text>
""",
    ),
    "pga": (
        "#004b28",
        """
  <circle cx="20" cy="12" r="3.2" fill="#fff"/>
  <path d="M14 28c2-7 4.5-11 6-14 1.5 3 4 7 6 14" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M12 28h16" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
  <text x="20" y="36" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="7" font-weight="700" fill="#fff">PGA</text>
""",
    ),
    "tennis": (
        "#2e7d32",
        """
  <circle cx="20" cy="17" r="10" fill="none" stroke="#fff" stroke-width="1.8"/>
  <path d="M12 11c5 2 9 6 11 12M17 8.5c3.5 4 6 9 7.5 14.5" fill="none" stroke="#fff" stroke-width="1.35" stroke-linecap="round"/>
  <text x="20" y="36" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="6.5" font-weight="700" fill="#fff">TEN</text>
""",
    ),
}


def wrap(fill: str, body: str, label: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" '
        f'viewBox="0 0 40 40" role="img" aria-label="{label}">\n'
        f'  <rect width="40" height="40" rx="8" fill="{fill}"/>\n'
        f"  {body.strip()}\n"
        f"</svg>\n"
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for key, (fill, body) in MARKS.items():
        path = OUT / f"{key}.svg"
        path.write_text(wrap(fill, body, key.upper()), encoding="utf-8", newline="\n")
        print(f"{path.name} {path.stat().st_size}")
    print(f"wrote {len(MARKS)} marks -> {OUT}")


if __name__ == "__main__":
    main()
