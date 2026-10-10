# Build brief — Day, Shape, Clock

Three rooms that compose pictures already specified. They do not fork occupancy (union, one owner per minute) or habit grade math (`calculateDayPercentageAV` and the raw / curved / blended split in Habits).

Source: `## Information architecture` and `### The day as a joint cube` / `### Time of day` in `docs/analytics-vision/ANALYTICS_VISION.md`. Shell facts: `components/Analytics/README.md` (`enhanced-analytics.tsx`, `useAnalyticsRangeStore`, Open in Lists, `entry-dialog` / `LogActivityDialog`). Seeds to import, not replace: `PeriodFilmstrip.tsx` (one day of the ribbon), `CrossSection.tsx` (linked day columns, missing stays missing), `CircadianView.tsx` + `hour-day.ts` (the hour × day atlas).

**Later owner:** one day-landing agent.

**New files only** (names the agent may tighten, ownership may not):

- a day-card module (one local date, five blocks)
- a shape-calendars module (five thin calendars + the cluster strip the vision already names on Shape)
- a clock-stack module (hour 0–23 lanes)

Those files may import filmstrip, hour-day, and cross-section helpers. They must not rewrite `TrackingAnalytics`’s composition plate or `HabitsView`’s grade math.

**View ids:** `day`, `shape`, `clock`.

**Home of `circadian`:** it stays the existing Time-group id on `CircadianView`. That view remains the hour × day occupancy atlas (Activity default, Mood) plus the Cleveland weekday cycle. `clock` does not take that id and does not paint a second heatmap of the same occupancy. Clock’s tracking lane is the hour profile (mean minutes in the hour, 0–60) from the same `hour-day` helpers. A control on that lane opens `circadian` for the atlas.

---

## Shell

`EnhancedAnalytics` still owns the window: title, one remembered range, nav, one lazy view, status. Register `day`, `shape`, and `clock` in `analytics-tabs.ts` and `analytics-views.tsx` as new ids. Do not rename or drop `circadian` or any other existing id.

**Default landing.** When no last view is persisted, the open view is `day`. A persisted id still wins. The studio index may place the three rooms together; group choice is the shell agent’s as long as the ids resolve.

**Shared range.** Chips, custom from–to, week / month / season, Prev / Next stay `useAnalyticsRangeStore`. Day does not rewrite that window. Shape does not rewrite it either (see below). Open in Lists stays `open-in-lists.ts` / `an-open-lists`. Tracking entry UI stays `entry-dialog`; a gap stays `LogActivityDialog`. Titles stay crisp `.an-drill` / `.an-popup`. This tab does not paint: Day drill may open those same dialogs and must not invent a second editor. The filmstrip already opens Log activity; reuse that path.

**As-of.** When a habit grade is on the card or a Shape cell, the as-of date is visible and uses the same rule as the habit grid.

**Empty.** An empty block, hour, or day keeps its frame and one sentence. It is not a zero, and it is not a single score. No forecast caption until that forecast’s error has been computed. Blocked rooms in the vision (assertion log, TimeEntry write timestamps, attendance, free-block outcome, and the rest of that table) stay sentences in empty frames if a control would otherwise imply them.

**Cycle latch.** Phase is omitted when concealed, the same way the shell conceals Cycle phase.

---

## `day` — Day

One local date. Five blocks. None of them averaged into a day score.

**Which date.** Today, local. If today has none of the five blocks and the person is looking backward, the last local date that has any block. The date is labeled. Prev / Next on this card step one local date. They do not step the shared analytics range. A date with every block empty still renders the five empty frames once the person has chosen it (including today, when today is the landing because it is not empty, and including a Shape click).

**First paint — the day card.**

| Band | What it shows | Rule |
| --- | --- | --- |
| Tracking ribbon | One local day in the filmstrip language | One owner per minute. Painted minutes plus gaps equal 1440. Gaps are gaps. Instants do not fill coverage. Import the filmstrip segment builder for that single date; do not restyle Tracking’s period strip. |
| Plan lanes | Events; planned actions by free / todo / habit; timed tasks with no placement | Commitment may double-count overlaps — label it as commitment. Tracking occupancy does not. Unknown window is a state, not a fine day. Inbox stays out. All-day events add no minutes. Week-only tasks sit on the unplaced rail, not at a fake 09:00. Free blocks have no outcome. |
| Habit strip | Raw day % beside curved day % | Ratios and exempt marks. Not fake minutes. Not one grade blob. Blended only if that reader toggle is on, and then as a third number. Offer a second raw percent with echo parents removed, labeled. A vacant day is vacant, not zero. A grade of 0 with `daysIncluded` 0 is “no open days.” |
| Wellbeing ticks | Points whose `at` falls on the date | No points is empty, not a zero vector. Hover shows lag from `createdAt`. Keys absent on a point are skipped. |
| Provenance hairline | Only on a row that carries a stamp | Unstamped writes draw no hairline. If the telegram-day flag is on, the card names which stamp fired. |
| Quality strip | Worst overlapping minutes, and estimated share | Same occupancy union and the same estimated-share definition Tracking already uses. Open-until-midnight tails stay hatched if that is how Tracking marks them. |

