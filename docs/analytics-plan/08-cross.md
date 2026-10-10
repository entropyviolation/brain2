# Build brief — twelve join families

One Cross room of join cards. Each card states its join key and its partial side. Cross-section, Observatory, and Correlation keep the charts they have now. New cards are added beside them.

**Later owner:** one cross agent, after the day card exists. Files: `CrossSection.tsx`, `cross-section.ts`, `Observatory.tsx`, `CorrelationExplorer.tsx`, and new join-card files. The agent may import numbers from plan, habits, and tracking helpers. It must not rewrite those view files.

Join keys are only the ones the vision already names: local date, local minute, `spanId`, habit `sourceId`, plan `source: "todo"`, plan `source: "free"`, `confirmedEventIds`, `estimateOf: { kind: "done", id }`, task `timeLogs[]` / `startedAt` / `actualDuration`, `trackingLink.tagIds`, `coverageLink`, `sleepLink`, `keywordLogged`, `generatedBy.kind === "text"`, `stampSuffix === "from text"`, `morning.source`, wellbeing `at` versus `createdAt`, `attributes.headerTracking`, item-activity `source = "header-tracking"`, `allNighterSource`. Goals, objectives, cycle encyclopedia text, willpower physics, `hiddenPenIds`, grid step, and sort mode do not join.

---

## 1. Plan × Tracking

**Question.** Where both clocks exist, how late and how long did a timed task run, what occupied each promised minute, what did an overcommitted day actually contain, and was a blank clock an untracked day or only an unplanned one?

**Join key.** Local date, then local minute (`scheduledTime` or a `todo` action’s `startTime` for that `sourceId`; actual start from `timeLogs[]` / `startedAt` / `actualDuration` / `estimatedDuration` on the task). Plan commitment and occupancy stay native. The waking window is the sleep join Plan already uses. Empty plan and empty life are local-date flags (Activity occupancy 0; instants do not fill it). Event traces use the event-day plus checklist / `confirmedEventIds` / occupancy overlap. The only id into the grid is `estimateOf.kind === "done"`. Screen, calls, and GPS are the same date + minute, restricted to planned minutes (`generatedBy.screentime`, GPS `notes === "gps"`).

**Chart.** Slip histogram and planned-versus-actual scatter, with a tracking lane under each included day. Day ribbon with event, planned-action, and unplaced-task lanes. Commitment versus capacity, plus tracking occupancy of waking minutes. Four-way empty-plan / empty-life counts. Event list (not an attendance rate). Two lists for hatched versus confirmed assumed blocks, and an undated confirmation list that is not drawn on a calendar. Screen-versus-activity table computed only on planned minutes.

**Learned.** Timed tasks that run late, run long, or only look punctual because the actual was copied from the plan. Intentions that sat on painted life, on a gap, or on no intention at all. Three different “full”: commitment, plan occupancy, tracking occupancy. Whether blank calendars are blank days.

**Partial.** Free blocks, events, and habit blocks have no performance clock. Estimated or unknown `startCertainty` is not precise lateness. The plan is the current clock. Tracking has no `updatedAt`. Overlap is not identity. Open-until-midnight tails are asserted. The 10-pip value is not used. “Undone on the rail” is recomputed, not a stored morning snapshot. `confirmedEventIds` are lifetime and undated. `estimateOf.kind === "import"` has no writer.

**Seed.** `PlanVsReality.tsx`. Extend it. The tracking lane is a composition of minutes already painted, not a second occupancy formula.

---

## 2. Plan × Habits

**Question.** When a habit was given a dashed block, was the cell met? Which priority habits never receive a block? Does more habit-block minutes sit with a higher grade, and which grade? Which blocks exist on days the rail would not have offered that habit? What did the habit cost, what did the plan assume, and what did the grid paint?

**Join key.** Habit `sourceId`: `PlannedAction.source === "habit"` and `sourceId` = `WeeklyTask.id`, on the action’s date (daily cell) or the week key (weekly habit). Priority weight and rail membership are recomputed from stored cells and exemptions, labeled recomputed. Week key for block minutes beside raw week mean, curved week grade, and blended week grade only when `gradeUsePriority` is on.

