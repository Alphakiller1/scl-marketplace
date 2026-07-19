# Discover and ranking separation contract

Status: acceptance target for `/discover` and the unranked field on `/leaderboard`.

## Route responsibility

- Discover is curated. It contains exactly the five published evidence lanes, each capped at the shared lane limit.
- Leaderboard is exhaustive within its chosen scope. Filtering, sorting, row expansion, and the unranked field belong there.
- Discover must not embed a second leaderboard, its filter bar, or the complete unranked directory.
- Discover ends with one explicit handoff to the Leaderboard for visitors who need every public record.

## Discover composition

1. Compact page identity and matched-lane count.
2. Five-item evidence-lens index. Each item states its primary measure and whether a real match exists.
3. Populated lane ledgers, in published order, with at most four real rows per lane.
4. One compact “lanes without matches yet” disclosure index for all honest empties.
5. Flat directory handoff to `/leaderboard`.

Lane sections use numbered rails and hairline dividers. Repeated generic compass icons, card grids, placeholder rows, and “coming soon” language are prohibited.

## Unranked public records

- The section title is “Unranked public records”; it must never resemble a continuation of numbered competition places.
- Explain that a record can be unranked because it has no graded picks, misses the chosen sample, or has negative ROI or units in scope.
- Keep real nonzero history visible, including negative performance. Do not hide or soften it.
- A zero-grade record renders em dashes for record, ROI, units, and win rate; it never renders 0-0, 0.0%, or 0U as if graded performance exists.
- Use flat hairline rows, not a second card wall.
- “Building a record” remains the supporting status vocabulary, not the section's competitive heading.

## Data honesty and accessibility

- Discover lane emptiness is a valid outcome, not a defect.
- No fabricated rows, inferred CLV, recommendations, or performance claims.
- Verified always means board verification at submission, not a win.
- All links and disclosures meet 44px target requirements where applicable.
- Verify at 375, 768, 1280, and 1440 in dark and light with no horizontal overflow and WCAG 2.2 AA.
