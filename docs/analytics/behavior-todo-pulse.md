# Behavior → To-do pulse

_Last mapped: 2026-10-23_

Files: `components/Analytics/TodoPulseView.tsx`. Shared plates live in `components/Analytics/behavior-kit.tsx` (skin: `behavior-views.css`). Smoke test: `components/Analytics/behavior-views.test.tsx`. Ideas: `docs/analytics/viz-inspiration.md` → Behavior.

## What it shows

- `tasks[].dayRatings[YYYY-MM-DD]` → importance, excitement (0–10, per day).
- `tasks[].resistanceReadings[]` → value 0–10 with `at` and `source` (a series, not one value).
- Tier from `getTierFromTask` (urgency + importance), `estimatedDuration`, `rewardValue`.
- `reviews` day mornings → source (telegram text pipeline vs desktop).
- Note: the item list includes any task with a duration or points, in or out of the window. That is on purpose ("live on the item anytime"); a new checkbox narrows it.

## Fixed

- **Bug:** resistance points were sorted by their "M/D" label as a string, so 10/3 came before 9/30. Now sorted by time.
- The help box used Tailwind dashed borders off the house skin. Now a fold.
- Bars and line had no legend and used off-palette colors. Legend added, colors from `BEHAVIOR_FILL`.
- The item list is a fold with search, sort and show-more.

## Added

- **Quadrant scatter** (`pulse-quadrant`): x = latest resistance, y = latest excitement, size = importance, lines at 5. Corners Joy / Hook / Chore / Dread with counts. "As of" slider walks the rated days.
- **Tier mix** bars with summed expected hours per tier.
- Item list: sort by latest resistance, expected minutes, points or title; "Rated in window only".

## Ideas not built

- Resistance decay: first vs last reading per item (slopegraph).
- Excitement vs done: do high-excitement items finish sooner? Needs completion join.
