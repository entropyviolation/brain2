# Behavior → Reflection

_Last mapped: 2026-10-23_

Files: `components/Analytics/ReflectionView.tsx` + `CompletionReviewPlates.tsx` (shared with Goals, not edited here). Shared plates live in `components/Analytics/behavior-kit.tsx` (skin: `behavior-views.css`). Smoke test: `components/Analytics/behavior-views.test.tsx`. Ideas: `docs/analytics/viz-inspiration.md` → Behavior.

## What it shows

- `tasks[].completionReview` in the window (by `completedAt`): satisfaction, distraction (later Reflect), and the quick-review scales in `REFLECTION_SCALES` (expected / actual difficulty, enjoyment, resistance, energy, focus, meaning). All 0–10.
- `actualDuration`, `durationCertainty`, `reviewPoints`, `reflectNotes`.
- `summarizeCompletionReviews` (`lib/completion-review.ts` ~596) feeds the plates and `difficultyPairs`.
- Goals and objectives only for titles in the plates.

## Fixed

- Trajectory chart had no title or legend, and its y axis started at 1 on a 0–10 scale. Now a plate with a title, help, HTML legend and `connectNulls`.
- Reflect list and Prompt history grew without limit. Both are folds now, with show-more; history has a search over title and note.

## Added

- **Score spread** readouts: mean ± sd and n for every scale with data.
- **Evidence bubbles** (`reflection-bubbles`): pick the x and y scale, size = actual minutes, dashed median lines, Pearson r with a small-n caveat. Click opens the Reflect dialog.
- **Mirror split** (`reflection-mirror`): expected left, actual right, sort by biggest miss / harder first / title, with harder · easier · same counts.

## Ideas not built

- Feelings by goal (join with `goals`) as small multiples.
- Notes word tiles from `reflectNotes`.