Labels on the card state both facts: plan commitment double-counts overlaps; tracking occupancy counts a minute once.

**Drill.** Day → minute → record. Shape’s cell click is the other door into this date.

**Minute.** The cube at that `startMin`.

- Each tracking scope: the covering pen, or missing. Unknown clocks are not forced onto minute 0; instants at that minute sit in a side list.
- Plan blocks whose windows cover the minute, by source (event, planned action, placed task).
- Wellbeing points whose `at` is that minute, with lag.
- Habit cells stay on the day strip. They do not pretend to occupy the minute. They are listed as “linked through this minute,” with the link named, only when a tag-minute set, a sleep clock (`sleptMin` / `wokeMin`), or a planned-action window covers that minute. A keyword flag without a clock stays on the day strip. `updatedAt` is an edit clock, not occupancy.

**Record.** The row, read-only, then the existing opener:

| Record | Drill shows | Opener |
| --- | --- | --- |
| `TimeEntry` | Pen, secondaries, tags, variants, title, notes, project, books, pages, mood reading, precision, clock certainty, `generatedBy`, `estimateOf`, span siblings, `splitAfter` | Tracking entry dialog |
| `Task` | Schedule grain, placement resolutions, completion fields, `headerTracking`, time logs, estimates | Open in Lists |
| `CalendarEvent` | Clock or banner, checklist readiness, whether the id is in `confirmedEventIds`, overlap minutes. No attendance field. | Open in Lists when the event is an item; otherwise the row only |
| `PlannedAction` | Source, `sourceId`, duration, and the task or habit it claims, or “free, no outcome.” | The claimed task via Open in Lists; a free block has no outcome drill |
| `TaskCompletion` | Ratio, met, source flags, keyword flag, `updatedAt`, exempt reason. Current goal labeled as current. | — |
| `SleepNight` | Both clocks, precisions, `updatedAt`, all-nighter and its source | — |
| `MetricDatapoint` | Values present, `at`, `createdAt`, context | — |
| `AppendLogEntry` | Text, `createdAt`, `stampSuffix`, and whether the key is a day, week, month, season, or a day note | — |
| `IngestEvent` | Only if it is still in the 200: kind, status, channel, raw. Otherwise say the conversation row has rotated and show the domain stamp. | — |

Click a gap for the untracked note and Fill range, through the existing Log activity dialog. Do not paint a new block from this tab.

---

## `shape` — Shape

**Window choice.** A fixed 28 local dates ending on the shared range’s end date.

The vision calls the 28-day shape one step away from the day, and names it “last 28 days,” not “whatever the chips selected.” A lens clipped inside the range would become 7 days when the studio is on 7, and would stop being that step. Ending on the range end keeps Prev / Next honest: stepping the studio window steps the 28 with it, so a person looking at an older month sees the 28 days that end where that window ends. Empty days inside the 28 stay in the calendars. Days of the 28 that fall outside a shorter studio window still paint; the range label still describes the studio window, and the Shape kicker states the 28 and its end date. Clicking a cell opens `day` on that date and does not move the remembered range (same restraint as Find blocks when a hit sits outside the window).

**Five thin calendars.** One cell per date in the 28, including empty dates.

| Calendar | Ink | Missing |
| --- | --- | --- |
| Tracking coverage | Occupancy union for that date | An empty day is an empty cell, not 0% sold as a life |
| Plan commitment | Commitment only where the window is known | Unknown window in neutral ink. Not a fine day and not zero |
| Habits | Raw day %; curved as a layer on the same cell | Vacant is vacant. Raw stays readable beside the curve. Echo parents called out the same way as on the day card |
| Wellbeing | Count of datapoints whose `at` is that date | No points is empty, not a zero vector |
| Phone | Telegram-day mark | Only where a stamp exists. Unstamped writes do not mark the cell |