**Chart.** Calendar per habit: placement dot, cell ratio, exempt hatch, named-miss mark. Week table sorted by weight descending, placements ascending. Scatter of habit-block minutes versus raw week mean, stone count as size, curved-minus-raw in a table under the point. Counts of off-rail classes. Three bars when they exist: assumed, planned block, painted tag minutes, plus a Done-row tick.

**Learned.** Placement reliability is not habit reliability. Neglect that never receives an hour, versus neglect that is scheduled and still empty, versus a pin met with no block. Whether block minutes track the day-average, the habit-average, or the stone plate. How often the calendar and the rail disagree.

**Partial.** The drop does not write the cell. No birth time on the action. Cell `updatedAt` is the last edit. Block length is the flat estimate or 30, not observed duration. Current `goal` and the trust list rewrite historical rail membership. Echo habits sit in the grade and have no behavior of their own. TEXT and climb habits are not tag-link targets.

**Seed.** The Habits grade and cell (raw beside curved), extended with habit-sourced actions. Do not replace the Habits view. Do not treat Plan vs Reality’s task slip as this join.

---

## 3. Habits × Tracking

**Question.** When a habit reads tracking tags, do the minutes and the cell agree, and which pipe won? On high and low raw-percent days, what was mood, company, location, and sleep? Which cells are a second reading of tracking, sleep, a list, or other habits?

**Join key.** `trackingLink.tagIds` to the tag-minute set, unioned across scopes. Local date for raw / curved / blended day percent beside Activity pen shares, company, location, mood-mark means (set values only, with `n`), and the morning sleep key (`sleepLink` when the habit is a sleep lamp; `coverageLink` when it is a coverage lamp). Trust winner on the cell names the echo (`tags`, `coverage`, `sleep`, `list`, `listSent`, `dailyFloor`, `habitValue`, `dailyCompletionAverage`, `keywords`, `manual`, `taggedTasks`).

**Chart.** One-habit day strip: tag minutes, threshold, manual, tracked, the value the grade used, the winner. Small multiples of the hour profile split by a stated raw-percent band (vacant days out of both; suppress a band under three days). Mood dots. Sleep timeline colored by the next day’s raw percent only on the morning-date join. Source stack beside coverage. Sleep deadline as a vertical line. Coverage stored percent versus recomputed occupancy, as a quality row. Tag-minute location bar with an untracked bin.

**Learned.** How much of a “perfect” habit is painted time. Whether a good-grade day is a different shape or the same shape with a fuller lamp. When the habit system is mostly a mirror. Whether the sleep lamp and the coverage habit match the night and the Activity union.

**Partial.** A missing cell is not a stored zero, yet the day grade may still count it as 0. The denominator is today’s `goal`. Company-untracked will often dominate. A missing mood mark is not 0. Sleep statement and `tag-sleep` paint can disagree. Coverage-met stones correlate with coverage by construction. Stones ignore weekly, monthly, and season habits. Intake-on-miss is a day rule, not a minute claim, unless the minute join shows it.

**Seed.** Habits tracking-link split and the Tracking composition (tag minutes, unioned). Extend those numbers onto a join card. Do not add a second occupancy formula.

---

## 4. Now × Tracking

**Question.** Once the shared `TimeEntry` is set aside, what does Now add: wellbeing lag, header-plan provenance, estimate flags, working-on spans, seams, and the later-edit ledger? At the minute a score names, what was painted, and how long after was it written?

**Join key.** Wellbeing `at` versus `createdAt` onto the presence frame (local date + minute). `spanId` `work-<startedAt>` or `pen-color-<startedAt>` for one bout. `precision` / `clockCertainty` for estimated minutes. Item-activity `source = "header-tracking"` for later plan edits. `attributes.headerTracking = "plan"` is provenance of a task, not a presence stamp.

**Chart.** The four-lane timeline is the Tracking ribbon restricted to the four presence scopes, plus wellbeing points and work-span ticks. One card per datapoint: five scores, context, the four names or “unlogged,” and `lag_min`. Aggregate a key by lane value only at 15 points, with `n`. Estimate-minute share by scope, with Screen Time, phone ingest, GPS, and place-as-assumed filtered out of the Now estimate story. For check-in rhythm: an empty frame. The sentence is that real check-ins are not in the vault. A proxy histogram may sit under that sentence with the confound in the title. It is not a series of dialog opens.

