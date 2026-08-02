/**
 * Cold-start marketplace copy — keep in one place so homepage, leaderboard,
 * profile, and SEO stay skeptic-proof and consistent.
 */

export const PROVISIONAL_RECORD_HELP =
  "A provisional record is visible but not ranked yet. The capper has not reached SCL’s minimum graded-pick sample, so their stats should be read as early history, not a leaderboard signal.";

export const VERIFIED_ACCOUNT_HELP =
  "This capper’s SCL account has passed platform identity and access checks, but that does not verify future performance.";

export const BOARD_VERIFIED_PICK_HELP =
  "This pick was submitted through SCL’s board with event, market, odds, and timestamp captured before grading.";

export const SELF_REPORTED_PICK_HELP =
  "This pick was entered without full board verification, so it remains visible but carries less verification weight.";

export const STOREFRONT_EMPTY_TITLE = "No storefront linked yet";

export const STOREFRONT_EMPTY_BODY =
  "This capper has not linked a paid community or storefront. You can still inspect their public record on SCL.";

export const STOREFRONT_PAYMENT_DISCLAIMER =
  "SCL provides record transparency only. Payments and subscriptions are handled by third-party storefronts when a capper chooses to link one.";

export const STOREFRONT_OUTBOUND_MICROCOPY =
  "You are leaving SCL for a third-party storefront. SCL does not process payments or manage subscriptions.";

export const STOREFRONT_OUTBOUND_CTA = "View external storefront";

export const PAYMENT_OUTCOME_DISCLAIMER =
  "SCL provides record transparency only. Payments and subscriptions are handled by third-party storefronts. Records are informational and do not guarantee future outcomes.";

export const ROI_LEADERS_EMPTY_TITLE = "ROI leaders are building";

export const ROI_LEADERS_EMPTY_BODY =
  "No capper has enough graded volume to rank here yet. SCL only shows ROI leaders after a minimum sample so early records do not look more proven than they are.";

export const ROI_LEADERS_EMPTY_LABEL = "Minimum sample required";

export const FOUNDING_BANNER_HEADLINE = "Founding Cappers Wanted";

export const FOUNDING_BANNER_BODY =
  "Build Your Public Record From Day One. SCL Is Opening Early Access To Cappers Who Want Every Pick, Timestamp, Line, And Result To Be Inspectable Before They Send Bettors Anywhere.";

export const FOUNDING_BANNER_CTA = "Apply As A Founding Capper";

export const FOUNDING_BANNER_SECONDARY =
  "SCL Does Not Process Payments. You Keep Your Storefront On Whop, Winible, DubClub, Or Your Approved Checkout.";

export const HERO_HEADLINE = "Verified Records For Bettors And Cappers";

export const HERO_SUBHEAD =
  "SCL Helps Bettors Inspect Capper History And Helps Serious Cappers Build Trust With Transparent, Independently Graded Records.";

/** Fable Step 2 — hero secondary / bottom band (not founding recruitment). */
export const TRACK_YOUR_RECORD_CTA = "Track Your Record";

export const BOTTOM_BAND_HEADLINE = "Build A Record People Can Inspect";

export const BOTTOM_BAND_BODY =
  "Log Odds-Verified Plays. Earn A Public Rank Others Can Check.";

/** Rank-mode right rail — factual eligibility copy (GPT review welcome). */
export const HOW_RANKING_WORKS_TITLE = "How ranking works";

export const HOW_RANKING_WORKS_BULLETS = [
  "Within the selected scope, a public rank requires the minimum graded sample.",
  "Records below the sample threshold remain visible under Building a Record and are not ranked.",
  "CLV sorting requires the minimum sample and at least one stored closing line.",
] as const;

export const HOW_RANKING_VERIFIED_NOTE =
  "Odds-Verified share is the percentage of tracked picks whose submitted prices were checked against available sportsbook odds. It does not describe pick outcomes.";
