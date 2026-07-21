/**
 * Cold-start marketplace copy — keep in one place so homepage, leaderboard,
 * profile, and SEO stay skeptic-proof and consistent.
 */

export const PROVISIONAL_RECORD_HELP =
  "A Provisional Record Is Visible But Not Ranked Yet. The Capper Has Not Reached SCL’s Minimum Graded-Pick Sample, So Their Stats Should Be Read As Early History, Not A Leaderboard Signal.";

export const VERIFIED_ACCOUNT_HELP =
  "This Capper’s SCL Account Has Passed Platform Identity And Access Checks, But That Does Not Verify Future Performance.";

export const BOARD_VERIFIED_PICK_HELP =
  "This Pick Was Submitted Through SCL’s Board With Event, Market, Odds, And Timestamp Captured Before Grading.";

export const SELF_REPORTED_PICK_HELP =
  "This Pick Was Entered Without Full Board Verification, So It Remains Visible But Carries Less Verification Weight.";

export const STOREFRONT_EMPTY_TITLE = "No Storefront Linked Yet";

export const STOREFRONT_EMPTY_BODY =
  "This Capper Has Not Linked A Paid Community Or Storefront. You Can Still Inspect Their Public Record On SCL.";

export const STOREFRONT_PAYMENT_DISCLAIMER =
  "SCL Provides Record Transparency Only. Payments And Subscriptions Are Handled By Third-Party Storefronts When A Capper Chooses To Link One.";

export const STOREFRONT_OUTBOUND_MICROCOPY =
  "You Are Leaving SCL For A Third-Party Storefront. SCL Does Not Process Payments Or Manage Subscriptions.";

export const STOREFRONT_OUTBOUND_CTA = "View External Storefront";

export const PAYMENT_OUTCOME_DISCLAIMER =
  "SCL Provides Record Transparency Only. Payments And Subscriptions Are Handled By Third-Party Storefronts. Records Are Informational And Do Not Guarantee Future Outcomes.";

export const ROI_LEADERS_EMPTY_TITLE = "ROI Leaders Are Building";

export const ROI_LEADERS_EMPTY_BODY =
  "No Capper Has Enough Graded Volume To Rank Here Yet. SCL Only Shows ROI Leaders After A Minimum Sample So Early Records Do Not Look More Proven Than They Are.";

export const ROI_LEADERS_EMPTY_LABEL = "Minimum Sample Required";

export const FOUNDING_BANNER_HEADLINE = "Founding Cappers Wanted";

export const FOUNDING_BANNER_BODY =
  "Build Your Public Record From Day One. SCL Is Opening Early Access To Cappers Who Want Every Pick, Timestamp, Line, And Result To Be Inspectable Before They Send Bettors Anywhere.";

export const FOUNDING_BANNER_CTA = "Apply As A Founding Capper";

export const FOUNDING_BANNER_SECONDARY =
  "SCL Does Not Process Payments. You Keep Your Storefront On Whop, Winible, DubClub, Or Your Approved Checkout.";

export const HERO_HEADLINE = "Verified Records For Bettors And Cappers";

export const HERO_SUBHEAD =
  "SCL Helps Bettors Inspect Capper History And Helps Serious Cappers Build Trust With Transparent, Board-Verified Records.";

/** Fable Step 2 — hero secondary / bottom band (not founding recruitment). */
export const TRACK_YOUR_RECORD_CTA = "Track Your Record";

export const BOTTOM_BAND_HEADLINE = "Build A Record People Can Inspect";

export const BOTTOM_BAND_BODY =
  "Log Board-Verified Plays. Earn A Public Rank Others Can Check.";

/** Rank-mode right rail — factual eligibility copy (GPT review welcome). */
export const HOW_RANKING_WORKS_TITLE = "How Ranking Works";

export const HOW_RANKING_WORKS_BULLETS = [
  "Within The Selected Scope, A Public Rank Requires The Minimum Graded Sample And Non-Negative ROI And Units.",
  "Records Below The Sample Threshold Or With Negative ROI Or Units Remain Visible Under Building A Record And Are Not Ranked.",
  "CLV Sorting Requires The Minimum Sample And At Least One Stored Closing Line.",
] as const;

export const HOW_RANKING_VERIFIED_NOTE =
  "Verified Share Is The Percentage Of Tracked Picks Checked Against The Board At Submission. It Does Not Describe Pick Outcomes.";
