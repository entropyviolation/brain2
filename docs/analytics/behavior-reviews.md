# Behavior → Reviews

_Last mapped: 2026-10-23_

Files: `components/Analytics/ReviewsView.tsx`, `PeriodArcReading.tsx` (not edited). Shared plates live in `components/Analytics/behavior-kit.tsx` (skin: `behavior-views.css`). Smoke test: `components/Analytics/behavior-views.test.tsx`. Ideas: `docs/analytics/viz-inspiration.md` → Behavior.

## What it shows

- `reviews` in the window (by `completedAt` or `periodKey`): day / week / month / quarter / year.
- Day `morning`: sleep clocks, dream, affirmations, to-dos added, priorities (tasks, habits), circumstances, best-day-why, gratitude, source, completed.
- `start` ritual, `summary`, `gratitude`, `nextPlans`, resolved / pushed ids, `blockedReasons` (task → reason).
- `collectMissReasonCorpus` (`lib/miss-reason-corpus.ts`): why-not notes from pushes, missed tasks, habits, missed ops, rituals, with source and reason token counts.

## Fixed

- Every morning ritual rendered open, one after another. Now one fold, newest open, five at a time.
- The review list had no limit. Now a fold (open when ≤ 10).
- Review card headers were clickable `<header>`s with no keyboard access. Now `role="button"`, focusable, Enter/Space, `aria-expanded`, a ▸/▾ mark.
- Why-it-didn't notes were a bare list of every note. Now an `an-list` with show-more.

## Added

- **Ritual calendar** (`ritual-strip`): one square per day (done, started, day review only, nothing), with mornings done %, current run and longest run.
- **Gratitude words** (`gratitude-words`): word tiles sized by frequency over all gratitude lines, stop words dropped (`topWords`).
- **Reason tiles** (`miss-reason-tiles`): periodic-taxonomy tiles per reason token, count plus the latest typed words. Click to filter.
- Why-notes: search, source chips with counts.

## Ideas not built

- Plan vs done: morning priorities joined to completion that day.
- Sleep clocks from mornings as a bed/wake barbell (overlaps Sleep view; link, do not copy).
