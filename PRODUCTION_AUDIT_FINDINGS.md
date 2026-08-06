# Production Audit Report: sportscappersleaderboard.com

**Date:** 2026-08-06T00:03:17Z  
**Auditor:** Autonomous Browser Audit System  
**Environment:** Production (https://sportscappersleaderboard.com)

---

## Executive Summary

Comprehensive audit of 18 public routes across 4 viewports (375px, 768px, 1440px, 1536px) completed successfully.

### Critical Issues Found: 3

1. **QA Routes Publicly Accessible** (Security Risk)
2. **Avatar Image Loading Failures** (400 errors across multiple pages)
3. **Design Violations** (Dollar signs on /packages and /terms pages)

### Non-Critical Issues: 1

- Horizontal overflow on /sitemap.xml (mobile viewport only)

---

## 1. ROUTE ACCESSIBILITY AUDIT

### ✅ All Primary Routes: HTTP 200

- `/` - Home (SCL — Sports Cappers Leaderboard · SCL)
- `/leaderboard` - Leaderboard · SCL
- `/discover` - Discover · SCL
- `/picks` - Latest picks · SCL
- `/packages` - Packages · SCL
- `/cappers` - Discover · SCL
- `/verification` - How Verification Works · SCL
- `/support` - Support · SCL

### ✅ Legal & Policy Pages: HTTP 200

- `/terms` - Terms of Service · SCL
- `/privacy` - Privacy Policy · SCL
- `/disclaimer` - Disclaimer · SCL
- `/responsible-gaming` - Responsible Gaming · SCL
- `/refund-policy` - Refund Policy · SCL

### ✅ SEO & Health Endpoints: HTTP 200

- `/robots.txt`
- `/sitemap.xml`
- `/api/health`

### ❌ QA ROUTES SHOULD BE 404 BUT RETURN 200 (CRITICAL)

**Issue:** Internal QA routes are publicly accessible in production.

**Affected Routes:**

- `/qa/board-odds-hygiene` - Expected 404, got 200
- `/qa/desktop-profile-composition` - Expected 404, got 200

**Risk Level:** HIGH - Internal QA tools should not be accessible in production

**Evidence:**

- Screenshot paths:
  - `/opt/cursor/artifacts/screenshots/qa-board-odds-hygiene-desktop.png`
  - `/opt/cursor/artifacts/screenshots/qa-desktop-profile-composition-desktop.png`

**Recommendation:** Add middleware/route guards to block `/qa/*` routes in production environment.

---

## 2. IMAGE LOADING FAILURES (400 ERRORS)

### ❌ Avatar Images Failing with HTTP 400

**Affected Pages:**

- `/` (Home) - All viewports
- `/leaderboard` - All viewports
- `/picks` - Desktop viewports only
- `/packages` - All viewports

**Error Pattern:**

```
Failed to load resource: the server responded with a status of 400 ()
URL: https://sportscappersleaderboard.com/_next/image?url=https%3A%2F%2Fmvxjcfriirguhjujurhf.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fscl-profile-media%2F[USER_ID]%2Favatar.webp%3Fv%3D[TIMESTAMP]&w=32&q=75
```

**Affected User Avatar IDs:**

- `cms8lu1p701vnel302q7osq4g` (appears most frequently)
- `cms8lwygs03k3el301rag6huu`
- `cmsgnfykr0000l8043aezu6hj`

**Total Console Errors:** 14 instances across different routes/viewports

**Impact:** User avatars fail to display, creating visual gaps in UI

**Root Cause:** Next.js Image Optimization API returning 400 for certain Supabase-hosted images. Likely issues:

- Invalid/corrupted source images
- Supabase storage permissions
- Next.js image config restrictions

**Recommendation:**

1. Validate source images exist and are accessible at Supabase URLs
2. Check Supabase CORS and storage bucket policies
3. Verify Next.js `next.config.js` image domains configuration
4. Implement fallback avatar for broken images

---

## 3. DESIGN LAW VIOLATIONS

### ❌ Dollar Signs Detected (Should Use Units)

#### Violation 1: `/packages` Page

**Rule Violated:** "units not dollars"

**Examples Found:**

1. `$6.99/month` - BTTS Premium Plays
2. `$6.99 / month` - Price display
3. `$0` - Free trial display
4. `$100` - BANK OF DENNIS VIP 365 Days Plan
5. Multiple instances in package descriptions

**Evidence:** `/opt/cursor/artifacts/screenshots/packages-desktop.png`

**Recommendation:** Replace all `$X.XX` with unit-based display (e.g., "699 units/month", "Free", "10000 units")

#### Violation 2: `/terms` Page

**Rule Violated:** "units not dollars"

**Example Found:**

```
(a) ONE HUNDRED U.S. DOLLARS (US $100); OR
```

**Evidence:** `/opt/cursor/artifacts/screenshots/terms-desktop.png`

**Recommendation:** Update legal language to reference "units" instead of dollars to maintain consistency with design system.

### ✅ Gold Color: PASS

No gold color (hsl 45-60°, high saturation) detected on any page.

### ✅ "Handle" Word: PASS

No instances of the word "handle" found in visible content.

### ✅ Pink = Conviction / Blue = Navigation: NOT VALIDATED

(Visual color analysis not performed in this automated audit - requires manual review of screenshots)

---

## 4. LAYOUT & RESPONSIVE ISSUES

### ⚠️ Horizontal Overflow Detected

**Route:** `/sitemap.xml`  
**Viewport:** Mobile (375px)  
**Issue:** Horizontal scrollbar present, indicating content wider than viewport

**Evidence:** `/opt/cursor/artifacts/screenshots/sitemap-xml-mobile.png`

**Impact:** Minor - sitemap.xml is typically not viewed by end users

**Recommendation:** Apply `overflow-x: hidden` or ensure XML formatting doesn't exceed mobile viewport width.

### ✅ All Other Routes: No Horizontal Overflow

- Home, Leaderboard, Discover, Picks, Packages, Cappers, Verification, Support
- Terms, Privacy, Disclaimer, Responsible Gaming, Refund Policy
- All tested at 375px, 768px, 1440px, 1536px viewports

---

## 5. SPARSE DATA STATE OBSERVATIONS

### Home Page (`/`)

**Expected:** Limited verified picks (34 verified vs 5142 self-reported)

**Observed in Screenshots:**

- Home page loads successfully across all viewports
- Avatar loading failures suggest some cappers are being displayed
- Unable to definitively count pick numbers from automated screenshots

**Evidence:**

- `/opt/cursor/artifacts/screenshots/home-mobile.png`
- `/opt/cursor/artifacts/screenshots/home-desktop.png`

**Recommendation:** Manual review of screenshots needed to confirm sparse data messaging is appropriate.

---

## 6. CONSOLE & NETWORK ERROR SUMMARY

### Console Errors by Page:

| Route          | Viewports Affected                        | Error Type               | Count     |
| -------------- | ----------------------------------------- | ------------------------ | --------- |
| `/`            | All (mobile, tablet, desktop, desktop-xl) | Image load failure (400) | 10 errors |
| `/leaderboard` | All viewports                             | Image load failure (400) | 9 errors  |
| `/picks`       | Desktop, Desktop-XL only                  | Image load failure (400) | 2 errors  |
| `/packages`    | All viewports                             | Image load failure (400) | 4 errors  |

### ✅ Clean Console Pages (No Errors):

- `/discover` (all viewports)
- `/cappers` (all viewports)
- `/verification` (all viewports)
- `/support` (all viewports)
- `/terms` (all viewports)
- `/privacy` (all viewports)
- `/disclaimer` (all viewports)
- `/responsible-gaming` (all viewports)
- `/refund-policy` (all viewports)
- `/robots.txt` (all viewports)
- `/sitemap.xml` (all viewports)
- `/api/health` (all viewports)

---

## 7. SCREENSHOT EVIDENCE INDEX

All screenshots saved to: `/opt/cursor/artifacts/screenshots/`

### Homepage Screenshots:

- `home-mobile.png` (649 KB)
- `home-tablet.png` (867 KB)
- `home-desktop.png` (991 KB)
- `home-desktop-xl.png` (1017 KB)

### Leaderboard Screenshots:

- `leaderboard-mobile.png` (216 KB)
- `leaderboard-tablet.png` (240 KB)
- `leaderboard-desktop.png` (253 KB)
- `leaderboard-desktop-xl.png` (254 KB)

### Packages Screenshots (Design Violations):

- `packages-mobile.png` (1.1 MB)
- `packages-tablet.png` (1.4 MB)
- `packages-desktop.png` (1.9 MB)
- `packages-desktop-xl.png` (1.9 MB)

### QA Routes (Should be 404):

- `qa-board-odds-hygiene-mobile.png`
- `qa-board-odds-hygiene-desktop.png`
- `qa-desktop-profile-composition-mobile.png`
- `qa-desktop-profile-composition-desktop.png`

### Additional Evidence:

- Full list of 72 screenshots (18 routes × 4 viewports) available in screenshots directory

---

## 8. RECOMMENDATIONS SUMMARY

### Priority 1 (Critical - Fix Immediately):

1. **Block QA routes in production** - Add route guards/middleware to return 404 for `/qa/*` paths
2. **Fix avatar image loading** - Resolve 400 errors for Supabase-hosted avatar images

### Priority 2 (Design Compliance):

3. **Replace dollar signs with units** - Update `/packages` and `/terms` pages to use unit-based pricing
4. **Implement fallback avatars** - Add default avatar when image load fails

### Priority 3 (Minor Issues):

5. **Fix sitemap.xml mobile overflow** - Apply CSS fix for mobile viewport

### Monitoring Recommendations:

- Set up error tracking for Next.js image optimization failures
- Monitor for 400 responses on image proxy endpoints
- Add automated tests to verify QA routes return 404 in production

---

## 9. TECHNICAL DETAILS

### Test Configuration:

- **Browser:** Chromium (Playwright)
- **User Agent:** Mozilla/5.0 (compatible; ProductionAudit/1.0)
- **Viewports Tested:**
  - Mobile: 375×667px
  - Tablet: 768×1024px
  - Desktop: 1440×900px
  - Desktop XL: 1536×864px
- **Wait Strategy:** networkidle
- **Timeout:** 30 seconds per route

### Audit Duration:

- Total time: ~3.5 minutes
- Routes tested: 18
- Total page loads: 72 (18 routes × 4 viewports)

### Safety Rails Observed:

✅ No users suspended/disabled/deleted  
✅ No packages edited  
✅ No reviews approved/rejected  
✅ No grading run  
✅ No emails sent  
✅ No real picks submitted  
✅ No profiles edited  
✅ No policies published

---

## 10. APPENDIX: RAW DATA

Full JSON audit report available at:
`/workspace/audit-report.json`

Contains:

- All console messages (errors and warnings)
- All network errors (4xx/5xx responses)
- Screenshot paths for every route/viewport combination
- Detailed findings categorization

---

## AUDIT COMPLETION STATUS: ✅ COMPLETE

All requested routes audited successfully. Evidence collected and preserved.

**Next Steps:**

1. Review screenshots for visual verification
2. Address Priority 1 critical issues
3. Implement design compliance fixes
4. Re-audit after fixes deployed
