# Behavior → Overcommit

_Last mapped: 2026-10-23_

Files: `components/Analytics/OvercommitmentView.tsx`. Shared plates live in `components/Analytics/behavior-kit.tsx` (skin: `behavior-views.css`). Smoke test: `components/Analytics/behavior-views.test.tsx`. Ideas: `docs/analytics/viz-inspiration.md` → Behavior.

## What it shows

- `summarizeOvercommitment` (`lib/overcommitment.ts` ~173): daily day-pushes reconstructed from `daysPushed` ending at the schedule, daily logged minutes from `timeLogs`, trends, change points, floor `SAMPLE_FLOORS.overcommitment`.
- `weeksPushed`, `monthsPushed` on the vault (lifetime counts).
- New joins: completions per day (`getTaskCompletionDate`), lifetime `daysPushed` on open items.

## Fixed

- Two-axis line chart had no legend saying which axis is which. HTML legend added, palette colors.
- The second Open in Lists button was dropped from the new plate so the view keeps one jump (the test expects one).

## Added

- **Readouts** (`overcommit-readouts`): day-pushes and per day, logged hours and min/day, completed, push : done ratio, push trend per day. Change points as one sentence when found.
- **Pushed vs done steps** (`overcommit-steps`): per 7-day block, pushes vs completions side by side, with how many weeks pushed more than they finished.
- **What keeps sliding** (`overcommit-squares`): open items as sized squares (area ∝ lifetime day-pushes), min-pushes slider, title search, click to read week/month pushes. This plate shows even when the window is thin.

## Ideas not built

- Capacity line: logged hours vs planned hours (needs the Plan store; see Plan vs Reality).
