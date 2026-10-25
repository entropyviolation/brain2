# Accuracy → Goals

_Last mapped: 2026-10-25_

File: `components/Analytics/GoalsAnalytics.tsx`, plus `GoalTexturePlate` from `CompletionReviewPlates.tsx` (shared with Reflection, not changed here). Math: `lib/objectives.ts` (`goalProgressPercent`, `goalsNeedingAttention`), `accuracy-stats.ts` (`goalPace`).

## Information
- Goals: target, current, unit, period kind, start / end / deadline, completed.
- Objectives (count only here).
- Tasks completed in window with `contributesToGoalIds` or `contributesToObjectiveIds`.
- Neglect: no linked action in 14 days. `goalsNeedingAttention` reads `links` only, not `contributesToGoalIds`, so a goal can show as neglected while it has contributing completions.

## Plates
- Readouts, progress bars (now titled), neglected list (now titled), Open in Lists, hard / joyful texture plate.
- **New, on pace?** (IIB *When Sea Levels Attack*, step heights): per goal, progress bar with a tick where a straight line from start to deadline says you should be, gap in points, days left, needed per day. Filter by period, sort by most behind, most progress, or ending soonest.
- **New, where the work went** (IIB *20th Century Death*, size by cause): one bubble per open goal, area ∝ contributing completions in the window. Grey or orange when nothing was linked (orange = also neglected).

## Math
- Elapsed = (now − start) ÷ (end − start). Start = `startDate` or `createdAt`; end = `deadline` or `endDate`. With no end date, a day / week (Monday start) / month / season / year goal is paced across the current calendar period (`periodSpan`). Custom and aspirational goals without dates show —.
- Days left drops one hour before rounding up, so a DST shift does not add a day.
- Gap = progress − elapsed. Needed / day = (target − current) ÷ days left.

## Research notes
- Goal-gradient: effort rises near the end (Hull 1932; Kivetz, Urminsky & Zheng 2006). A straight pace line is a neutral baseline, not a prediction.

## Ideas not built
- Objective-level roll-up bubbles.