**Learned.** The joint tuple, the seam rate, the estimate share, and whether some states are written later than others. “Usually ~N” for a working-on run, compared with earlier logs of that title as of the minute before `startedAt`.

**Partial.** There is no `source: "now"` on the block, no click time, and no dialog-open count. The Time Grid can produce the same shapes. Do not forward-fill a wellbeing gap longer than 6 hours. A joy of 70 is not averaged with an energy of 7. Negative lag or a `spanId` minute that disagrees with `startMin` by more than one minute is excluded from lag percentiles, with a visible count. Check-in rhythm is impossible until an assertion log exists.

**Seed.** Metrics (the five wellbeing keys) and the Tracking ribbon. Extend them. Do not build a second Activity chart and call it Now.

---

## 5. Now × Plan

**Question.** Of the timed intentions on a day, which were born in the Now plan writer? Where a planned length or start was estimated and a later actual exists, how far off was the plan? After save, how soon is a step renamed or retimed?

**Join key.** `attributes.headerTracking === "plan"` to a `PlannedAction` with `source: "todo"` and that `sourceId`, and to the day-plan line whose text matches, on the task’s `scheduledDate` (the UI day is not stored). Estimate calibration uses `estimatedDuration` and `actualDuration`, or a `timeLogs[]` start, only when `startCertainty` or `durationCertainty` says estimated. Ledger edits use item-activity `source = "header-tracking"`. Presence at the planned minute uses `scheduledDate` + `scheduledTime` only when a non-instant block covers that minute.

**Chart.** Plan day ribbon with header-plan steps in their own dash. Reliability diagram: planned minutes or planned start hour versus mean actual or mean start error, bins 15 / 30 / 45 / 60 / 90+, reference line y = x. Exact plans get the other panel. Ticks on the chain at ledger `at`. Per step: planned window, Activity pen or “activity untracked,” estimate flag.

**Learned.** Whether the short plan is the day’s clock or a small chain inside a larger calendar. Bias and noise, and whether estimated starts are wider than exact starts. Whether the short plan is revised before it is lived. Overlap minutes are not a virtue score.

**Partial.** Tasks never completed have no error. Do not impute one. The Now pane does not write the actual. Time logs “filled from the planned length” are their own bin. Replacing an estimated presence block with an exact one destroys the estimate and is not on this chart. Untracked is not skipped. `headerTracking: "unplanned"` rows are lived residue and stay off the plan ribbon. The action has no `createdAt`.

**Seed.** `PlanVsReality.tsx` for the day’s placements, and `CalibrationView.tsx` only for the rows that later gained an actual. Extend those. Do not score an estimate that has no actual.

---

## 6. Telegram × stamped records

**Question.** Of the records that can remember a door, what share remembers the phone? On days that carry a high-confidence stamp, how do the stamped domains look beside other days?

**Join key.** Only the stamp allow-list: `generatedBy.kind === "text"`, `keywordLogged`, `stampSuffix === "from text"`, `morning.source`, `allNighterSource` (the flag only), start-ritual `start.source`, needed-item notes `sent from text`, morning to-do notes `logged from text`. A telegram-day is one of those high-confidence stamps. While a turn is still in the last 200 and `itemIds` matches, an outside join may mark that row and must say “joined, last 200.”

**Chart.** Small multiples, phone-stamped versus not, by week, sample size on every bar. A table of stamped-domain differences with `n` on each side. Hour histogram of text-pipeline instants (unknown clocks omitted). Keyword trigger table. Writing-lead strip for from-text plan lines. Depth versus share of named priority habits met, desktop mornings as a second series. The unstamped writes (Inbox, grocery, `habit:` / `did:`, `at:` / `mood:` / `start:` / `track:`, day notes, cycle flags, night review, bed and wake, work session, regrets, count ticks, pantry) are a footnote. They do not get a phone-versus-desk bar.

**Learned.** What this person logs from the phone, on records that can say so. Whether phone-touched days are fuller mornings or fuller keyword habits, or simply a `log:` instant. A higher grade on telegram days is “days I texted looked like this.”

**Partial.** Unstamped writes are not a channel. Notes phrases are editable. iPhone scopes, sleep estimated-ends, and folder From phone stay out of the high-confidence stack. Simulate shares `generatedBy.text` until the 200-log filter. Edits re-apply as a second instant at the original send time. Night reviews have no `source`. Grocery and Inbox stay out of the full-history contrast.

