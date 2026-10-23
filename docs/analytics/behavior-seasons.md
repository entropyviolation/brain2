# Behavior → Seasons

_Last mapped: 2026-10-23_

Files: `components/Analytics/SeasonsView.tsx`. Shared plates live in `components/Analytics/behavior-kit.tsx` (skin: `behavior-views.css`). Smoke test: `components/Analytics/behavior-views.test.tsx`. Ideas: `docs/analytics/viz-inspiration.md` → Behavior.

## What it shows

- Not the shared window: this year and last, by calendar quarter (`lib/seasons.ts`: Q1 Spring, Q2 Summer, Q3 Fall, Q4 Winter).
- Completions (`getTaskCompletionDate`), points (`pointsHistory`), quarter rituals (`reviews` with period `quarter`), season goals (`goals` with `periodKind: "quarter"`, `goalProgressPercent`).

## Fixed

- `YearRow` was a component defined inside the render, so React remounted it every render. Now a plain render function.
- Season names were hardcoded in a second place. Now `SEASON_BY_QUARTER`.
- Season goals were in insertion order with a bare %. Now sorted by progress with a meter.

## Added

- **Measure** select (completions, points, season rituals) drives the plates below it.
- **Mirror split** (`seasons-mirror`): last year left, this year right, per season, with totals.
- **Season wheel** (`seasons-wheel`): four wedges, inner = last year, outer = this year, depth ∝ √value, `SEASON_STYLE` colors.
- **Quarter pace** (`seasons-pace`): so far, straight-line projection (so far ÷ days elapsed × days in quarter), same quarter last year, % change, meter with last-year tick.

## Ideas not built

- Three or more years once data exists (wheel rings per year).
- Season goals joined to completions linked by objective.