**Cluster strip.** Under the calendars, when the 28 is long enough to name repeats. Distance uses the vision’s day vector: Tracking’s 24 hour-bins of Activity at Category depth, coverage, sleep missing-flag, phase one-hot only if the latch is open; a small plan block (commitment, stacked minutes, window-known, banner); a habit block of raw day %, vacant, stone count. Curved and blended stay out of the distance. Wellbeing stays out unless the window can define a bin; otherwise a missingness flag. Telegram-day is a label drawn on the cluster, not a dimension. k from 2 to 5, by stability when a random week is dropped. Name each cluster by its median ribbon, one plan sentence, and one habit sentence. Short history: show the days and skip the claim. Click a cluster to its member dates, and a member date to `day`. Footnote that habit coordinates sit under the current goal. Do not cluster on raw pen ids or the 10-pip value.

---

## `clock` — Clock

Hour axis 0–23, local, for every lane. Daypart words are labels on top of that axis. Say which cut a chart used. Plan bins (morning 05:00–11:59, afternoon 12:00–16:59, evening 17:00–20:59, night 21:00–04:59) apply only when the question is preference fit. Do not average those labels with Tracking’s 5–12 / 12–17 / 17–22 / 22–5 cut.

The stack reads the shared range for its sample, and says n. Shape’s 28 is not this stack’s window. Missing hours on the circadian atlas stay the atlas’s rule (0 in the heat, not called occupancy). Clock’s own profiles follow Time of day: unknown clocks excluded; GPS 15-minute floor excluded from a start histogram when the block is still identifiable; sample size gates color.

| Lane | Picture | Do not |
| --- | --- | --- |
| Tracking mix | Mean minutes in each hour, 0–60, pens and gaps. Weekend vs weekday only with at least four days on each side. Estimated Screen Time as its own profile. Scope divergence (Activity vs Location) as a quality companion. | A second hour × day heatmap. Open `circadian` for that atlas. |
| Plan minute load | Timed events, planned actions, and tasks with `scheduledTime`, split across hours. Prefer a `todo` placement over the task clock when both exist. Events stay their own series. Banner share beside the timed minutes. Unplaced pile for week-only tasks. Mismatch count: `morning` tasks whose start is outside 05:00–11:59. Default-gravity note: share of starts at 09:00 with duration 30. | Invent overnight wraps. Treat all-day events as minutes. |
| Capture bursts | Two series: ingest `at` hour (telegram, last 200, process zone) and text-pipeline `startMin` hour (full history, unknown clocks omitted). A burst is a gap under 2 minutes. A return is a gap over 6 hours. GPS-note minutes computed a second time, apart from the instant series. | Fill a month of turn counts from the 200. |
| Wellbeing | Hour of `at` and hour of `createdAt` as two histograms. Points only. No line across a gap longer than 6 hours. Lag histogram titled timeliness. | Plot missing days as zeros. |
| Habit hour | Only where a clock exists: tag-minute profile on met vs unmet days; sleep-linked signed bedtime against the deadline; planned-action `startTime` labeled as intention hour, not performance hour. | An hour-of-completion chart from `updatedAt` or from a keyword phrase. Caption which clock was missing. |
| Sun | Toggle. `DaySunTimes` when a pin exists. Small multiples, clock versus sun-relative, for Activity, plan minute load, and text-pipeline instants. Days with null sun stay on the clock and are flagged. Habit cells move only through a tag-minute or sleep clock. Document the pin zone on the chart. Default pin remains San Diego until a home city is set; first cache write wins. | Restamp last week with today’s sun. |

Click a heatmap hour on the circadian atlas (when the person is on `circadian`) to the blocks in that hour, using the existing occupancy. On `clock`, clicking an hour filters the lanes to the blocks, plan windows, capture instants, and wellbeing points in that hour, then a block opens the same record drill as Day.

---

## Done when

- `day`, `shape`, and `clock` resolve as views. `circadian` still opens `CircadianView` and still draws one hour × day atlas.
- A fresh studio lands on `day`. The day card shows the six bands, with empty blocks empty, raw beside curved, and no day score.
- Shape is 28 dates ending on the range end, empty days included, unknown plan windows in neutral ink, telegram marks only where stamped. A cell opens that date on `day` without moving the range.
- Clock stacks the lanes on hours 0–23 and does not mount a second occupancy heatmap.
- Minute drill lists covering pens or missing, instants beside, plan windows, and wellbeing `at`. Habits occupy a minute only through a named tag link, sleep clock, or planned-action window.
- Time entries open the Tracking entry dialog. Tasks open Lists. Gaps open Log activity. No new editor.
- Occupancy and grade numbers match the helpers Tracking and Habits already use.