**Seed.** Text events / text spans (`generatedBy.kind === "text"`) and the morning source already on reviews. Extend provenance. Do not invent a channel on rows that have no stamp.

---

## 7. The day as a joint cube

**Question.** What was this date, across plan load, tracking occupancy, habit grade, wellbeing, and phone stamps?

**Join key.** The local date. Five blocks, not one vector that becomes a score. Plan: commitment, occupancy, stacked minutes, banners, unplaced rail, day-plan count, draft, from-text count, header-plan step count, window-known, overcommit only if the window is known. Tracking: Activity occupancy and coverage, entropy and top-pen share, estimated share, open-until-midnight tail minutes, sleep duration and midpoint missing if the night is absent or rejected. Habits: raw day %, curved day %, blended only if the toggle is on, vacant, good-day, stones, named misses, echo stones. Wellbeing: counts of `at` and of `createdAt`, mean of each key that was set, median lag. Phone: telegram-day flag from the high-confidence definition, plus which stamp fired.

**Chart.** The landing card: tracking ribbon, plan lanes, habit strip (ratios and exempt marks), wellbeing ticks at `at`, a provenance hairline only on rows that carry a stamp, quality strip. The 28-day shape is five thin calendars. Clustering, when it is drawn, keeps curved and blended grades out of the distance and draws telegram-day as a label, not a dimension. The Tuesday table is lifts with `n`, separate rows, not one model.

**Learned.** Whether the day planned, the day logged, the day graded, and the day texted are the same picture. A high raw grade on an untracked day is a lamp without a grid. A telegram flag with no from-text plan and no keyword is often a single `log:` instant.

**Partial.** Any block can be empty, and the card shows the empty block. Missing nights stay blank. No points is empty, not a zero vector. A vacant day is not drawn as zero. A grade of 0 with no open days is “no open days.” Plan commitment double-counts overlaps; tracking occupancy does not. Both labels stay on the card. No single score.

**Seed.** `CrossSection.tsx` linked density, and the series builders in `cross-section.ts` (missing stays missing). Extend that display. Do not replace it.

---

## 8. Time of day

**Question.** On clock hour 0–23, when does each pen happen, where does the plan put its minutes, when do phone stamps arrive, and when was a habit done — only where a clock exists?

**Join key.** Local minute floored to the hour. Unknown clocks do not enter. Plan minute load uses timed events, planned actions, and `scheduledTime`, preferring a `todo` placement over the task clock. Capture uses ingest `at` (last 200, channel telegram) beside text-pipeline `startMin` (full history). Habit hour uses only a real clock: tag minutes, `sleepLink` (`sleptMin` / `wokeMin` versus `beforeMinutes`), or the planned-action `startTime` as intention hour. Cell `updatedAt` may enter an “edited in this hour” chart and must not enter a “done in this hour” chart. Sun uses `DaySunTimes` when a pin exists. Days with a null sun stay on the clock.

**Chart.** Hour × weekday heatmap and hour profile (weekend versus weekday only with at least four days each). Plan minute-load heatmap beside the tracking heatmap. Hour ribbon of send hour and life-record hour. Tag-minute profile on met versus unmet days, and signed bedtime against the deadline. Everything else: no hour-of-completion chart, with a caption naming the missing clock. Sun toggle: clock versus sun-relative for Activity, plan minute load, and text-pipeline instants. Hour axis for every stack. Plan bins (morning 05:00–11:59, afternoon 12:00–16:59, evening 17:00–20:59, night 21:00–04:59) only when the question is preference fit. Say which cut the chart used.

**Learned.** Whether the plan is a morning document and the grid is an evening life. Whether painted exercise sits in the hour the plan blocked. Whether a plan locks to 09:00 while Activity locks to sunrise.

**Partial.** Open-until-midnight tails dominate late hours if they are not hatched. Overnight plan wraps do not exist. Late blocks collapsed to 15 minutes undercount the night. Week-only tasks are an unplaced pile, not a fake 09:00. Month-grid drops at 09:00 are default gravity. Most habits have no performance clock. The default sun pin is San Diego until a home city is set; first cache write wins.

**Seed.** Circadian hour × day (`CircadianView.tsx`, hour-day). Extend that atlas onto the stack. Do not replace it.

