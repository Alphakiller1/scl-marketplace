# SCL Phase 1 — Product Spec

## Mission

Rebuild the Sports Capper Leaderboard **experience** while preserving its proven business
value (verified records, transparent performance, leaderboards, capper reputation). This is a
**preservation project for the data/business logic, a replacement project for the experience.**

## What we preserve (do not destroy)

Verified handicappers · transparent records · win % · ROI · unit profit · sport-based
rankings · time-based rankings · today's/yesterday's picks · trophy case · handicapper
profiles · trust positioning · top-capper discovery · login/participation.

## The product loop (every UI decision must serve it)

Discover cappers → evaluate records → follow trusted performers → view today's picks → track
results → rank performance → build reputation → return daily. Features that don't serve the
loop are deprioritized.

## Competitive lane

Don't copy Pikkit / Juice Reel / Action Network. **Own** verified public capper rankings,
transparent records, leaderboard status, reputation, public performance history, top-pick
discovery, and trust. The user thought we want: _"I want my record on there. I want to be
ranked. I want to follow the best cappers. I trust this because the records are visible."_

## Information architecture (top level)

Home / Command Center · Leaderboards · Today's Picks · Cappers (directory) · Capper Profile ·
Trophy Case · Betting Tools · Join as Capper · Login / Dashboard.

## Page deliverables (Phase 1)

1. **Home / Command Center** — live dashboard: trophy-led hero + trust, performance
   leaderboard, latest tracked picks, ROI leaders, real platform metrics, join CTA.
2. **Leaderboards** _(centerpiece)_ — filter by sport, time window, min picks, verified-only,
   active; sort by Win%/Units/ROI; rows with rank, movement, avatar, name, verification,
   W-L-P, win%, units, ROI, streak, recent form. Desktop table / mobile cards.
3. **Today's Picks** — `PickCard` grid; capper + record, sport, event, selection, odds, units,
   status, posted/game time, profile link.
4. **Capper Profile** — public betting résumé: header, verification, overall record, win%,
   ROI, units, streak, best sport/window, recent form, history, trophy case, sport breakdown,
   editable default storefront identity, subscribe/share CTAs.
5. **Cappers Directory** — discovery board with inline stats + filters (sport, ROI, units,
   win%, active today, hot streak, rising, verified). _(legacy showed no inline stats — we win here)_
6. **Trophy Case** — status system (Top ROI, Top Units, Best Weekly/Monthly, Sport Specialist,
   Hot Streak, Long-Term Grinder, Underdog Hunter, Verified Winner).
7. **Join as Capper** — reputation-engine pitch: build a public record, prove performance, get
   discovered, climb. Self-service signup + email verification (vs legacy admin application).
8. **Capper / Admin Dashboard foundation** — submit picks, pick history, performance, manage
   profile, verification status, ranking movement, admin grading panel, result controls.

## Success standard

A first-time visitor instantly understands: SCL ranks real cappers, records are transparent,
performance is evaluable, today's picks are discoverable, cappers build reputation, and you can
see who's hot / profitable / consistent. _If it's only prettier, it failed. If it feels
trusted, competitive, organized, premium, mobile-native, and scalable, it succeeded._

## Phase boundaries

- **Phase 1:** experience rebuild + data foundation; every capper receives an editable default
  storefront, with Winible/Whop packages linking to external checkout after SCL approval.
- **Phase 2+:** native Stripe checkout, sportsbook integrations (only via official APIs),
  social/following graph, advanced analytics. No production scraping, ever.
