-- Mis-graded pick remediation — 2026-08-06
-- Run in the Supabase SQL editor against the SCL prod project (ljndtpzuslxgpnlxfhbz).
-- Read-only audit first, then two write blocks. Each is independently safe to re-run.
--
-- Background: four grader defects were fixed today (#407 fixture window, #414
-- period markets, #415 player props, #418 team abbreviations / price-as-spread).
-- The code is fixed going forward; these statements repair records already
-- settled by the broken logic.

-- ---------------------------------------------------------------------------
-- 0. AUDIT (read-only) — confirm the blast radius before writing anything.
-- ---------------------------------------------------------------------------
select
  count(*)                                                                   as suspect_plays,
  count(*) filter (where g."createdAt" < coalesce(p."eventStartsAt", p."createdAt"))
                                                                             as graded_before_first_pitch,
  count(distinct p."capperId")                                               as cappers,
  round(sum(abs(p."profitUnits"))::numeric, 2)                               as units_at_stake
from scl."Play" p
join scl."GradingAudit" g on g."playId" = p.id and g.source = 'AUTO'
where g."createdAt" < '2026-08-06 10:06:00'
  and g."createdAt" - coalesce(p."eventStartsAt", p."createdAt") < interval '2.5 hours';
-- Expected at time of writing: 48 plays, 11 graded BEFORE first pitch, 17 cappers.


-- ---------------------------------------------------------------------------
-- 1. THE THREE CONFIRMED WRONG GRADES (price read as the spread line)
-- ---------------------------------------------------------------------------
-- "TBR -147" style selections parsed as a SPREAD of -147 — a margin no baseball
-- game reaches — so they settled LOSS regardless of who won. Fixed in #418 by
-- MAX_PLAUSIBLE_HANDICAP. All three verified against two box-score sources:
--   Reds  won 5-4 vs Athletics, 2026-08-04  -> "Reds -125" is a WIN
--   Rays  won 9-7 vs Rockies,   2026-08-04  -> "Rays -158" is a WIN (x2)
begin;

insert into scl."GradingAudit"
  (id, "playId", "previousOutcome", "newOutcome", "previousProfitUnits",
   "newProfitUnits", source, "gradedById", reason, "createdAt")
select
  'fix4-' || substr(md5(p.id), 1, 18),
  p.id, p.outcome, 'WIN', p."profitUnits",
  round(p.units * 100.0 / abs(p."oddsAmerican"), 2),
  'MANUAL', null,
  'Grader defect, not a judgement call: the American price was read as the spread line, '
  || 'so this settled LOSS regardless of the result. Verified against two independent box scores. '
  || 'Root cause fixed in PR #418 (MAX_PLAUSIBLE_HANDICAP).',
  now()
from scl."Play" p
where p.id in ('cmsfbux0a0004elx098g6ad41',  -- wgs     "Reds -125"
               'cmsfbux0a0006elx0rnfoc6pe',  -- wgs     "Rays -158"
               'cmsfbvkfk001gelx0k9du8hhc')  -- wgspod  "Rays -158"
  and p.outcome <> 'WIN';

update scl."Play" p
set outcome      = 'WIN',
    "profitUnits" = round(p.units * 100.0 / abs(p."oddsAmerican"), 2),
    "gradedAt"    = now()
where p.id in ('cmsfbux0a0004elx098g6ad41',
               'cmsfbux0a0006elx0rnfoc6pe',
               'cmsfbvkfk001gelx0k9du8hhc');

commit;


-- ---------------------------------------------------------------------------
-- 2. THE 48 IMPOSSIBLY-FAST GRADES — reset to PENDING and let the fixed
--    grader re-settle them.
-- ---------------------------------------------------------------------------
-- These were settled by the pre-#407 matcher, which used an 18h fixture window
-- and resolved ties by provider array order. Eleven were settled BEFORE first
-- pitch; the rest inside 2.5h, which is faster than a 9-inning game can finish.
-- Every one was therefore graded against a DIFFERENT, already-final fixture.
--
-- Resetting rather than hand-correcting is deliberate: the corrected grader
-- (4h window + `sole()` ambiguity refusal) re-settles what it can prove and
-- leaves anything ambiguous PENDING for review, which is the safe direction.
-- The next grade-cron run picks them up; ESPN's settled pool covers 14 days,
-- so games back to 2026-08-02 are still resolvable.
begin;

insert into scl."GradingAudit"
  (id, "playId", "previousOutcome", "newOutcome", "previousProfitUnits",
   "newProfitUnits", source, "gradedById", reason, "createdAt")
select
  'reset-' || substr(md5(p.id), 1, 17),
  p.id, p.outcome, 'PENDING', p."profitUnits", null, 'MANUAL', null,
  'Reset for re-grading: settled by the pre-#407 matcher against the wrong fixture, '
  || round(extract(epoch from (g."createdAt" - coalesce(p."eventStartsAt", p."createdAt")))/3600.0, 2)
  || 'h after first pitch — faster than the game could finish.',
  now()
from scl."Play" p
join scl."GradingAudit" g on g."playId" = p.id and g.source = 'AUTO'
where g."createdAt" < '2026-08-06 10:06:00'
  and g."createdAt" - coalesce(p."eventStartsAt", p."createdAt") < interval '2.5 hours'
  and p.outcome <> 'PENDING'
  -- Leave block 1's three alone; they are already correct.
  and p.id not in ('cmsfbux0a0004elx098g6ad41',
                   'cmsfbux0a0006elx0rnfoc6pe',
                   'cmsfbvkfk001gelx0k9du8hhc');

update scl."Play" p
set outcome       = 'PENDING',
    "profitUnits" = null,
    "gradedAt"    = null
from scl."GradingAudit" g
where g."playId" = p.id
  and g.source = 'AUTO'
  and g."createdAt" < '2026-08-06 10:06:00'
  and g."createdAt" - coalesce(p."eventStartsAt", p."createdAt") < interval '2.5 hours'
  and p.outcome <> 'PENDING'
  and p.id not in ('cmsfbux0a0004elx098g6ad41',
                   'cmsfbux0a0006elx0rnfoc6pe',
                   'cmsfbvkfk001gelx0k9du8hhc');

commit;


-- ---------------------------------------------------------------------------
-- 3. VERIFY (read-only) — run after the grade cron has fired at least once.
-- ---------------------------------------------------------------------------
-- Anything still PENDING here is the honest outcome: the corrected grader could
-- not prove a single matching fixture and is waiting for review rather than
-- guessing. Anything still graded impossibly fast means block 2 did not apply.
select p.outcome, count(*)
from scl."Play" p
join scl."GradingAudit" g on g."playId" = p.id and g.source = 'MANUAL'
where g.reason like 'Reset for re-grading%'
group by 1;