---

## 9. Sequence and lag

**Question.** What did sleep, mood, or plan overfill look like before a missed habit day or a raw-grade drop? When did the write happen, relative to the day the record names?

**Join key.** Local date, lag 1 (and lag 7 for the commitment ratio). A miss is a required, non-exempt day where Reader B is unmet; named misses stay separate from blanks. Look back one local day: Activity coverage, entropy, top pen, classed intake counts, mood-mark means with `n`, Together minutes. The morning of the miss uses sleep duration and midpoint when that night exists. Commitment ratio only where the window is known, against the next day’s raw day % and the Sunday raw week mean. Writing lag: plan `createdAt` versus the period key, day-note `createdAt` versus the day key, sleep `updatedAt` versus the morning date, wellbeing `createdAt` versus `at`, habit-cell `updatedAt` versus the period key. Tracking blocks have no write time.

**Chart.** Paired comparison, miss days versus met days, each side with `n`. Suppress a side under 8 days for a day-level association, and under 3 for a mood mean. Scatter of Tuesday commitment ratio versus Sunday raw week mean; unknown-window Tuesdays omitted and counted in the subtitle. Lag-1 correlation with `n`, withheld when the series is short. Five named delay distributions. Send hour versus `startMin` only for turns still in the 200.

**Learned.** Whether misses follow short nights, high tension, an intake, or an untracked day. Whether overfill leads the grade or sits on the same busy weekdays. That a beautiful Tuesday was not necessarily recorded on Tuesday.

**Partial.** Correlation is not causation. The current goal rewrites which days count as unmet. Blanks are not named failures. Exempt days are neither. A tolerance change can fake a drop on the curved rail; use the raw mean. Window-unknown days are excluded, not ratio 0. A lag that uses the placement as it exists now is not the plan as it stood on Tuesday. Time entries cannot be placed on the writing-time chart.

**Seed.** `Observatory.tsx` and `CorrelationExplorer.tsx`. Keep their current charts. Observatory already watermarks thin overlap (n below 7); keep that floor. New lag cards cite `n` and withhold the finding under it.

---

## 10. Identity across domains

**Question.** Is the day dominated by one pen, one habit, and one kind of plan, or are those three concentrations different? For each local date, did a plan get written about it, did the grid receive occupancy, and did a habit cell get its number — and were those acts on that date?

**Join key.** Local date or week, stated. Tracking concentration on shares that partition (entropy, Herfindahl, Gini, top-pen share). Habits: stone share, rail gap, echo parents out of the ranking. Plan: banner share versus timed-minute share, context load, source mix (`free` / `todo` / `habit` / event). The task field `entropy` is item-entropy, not Shannon entropy. The four acts use the clocks in the vision’s table: plan prose `createdAt` versus the period key; timed plan on the event or action date (birth not stored); tracking occupancy on `TimeEntry.date` (write time not stored); habit `updatedAt` versus the period key; phone on the stamp, or `IngestEvent.at` while the turn survives.

**Chart.** Three small Lorenz curves for a week: pens by minutes, daily habits by stones, plan minutes by context or by source. A sentence under each: effective number, top share. A month of cells with up to four ticks. A second layer for plan `createdAt` about a different period, and habit edits about an earlier period.

**Learned.** A week that is one pen, many habits at 20%, and a plan of banners is three different concentrations. The tubes can still show one Tuesday when the person planned on Sunday, logged on Tuesday, and graded on Friday. The ticks separate those acts.

**Partial.** Do not collapse the three curves into one index, and do not build a joint integrity score. Variant reach must not enter the tracking Lorenz. Tag percents of the day may exceed 100. Empty days have no distribution. You cannot mark “logged on Tuesday” for a block, because the block has one clock. Event birth is unknowable. A habit delete removes the cell.

**Seed.** `DiversityView.tsx` for attention (Shannon entropy of pens, Gini). Extend that idea into two more curves that stay separate. Do not replace Diversity, and do not fold habit portfolio or plan mix into its index.

---

## 11. Forecasts that stay honest

**Question.** What does a naive tomorrow, a naive week grade, and a naive next-week plan already say, and how wrong has each one been?

