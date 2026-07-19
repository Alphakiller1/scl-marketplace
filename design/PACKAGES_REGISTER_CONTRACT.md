# Packages evidence-register contract

Status: acceptance target for the public `/packages` surface.

## Product purpose

Packages is a public offer register, not a recommendation wall or an SCL checkout. A visitor should be able to inspect the capper's real all-time record before deciding whether to open an external storefront.

## Trust order

1. Capper identity and link to the public record.
2. All-time evidence: record, ROI, units, graded sample, and board-verified share.
3. Offer title and description.
4. External provider, externally listed price, and one outbound action.

The evidence block must precede the commercial action in DOM and visual order. SCL never labels an offer “best,” “top,” “recommended,” or similar.

## Data honesty

- No fixture, mock, fallback, or placeholder offers on public routes.
- Zero graded picks render em dashes for record, ROI, units, and verified share.
- Early samples remain visible and are labeled provisional; they are never framed as poor performance.
- Verified share means the share of tracked picks checked against the board at submission. It never means those picks won.
- External offer prices are labeled as external prices. They are never presented as wagered volume or SCL-processed money.
- Query failure and a truthful empty marketplace are distinct states.
- SCL's no-payment disclosure stays adjacent to the register and outbound actions.

## Desktop composition (>= 1024px)

- Flat semantic table with one row per real active offer.
- Columns: Capper | Public record | Offer | External storefront.
- Public record contains Record / ROI / Units / Sample / Verified in one dense evidence strip.
- Hairline dividers define rows. No card grid, floating commerce tiles, or decorative shadows.
- Exactly one primary outbound action per offer.

## Mobile composition (< 1024px)

- Flat stacked register rows separated by hairlines; no carousel and no horizontal scroll.
- Capper identity first, then the five-field evidence block, then offer details, then the external action.
- Controls and outbound actions are at least 44px high.
- Normal-size text remains at least 16px at <= 639px where it is interactive.

## Cold start

When no offer qualifies, retain the header, no-payment disclosure, and a compact direct empty state. Do not render placeholder cards, an empty table shell, or “coming soon” language.

## Non-regression gate

Verify at 375, 768, 1280, and 1440 in dark and light: no horizontal overflow, WCAG 2.2 AA, correct singular/plural labels, evidence before commerce, zero-sample em dashes, and no public test-account packages.
