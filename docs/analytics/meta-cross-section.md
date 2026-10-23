# Meta → Cross-section

_Last mapped: 2026-10-23_

`components/Analytics/CrossSection.tsx`, series in `cross-section.ts`. Also mounted inside Observatory.

## Information
Thirteen day-aligned strips from `buildCrossSection`: habits, tracking, sleep, completions, points, operations, regret, mood minutes, joy, switches, places (distinct Location pens), goal-linked completions, Screen Time. Missing stays blank. Zero is a real value. `n` = days with a reading.

## Fixes (2026-10-23)
- The fill ramp was built for the old dark well: more = lighter, zero = near-black. On the new paper that read backwards. Now more = darker (`sequentialFill` in `meta-plots.tsx`), zero is a faint wash, missing stays clear.
- Long labels ellipsize instead of pushing the grid.

## New controls
- **Rows**: one chip per series. Click to hide or show it.
- **Compare to**: pick an anchor series. Each row gets an `r` column against it (shown only with 7+ shared days, else `·`). The anchor row shows ◆.
- **Sort**: house order, most observed, or closest to anchor (|r|).
- Hover a column to read every strip; click to pin (unchanged). This is IIB's **Truth barcode** stack.

## Planned
- Brush a date span and send it to the Analytics range.
- Per-row z-score mode so rows with different units share one ramp.
