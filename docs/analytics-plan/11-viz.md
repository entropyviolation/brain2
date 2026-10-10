# Build brief — how a new plate looks

This brief is the visual law for every later implementation agent. A plate that follows it is the same light instrument studio the Analytics tab already is. Beauty is composition of the kit that already exists. Do not invent a color system.

Source of the look: the product law in `components/Analytics/README.md`, the exports and header of `components/Analytics/studio-kit.tsx`, the exports and header of `components/Analytics/studio-plots.tsx`, and the empty / thin furniture in `components/Analytics/chart-frame.tsx`. Range and the left index stay the house milled fascia. Canvases stay Win95 face (`#c0c0c0` / `--an-paper`), ink `#000000`, Karla only, nested milled wells, and **white plot wells** (`--an-hi`) inside milled rims.

**Later owner:** every implementation agent follows this brief while building their own plates. There is no separate viz agent that restyles files. A viz agent may only add a shared word-cloud component and a join-caption component if they do not already exist, under `components/Analytics/`, without changing existing chart math.

---

## Reach for these, in this order of fit

Ribbon lanes are the filmstrip language already on Tracking: `PeriodFilmstrip` for the window, and the average-day ribbons under it. Use this when the question is what occupied the minutes in order.

`HourDayHeatmap` — use this when the question is which hour of which day held the minutes.

`DensityCalendar` — use this when the question is how a daily rate sits on the calendar.

`SliceMosaic` — use this when the question is area share across many named slices and a pie would hide the small ones.

`SlicePie` — use this when the question is a few shares of one whole (white 2px gaps, hole label, opaque fills; hover dims other sectors).

`SliceTreemap` — use this when the question is nested area (a parent and its children) and order inside the parent matters less than size.

`AlluvialChart` — use this when the question is how mass moved from one named set of buckets to another.

`HorizonChart` — use this when the question is the shape of a long daily series and a full spark would be too tall.

`ViolinHistogram` — use this when the question is the spread of durations or amounts, not their order in time.

`PhosphorTrace` — use this when the question is a line through time. Phosphor `#3dff8a` is the series on the scope; the well around it stays face gray.

`SplitBar` — use this when the question is one row of name · duration · percent.

`StudioBars`, `StudioReadout`, `FindingBlock`, `RidgelineChart`, `BeeswarmChart`, `Slopegraph`, `UpsetChart`, `HourPenSmallMultiples`, `CyclePlot`, and `StudioSpark` stay in the kit. Reach for them when the plate is already that picture. Do not redraw them in a new geometry.

## Plate order

A plate (`.an-plate`) answers one question. Put one sentence of what it answers, then the plot well, then **n** and the exclusion count. Plates sit 16px apart.

## Empty, thin, and missing

Empty and blocked frames use `ChartFrame`. The sentence is the content (`emptySentence` / `thinSentence`). `OpenInListsButton` is already the jump. Do not draw a zero bar, a blank heatmap, or a KPI for missing data. A thin window is watermarked and the finding is withheld.

## Estimated minutes

Estimated minutes are hatched and stay in the default view. An observed-only control drops them and says how many minutes that hid.

## Joins

A join card caption states the join key and the partial side in one line under the title.

## Hover and help

`CanvasTitle` carries the `?` (`StudioHelp`). Controls use a native `title`. `ANALYTICS_TAB_HELP` stays the one line under the nav. Do not add a second `?` on the nav.

## What stays put

Do not restyle Lists, Home, Habits, Plan, Tracking, Scheduler, or Operations. Do not restyle the Analytics `.fm98` title bar or status bar. Do not introduce a dark CRT theme, cream paper, or a new accent. Phosphor `#3dff8a` is for line traces only.

Drill and popup titles stay `.an-drill` / `.an-popup`: crisp Karla, opted out of CRT glow.

## Word cloud

The language room’s word cloud is the one new picture the kit does not have. Set it as type in the white plot well. Size follows count. Karla, ink on white. Two modes: function words set aside, and function words kept. It is not a colored blob theme. The lines themselves sit in a list under the cloud.
