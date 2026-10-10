# Build brief — Presence

Presence is the Now door read from stores that already exist. A presence stamp, an event, and a thought are ordinary tracking rows. They do not store `source: "now"`. The only dual clock is a wellbeing datapoint (`at` versus `createdAt`). Plan steps can carry `attributes.headerTracking = "plan"`. There is no dialog-open history and no `createdAt` on time entries. Check-in rhythm and estimate-versus-later-truth stay empty frames.

**Later owner:** one presence agent.

**Files:** `components/Analytics/MetricsTrends.tsx`, `components/Analytics/MoodFieldView.tsx`, and a new presence plate file under `components/Analytics/` if the counts and the lag histogram need a home of their own. Do not edit `TrackingAnalytics.tsx`. The joint mood/company dwell link is named here; the tracking agent owns that file.

Source: `docs/analytics-vision/04-now.md` and the Now section of `docs/analytics-vision/ANALYTICS_VISION.md`.

Keep the five wellbeing series and the mood mosaic. Add plates beside them.

---

## Keep

### Five wellbeing series

- **Component:** `MetricsTrends.tsx`
- **Store:** `useMetricsStore` (`brain2-metrics-store`). A datapoint does not record which door logged it.
- **Draw:** small multiples of Joy, Suffering, Alignment, Self satisfaction, and Situational satisfaction, the phosphor detail chart for the picked series, and the **Log {name}** button into `MetricLogger`. Points sit at `at`. A blank key is absent, not zero. Do not forward-fill. Do not draw a line across a gap longer than 6 hours.

### Painted mood

- **Component:** `MoodFieldView.tsx`
- **Store:** mood-scope `TimeEntry` rows in the timegrid, plus the same metrics store for the logged-metrics readout.
- **Draw, and do not remove:** mood pens mosaic (any painted name), **Same word**, **The water** (`cast`, `sociability`, `initiative`, and vibe phrases), **Marks** (the other ranks, each with n; missing marks left out). A color with no card stays out of the averages. Hour × day and the logged-metrics readout stay. Until a `moodReading` is stored, mood here is the pen or `moodReading.word`, not a nine-rank trajectory.

---

## Plates to add

### Wellbeing lag

- **Where:** `MetricsTrends.tsx` (or the new plate file mounted from it).
- **Formula:** `lag_min = minute(createdAt) − minute(at)` in local time. Positive is written after the minute it names. Zero is same-minute logging. Negative is `at` set in the future relative to `createdAt`, or clock skew.
- **Draw:** a histogram of that lag. Caption it **timeliness**. This is not accuracy and does not belong on a calibration plot.
- **Missing:** a key left blank stays absent. A datapoint with only `context` and no values is a timestamped note, not a zero vector. Do not zero-fill a blank axis when the metrics store is empty.

### Estimate-minute share

- **Where:** a count beside Mood (`MoodFieldView.tsx`) or beside Metrics (`MetricsTrends.tsx`). One count, not both as two formulas.
- **Rows:** non-instant tracking intervals in the shared window whose estimate flag is set: `precision === "estimated"` or `clockCertainty === "estimated"` (the same test as `blockIsEstimated`).
- **Draw:** estimated occupied minutes beside occupied minutes, as a count. Extension of an already estimated neighbor looks the same as an explicit sequence estimate after a merge. The caption says the flag is still on the surviving block. It does not say the estimate was later corrected.

### Header-plan tag

- **Where:** the new plate file, linked from Metrics or Mood so Presence has one door.
- **Rows:** tasks with `attributes.headerTracking = "plan"`.
- **Draw:** the count of those tasks, linked to the Plan room (`PlanVsReality`, view id `plan`). Do not build plan adherence, followed, skipped, or unplanned here. `recordPlanFollowed`, `recordPlanSkipped`, and `insertUnplanned` are not called from the Now pane.

### Joint mood / company dwell

- **Where:** a link only.
- **Draw:** a link to Tracking’s joint mood/company dwell (the cube on `TrackingAnalytics.tsx`). The tracking agent owns that link target. Presence does not recompute occupancy with a second formula.

---

## Blocked

One empty frame. Do not invent a series. The frame shows this sentence and nothing else:

> Check-in counts, overwritten pen, dialog open/close, and calibration of an estimated interval against the exact one that replaced it. These wait on an assertion log.

| Plate | Why it is empty |
| --- | --- |
| Check-in counts | Dialog open, pane, and lane choice die with the dialog. A presence interval has one clock (`startMin` / `endMin`). There is no `createdAt` on `TimeEntry`. |
| Overwritten pen | An open now-stamp deletes the previous pen on those minutes. The previous value is not stored. |
| Dialog open/close | `open` and pane are React state. There is no persisted sample of looking at Now. |
| Estimate versus the exact interval that replaced it | A later exact paint replaces the estimated minutes. Both sides do not survive, so this is not a reliability diagram. |

---

## Plates

1. Five wellbeing series (keep)
2. Mood pens mosaic (keep)
3. Same word (keep)
4. The water (keep)
5. Marks (keep)
6. Wellbeing lag histogram
7. Estimate-minute share
8. Header-plan tag
9. Joint mood/company dwell (link only)
10. Check-in counts (blocked)
11. Overwritten pen (blocked)
12. Dialog open/close (blocked)
13. Estimate versus the exact interval that replaced it (blocked)