**Join key.** No new key. Tomorrow uses Activity occupancy by hour on the same weekday, among days with coverage ≥ 25%, plus yesterday’s last pen. The week grade uses raw day % on elapsed days, the prior-7 mean, and each habit’s elapsed ratio. Next week uses commitment already placed on those dates (events, actions, day-scheduled tasks). The optional sleep shift uses a known midpoint. None of these is a joint model.

**Chart.** Three cards, side by side, each with its baseline and its measured error.

1. Tomorrow’s tracking shape: median same-weekday hour profile. Optional midpoint shift, capped at 90 minutes, labeled a hypothesis. Error: mean absolute minutes per hour on the last four same-weekdays. If that error is large, show the template and withhold the prediction caption.
2. Week grade from the days that remain: Frozen, Baseline (prior-7), Habit-paced, and Requirement. Error: last Wednesday’s forecast of each kind against Sunday’s raw grade, and against the curved grade as a second column.
3. Next week’s planned load: the floor is what is already placed (solid). Same weekday last week is the baseline to beat. Habit-block expectation is dashed, and until the Habits denominator is applied it is an expectation of drops, not a rate. Error: Sunday-night floor versus the commitment after roll-up (the difference is the roll-up). A second error: the dash versus the blocks that were actually dropped.

**Learned.** Whether this life is regular enough to have a tomorrow. Which naive week story matches this vault. Whether next week is already written or is a habit of dropping the same chips. If one baseline wins, say which.

**Partial.** No joint model. Do not train a blender. Do not forecast bleeding, phase, missing scopes, exempt future days, a habit before its creation day, or a curved grade without the raw one. Do not treat an open-until-midnight tail as observed when scoring tomorrow’s error. Do not draw the 10 pips. Do not impute event attendance, free-block completion, dialog opens, or an unstamped phone channel. Now’s one-step Markov dwell forecast stays in Presence. It does not vote here.

**Seed.** None of `SpectrumView.tsx`. Its periodogram stays classical and is not this forecast. The three cards are new. They read existing plan, habits, and tracking numbers.

---

## 12. Data quality across sections

**Question.** Where can the combined tab double-count, rewrite, or forget?

**Join key.** None. This room reads the seams the other cards already depend on. It does not invent a key that would make those seams join.

**Chart.** A room of sentences and counts. No score. One click from the day card. Rows, at least: overlaps counted twice (occupancy is a union; commitment adds overlaps; a `todo` placement suppresses the task duration; an event and a task both count unless `taskId` or a checklist joins them); goal edits that rewrite habit past (current `goal` and the other live fields; you cannot date the retarget); deleted habits that lose their cells (no archive; orphan actions remain); plan drags that vanish (no tombstone; grain leak; dangling checklist); telegram edits that re-apply (second command at the original `message.date`; seen-key ring of 500; Simulate has no dedupe key); no `updatedAt` on time entries (do not claim “edited on” for a block). Also the signal table: open-until-midnight tails, unknown clocks at minute 0, one-minute iPhone calls, observed-only Screen Time, rejected sleep spans, luteal prior, cycle latch closed, filled-from-planned-length, 09:00 × 30, settings export omitting season logs and planned actions, frequency rules with no instances (empty frame, the rule as a sentence), clock skew, dangling edges, split brain, and the rest of that table. Counts where a count exists. A sentence where it does not.

**Learned.** Why a “full” plan and a “gap” grid are not a bug. Why a logged 5 can become 100% after a retarget. Why two equal timestamps and equal titles might be one edit. Why a block cannot be dated as painted when it happened.

**Partial.** The whole room is the partial side. `removedEntryIds` remember that ids were deleted, not what the row said. The undo stack is not a dataset. GPS notes are the literal `"gps"`; this tab does not draw a map. A machine timezone change cannot be detected from the data. Frequency-type rules stay an empty frame.

**Seed.** The captions Cross-section, Observatory, and the domain views already print (missing stays missing, thin overlap watermarked, estimated marked). Collect them into this room. Do not turn them into a trust score, and do not replace those views.

---

## What stays

`CrossSection.tsx` keeps linked density. `cross-section.ts` keeps missing-as-missing. `Observatory.tsx` keeps classical findings and the thin-overlap watermark. `CorrelationExplorer.tsx` keeps the pairwise matrix and the click-through scatter. New join cards are added in the Cross room. Each card states its join key and its partial side.
