# Analytics vision

This is the fullest analytics tab this app’s data can support. It is synthesized from five section reports — [Tracking](01-tracking.md), [Habits](02-habits.md), [Plan](03-plan.md), [Now](04-now.md), and [Telegram](05-telegram.md) — and it was written without looking at the current analytics UI. Those five documents stay the detailed source. This one carries each section’s implementation far enough that a reader of only this file knows what to compute, then designs the joins across domains.

The tab’s job is to hold several instruments still long enough to see structure. Tracking paints the same minutes in parallel. Habits scores cells with its own grades. Plan remembers the current shape of an intention. Now leaves presence as occupancy, plus a few true writing times. Telegram leaves a short conversation log and a smaller set of stamps on the life record. Missing data stays missing. A native metric uses one domain’s records. An outside join says which store it had to borrow, and which side is only partial.

---

## Shared spine

Nothing below is a new store. It is the grain, the honesty rule, and the join rule the five reports already share.

### Grains

Every clock in these domains is **local**. There is no timezone field on a time entry, a plan chip, a habit key, or a plan paragraph. Weekday, month, and season are derived from the local calendar date.

| Grain | Key | Who already uses it |
| --- | --- | --- |
| Local minute | Minutes past local midnight. A day is 1440. Tracking stores a half-open window: `startMin` inclusive, `endMin` exclusive. `09:00–10:00` is `{ startMin: 540, endMin: 600 }`. Plan stores `"HH:mm"` strings on the same local day. A wellbeing point stores `at` as `YYYY-MM-DDTHH:mm`. | Tracking occupancy, plan clocks, Now’s presence frame, wellbeing, text-pipeline instants |
| Local day | `YYYY-MM-DD` | Every domain. Habit daily cells, plan day logs (`dayPlan-`), sleep’s **morning** date, cycle flags, telegram’s filed day |
| Week | Monday–Sunday `YYYY-MM-DD_YYYY-MM-DD` (`getWeekString`). Sunday in JavaScript is folded back so Monday starts the week. An older ISO `YYYY-Www` spelling is accepted on read of plan text and copied onto the Monday range. | Weekly habits, week plan text, `scheduledWeek`, week grades |
| Month | `YYYY-MM`. A legacy unpadded `YYYY-M` migrates on read of plan text. | Monthly habits, month plan text, `scheduledMonth` |
| Season | `YYYY-Qn`. An **app quarter**, not an astronomical season: Q1 Spring Jan–Mar, Q2 Summer Apr–Jun, Q3 Fall Jul–Sep, Q4 Winter Oct–Dec. | Quarterly habits (`quarterlyHabitData`), season plan text (`quarterPlan-`). Not a `scheduled*` field. The Scheduler’s season lens is the quarter’s three months and does not write a quarter placement. |

Two axes must not be confused with the week key. The Plan month grid’s column headers are Sunday-first. Weekday for every chart is the local date’s weekday, never the column index. Habits also has optional windows that are not civil weeks: `thisMoon` (new moon to the next, the app’s lunar instant) and `sinceBirthday` (default birthday **5 May**). Those are sheet windows. They are not extra maps.

Cell size on the time grid (1, 5, 10, 15, 30 minutes; 15, 30, 60 on the week grid) is how the grid draws. It never regroups stored time.

### Missing stays missing

Absence is not a zero, except where a named formula already says so — and then the chart says which formula.

- A mood mark left blank is omitted. It is never stored as 0. Means use the count of set values. Tone unset is its own bin, not `neutral`.
- A wellbeing key left blank (`joy`, `suffering`, `alignment`, `selfSatisfaction`, `situationalSatisfaction`) is absent, not 0. A datapoint with only `context` is a timestamped note, not a zero vector.
- A tracking scope with no interval on a minute is missing. The Now dialog’s “—” is that absence. It is not a state in a transition chain. Instants do not occupy a minute. A day of only ticks is fully untracked.
- `clockCertainty: "unknown"` still stores a `startMin` (often `0`, the composer’s placeholder). That minute is a placement, not an observation. It stays out of hour-of-day charts.
- A habit cell that was never written is not a stored zero. Reader A, the grade, still puts that habit in the denominator as 0 once any sibling habit on the day has data. That is the grade’s rule. It is not evidence the cell was logged as zero. A logged `0` on a goal **is** data. A fully exempt day is `vacant` and leaves the week mean. It is not a zero inside the average. Zero is never lifted by the curve or the priority blend.
- A sleep pair that is missing an end, is ≤ 0, or is longer than 20 hours (`MAX_SLEEP_MINUTES`) is a rejected night, not a duration of 0. An all-nighter is a mark. It is not 0 hours inside the ordinary average.
- Plan slip is undefined for all-day, multi-day, and untimed rows. Report “no clock.” Do not store 0 slip.
- When the waking window cannot be built, overcommit is not a ratio. Report commitment minutes and the words “window unknown.” Do not substitute a 16-hour day.
- A frequency-type repeating task stores a rule and no instances. The reliability score is unavailable.
- A telegram chart may say “from the phone” only where a stamp in the provenance list below exists. Inbox, grocery checkout, night review, `habit:` without `keywordLogged`, cycle flags, day notes, and `at:` / `mood:` / `track:` paints have no channel flag.

`precision: "estimated"` is kept in the default view and hatched. **Observed only** drops those rows and says how many minutes that hid. Omitted precision is certain. Estimated Screen Time will go blank under Observed only; say so, or a hole looks like a dead watcher.

### A native metric and an outside join

A metric is **native** when every input sits on that domain’s own records. Tracking’s occupancy is native to `TimeEntry`. Habit’s week grade is native to cells and the current task row. Plan’s task adherence is native because `completedDate` and `schedulePlacements` sit on the task. Now’s wellbeing lag is native because `at` and `createdAt` sit on the same datapoint. Telegram’s kind share is native to the last 200 ingest turns.

A metric is an **outside join** when one section’s report already said the other number lives in a different store. Plan’s waking window is sleep. Habit completion of a planned block is the habit log. Attendance at a calendar event is not on the event. Whether an Activity block was brushed in Now is not on the block. Whether an Inbox row was texted is not on the task after the ingest row ages out.

The combined tab makes those joins, and it marks the side that is missing. It does not invent a column to finish them.

---

## Tracking

Source: [01-tracking.md](01-tracking.md). The question is: given a life recorded as parallel paintings of the same minutes, what structure is observed, and what is a guess the logger left behind.

### Entities and grains

The vault is `brain2-timegrid-store` (persist v15): `scopes`, `tags`, `entries`, `removedEntryIds`, a mirror of day notes, `untrackedNotes`, `hiddenPenIds`, `confirmedEventIds`, `enableCycleTracking`, `cycleDetailsOpen`. Day notes’ source of truth is the append log `brain2-tracking-day-notes`. Cycle flags live in `brain2-cycle-marks`. Sleep statements live in the sleep store and are copied onto the grid as ordinary blocks. Screen Time, phone pings, text, GPS, and “working now” all end as the same `TimeEntry` shape, with different stamps.

**`TimeEntry`.** One block or one tick on one local day in one scope. Identity `id`. A logical overnight event is the group `spanId`.

| Field | Role |
| --- | --- |
| `date`, `scopeId`, `penId` | Day, which painting, which color. `penId` is always present. |
| `secondaryPenIds` | Extra categories in the same view. They take the **full** block. They do not change grid color. Omitted means primary only. |
| `kind` | Omitted = interval. `"instant"` means `endMin === startMin`, duration 0. Occupancy ignores instants. |
| `startMin`, `endMin` | Half-open minute window. `entryMinutes` is `max(0, endMin − startMin)`. |
| `spanId` | Glue for midnight slices. `23:00–02:00` is Thursday `1380–1440` plus Friday `0–120`. Logical duration is the sum of slices. Pen-color “working now” uses `pen-color-<startedAt>`. Work sessions use `work-<startedAt>`. |
| `startEventId`, `endEventId` | The interval claims these instants as edges. A missing id is a dangling edge. |
| `splitAfter` | Scissors. Same-pen neighbors merge unless this is set. The seam is evidence the person refused a merge. |
| `variantIds` | Several details true at once. |
| `tagIds` | Block-only tags, on top of pen tags. |
| `title`, `notes`, `project`, `books`, `pages` | Label, free text, context, reading. `title` does not change counting. GPS-written location blocks use the literal note `"gps"`. |
| `precision` | Omitted = certain. `"estimated"` = assumed, reconstructed, Screen Time, phone ingest, or an estimated log clock. |
| `clockCertainty` | Omitted = exact. `"estimated"` also sets `precision`. `"unknown"` still stores `startMin`. Separate from mood, sleep, and completion certainty. |
| `eventKind`, `intakeClass` | Count key and intake shelf. `intakeClass` is `food` \| `drink` \| `drug`. Bare `intake:` leaves the class unset. |
| `switchFrom`, `switchTo` | Strings, not pen ids. |
| `moodReading` | Mood scope only. Different readings do not merge. The derived sentence is not written into `notes`. |
| `generatedBy` | `{ kind, id }` with `kind` `sleep` \| `screentime` \| `text`. `id` is the local calendar day. Each generator replaces only its own kind+id. |
| `estimateOf` | `{ kind: "done" \| "import", id }`. Place-as-assumed writes `done`. Confirm clears `precision` and keeps the stamp. Nothing writes `import` yet. |

There is no `updatedAt` on the row. A later drag, split, or repaint replaces the minutes. `removedEntryIds` (cap 4000) are tombstones so a merge cannot resurrect a deleted id. They do not store the deleted payload.

**Counting rules.** These are properties of the records.

| Rule | Meaning |
| --- | --- |
| Occupancy is a union | Two intervals on the same minute in the same scope count once. Summing `endMin − startMin` can report a 30-hour day. Sleep derived on top of hand-painted Work is the usual case. |
| Instants do not occupy | A tick at 18:37 does not fill 18:37. |
| Tags are a property of time | Pen `tags` mean “always.” `TimeEntry.tagIds` are extras. `effectiveTagIds` unions the primary pen, every secondary pen, and block tags. |
| Tag minutes are unioned across scopes | The same minute painted Work in Activity and Work-tagged in Location counts once for the Work tag. |
| Within one tag, minutes are a set | Overlapping blocks that share a tag do not add. |
| Display depth is a lens | `TrackScope.displayDepth` (`null` = Exact) never rewrites paint. At a collapsed depth, each distinct ancestor gets a share, and the shares sum to the block. An ancestor reached twice is paid once. Analytics picks a depth without writing `displayDepth`. |
| Variants have two totals | **Reach** overlaps and can exceed the parent. **Split** partitions the parent, unlabeled included. |
| Hidden pens still count | `hiddenPenIds` only removes a pen from the well. |
| Companion links fill blanks | A `PenLink` paints the other scope only on minutes that scope left empty, unless someone asked to overwrite. |

**`TrackScope`.** Seeded ids: `activity`, `location`, `mood`, `company`, `screentime`, `iphone-screentime`, `iphone-calls`, `iphone-texts`. People add scopes by name. Depth labels are Category / Activity / Exact, Country / Area / Place / Exact, Kind / Who / Exact, and Category / App / Exact for the two screen trees.

**`TrackPen`.** Vocabulary, not time. `parentId` is the display parent and is always `parentIds[0]` when the list is set. Ocean Beach can count as both San Diego and Beaches. `tags` are cross-scope. `variants` are details that are themselves pens. `links` are standing implications. `actionFormats` name a Done-today row; they are not a second time series. `lastUsedAt` and `editedAt` are pen metadata. A dropped pen is recovered from paint as “Recovered pen.”

Seeded Activity pens and tags: Work `act-work` / `tag-work`, Rest `act-rest` / `tag-rest`, Exercise `act-exercise` / `tag-exercise`, Social `act-social` / `tag-social`, Chores `act-chores` / `tag-cleaning`, Sleep `act-sleep` / `tag-sleep`. Location: Home, Work, Outside, Transit. Mood pens: Great, Good, Meh, Low. The pen is a name; the report is `moodReading`. Company: Alone; Together; In conversation (child of Together, variant label “Who?”).

Screen Time category roots share six names and **different ids** (`st-cat-work` versus `iphone-st-cat-work`). Language creates Text log, Intake, Switch, and Objective on Activity. There is no Goal scope. `so:` / `switch goal:` uses the Objective pen.

**`TrackTag`.** `{ id, name, color }`. A tag does not store time. The useful grain is a set of minutes on a date, unioned across scopes. Weekly or monthly tagged minutes are the sum of those daily set sizes, not a sum of block durations.

**Instants.** Still `TimeEntry` rows. Shelves: classed intake, bare intake, event (Text log and/or a phrase `eventKind`), thought process (`eventKind === "thought-process"`), switch (Switch pen, Objective pen, or any instant with `switchTo`), note. A `log:` line may also be a range. A trailing `loc:` paints a second Location instant at the same minute. Clock words `est` / `estimated` / `~` and `unknown` apply. A bare clock is military (`18:37` is 6:37pm, `6:37` is 06:37). Unknown clocks sort after timed rows. Whole-message triggers (`smoked weed`, `drank water`, `ate {item}`, `took {item}`) paint Text log with `generatedBy.kind === "text"`. Saved log keywords (`brain2-log-keywords`) are phrases; matching `log:` of that phrase increments a bound count. The keyword list itself is not a time series.

**`MoodReading`.** Text, stored only when non-blank: `word`, `sensation`, `vibe`, `narrative`, `reframe`, `about`. `tone`: `pleasant` \| `unpleasant` \| `neutral`. Integers 1–10: `energy`, `tension`, `loop`, `enjoyment`, `grasping`, `knowing` (marks) and `cast`, `sociability`, `initiative` (water). Grouping key for a word is trim, lowercase, collapsed spaces. The stored spelling stays. Mean of a mark is the average of set values only, rounded to one decimal, with `n`. Grasping is split by whether `about` was filled.

**Day summary.** One local date → one prose string (what actually happened). Week, month, season (`quarter:`), and year summaries share `brain2-tracking-day-notes`. Old append-log envelopes flatten to that prose. There is no per-entry `createdAt` on new writes. Not the plan log.

**Untracked notes.** Key `date|scopeId|startMin|endMin`, value a string. The gap is not a `TimeEntry`. If the range is later painted, the note can dangle.

**Counts.** `brain2-count-statuses`. `CountStatus`: `id`, `name`, optional `intakeClass`, optional `keyword`, `ticks[]`. `CountTick`: `{ id, date, startMin, clockCertainty? }`. Deleting a count drops its ticks and leaves intake instants already painted. The grid and the tally can diverge.

**Cycle.** One local date → flags. A day with every flag clear is dropped. No `TimeEntry` is written. `bleeding` starts or continues a bleed run. `spotting` is recorded and does not change phase. `ovulation` marks that day unless it is also bleeding. `phaseForDate` is derived, not stored: `menstrual`, `ovulatory`, `luteal`, `follicular`, `unknown`. Estimates (`assessCycleDay`) never write marks and never replace `phaseForDate`. A day is `basis: "estimated"` only when no ovulation was marked and a guess can be said aloud. Cycle length is bleed-start to next bleed-start. Lengths under 18 or over 60 are not used for the median and are not deleted. Luteal length is the distance from an ovulation day to the next bleed start. With no such pair the length is a **14-day prior**, `lutealSource: "prior"`, not a measurement. Learned medians clamp to 8–18 days. Open-cycle stand-in when there is no median length: 28 days. `enableCycleTracking` only shows the log’s cycle section. `cycleDetailsOpen` is a privacy latch: if it is closed, do not draw phase charts. The encyclopedia is reference prose, not personal data.

**Sleep.** Grain: one **morning** date. `sleptMin` is a signed offset from midnight of `date` (negative is the evening before). `wokeMin` is 0–1439 on `date`. Each end has `sleptPrecision` / `wokePrecision`. `note`, `updatedAt`, `allNighter`, `allNighterAt`, `allNighterSource` (`telegram` \| `desktop` \| `text`). `source` unset means logged; `tracked` / `mixed` are set on read when the grid fills a gap. That field is logged-versus-inferred, not the channel. Duration is `wokeMin − sleptMin` when it falls in 1…1200. Target default is 480 minutes, clamped 60–960. Derived blocks use a sleep-tagged pen, split at midnight, `generatedBy: { kind: "sleep", id: <morning date> }`, `tagIds: ["tag-sleep"]`. All-nighter mornings paint nothing. Re-deriving replaces only `generatedBy.kind === "sleep"` rows for that night. Hand paint is kept.

**Screen and phone.** Mac Screen Time (`scopeId` `screentime`) is ActivityWatch intersected with not-afk. Pieces shorter than `minDurationSec` (default 15) are dropped. Every derived row is `precision: "estimated"` and `generatedBy.screentime`. Window titles are off unless `storeWindowTitles` is on. iPhone Screen Time uses distinct pen ids, estimated precision, and **no** `generatedBy.screentime`, so a Mac replace cannot delete it. iPhone Calls are intervals; a phrase with no window paints **one estimated minute**. iPhone Texts are instants; no body, no row.

**GPS.** A fix paints where the phone was at that minute, not the rest of the day. Same coordinates within 150 m keep the pen. A fuzzier-than-150 m jump does not move you. A dropout under 45 minutes still belongs to the last confirmed place. Isolated samples stretch to at least 15 minutes. Notes are `"gps"`. The last fix (`lat`, `lon`, `penId`, `name`) lives in a side key, not on the entry. **Coordinates are not on `TimeEntry`.** A venue pin is a shared place, not presence.

**Open-until-midnight.** `at:`, `mood:`, `start:` of an activity pen, and `currently` paint from the current minute through the end of that local day. The next switch overwrites only the remainder. `stopped` truncates to now. `track: name 30m` paints a closed window. A tail that ends at 1440, with no matching `spanId` continuing at 0 the next day, is **asserted through the end of the day**, not observed minute by minute.

**Sessions.** At most one work session and one pen-color session. Fields include `startedAt`, `trackingEntryIds`, `pausedAt`, `pausedAccumMs`. Pause is accumulated milliseconds, not a painted block. When the session ends, the blocks remain and the pointer is cleared, including pause totals. Header **Update state** extends the open stretch up to now or paints this minute with a seam. It erases future minutes. It never paints through midnight.

**Sun.** `DaySunTimes` for a local date and a lat/lng pin: `sunriseMinutes`, `sunsetMinutes`. Cached per `YYYY-MM-DD|lat|lng`; first write wins. Default pin in the astronomy helper is San Diego. This is a clock, not a pen.

**Wellbeing, adjacent.** `MetricDatapoint` in the metrics store is not a `TimeEntry`. Fields: `id`, `at`, `values` (subset of the five 0–100 keys), optional `context`, optional `details`, `createdAt`. Align a point to the minute it names. Show `createdAt` when it differs from `at`. Mood marks are 1–10 on a stretch. These are 0–100 at a minute. Different instruments.

**Not measures.** `gridStep`, `gridSpan`, sort mode, `hiddenPenIds` as a filter, fill clocks, `superimposeByScope`, well-expand flags. `cycleDetailsOpen` is a latch, not a life series. `confirmedEventIds` is a lifetime list of calendar event ids Day Log has confirmed into blocks. The entry does not carry `eventId`. The list alone cannot date the confirmations. Task `timeLogs` are on the task, not a `TimeEntry`. Tracking occupancy does not fold them in.

### Metric catalog

Period means the dates on screen, empty days kept. Waking means minutes outside sleep-tagged or sleep-generated intervals, unless the chart says otherwise.

**Counts.** Blocks (say when `spanId` groups collapse to logical events). Instants. Days with paint versus days in the period. Tick count, optionally dropping unknown clocks. Intake events by class and by `eventKind`. Switch events. Thought count. Day-note entries by **day key**, and separately by `createdAt` (writing burst). Bleed runs (spotting does not join them). Completed cycles, with the 18–60 sample beside the excluded count. Nights with a usable duration. All-nighters. Confirmed events: the id list is lifetime, not a period count.

**Durations.** Block duration. Logical duration by `spanId`. Scope occupancy as the size of the `date#minute` set. Untracked = `days × 1440 − occupancy`, per scope. Coverage = occupancy ÷ (days × 1440). A fully empty scope is 0. Average per day uses days in the period; also offer days with data, and say that the second hides gaps. Tag minutes. Pen minutes at a depth (shares sum to the block). Variant reach and variant split. Secondary-pen minutes as overlap, not a partition. Sleep duration. Sleep debt against the target. Time in bed versus tagged sleep: the gap is disagreement or unpainted sleep, not a third kind of sleep. Pages. Reading rate = sum of `pages` ÷ sum of minutes on blocks that have both a page count and a positive duration. Bout length: a maximal run of the same pen at the chosen depth, merging across `spanId` and midnight, and not merging across `splitAfter`.

**Rates.** Switches per waking hour: switch instants plus paint-changes, divided by waking hours that have any Activity occupancy. A day with no Activity paint has no rate. Do not divide by 24. Intakes per day, with a companion per day that had any intake. Notes per painted Activity hour. GPS fixes: count of location intervals whose `notes === "gps"`. Adjacent same-pen fixes merge, so this is a lower bound. Screen fragmentation: blocks ÷ occupancy hours, remembering the `minDurationSec` floor. Call minutes, with the one-minute default labeled estimated. Texts per person. Estimated share. Unknown-clock share, and those `startMin` values stay out of hour charts.

**Distributions.** Bout length (expect a spike at 1 minute from default calls and from “until midnight” that was stopped immediately). Start hour, excluding unknown clocks and excluding GPS blocks that were stretched only to the 15-minute floor when you can still see `notes === "gps"` and duration ≤ 15. Coverage, one number per day, empty days shown. Mood marks, never imputing 0, `n` beside every mean. Tone mix, plus unspecified. Cycle length, 18–60 highlighted. Sleep duration, bedtime, and wake on the signed axis. Median bedtime and wake are the typical night; one all-nighter must not move the assumption. Pages per sitting. Title length is a clue (long titles are thoughts or notes stored as titles), not a vanity metric.

**Streaks.** Paint streak: consecutive dates with Activity occupancy > 0. A single instant does not keep it alive. Tag streak. Coverage streak at a stated threshold (offer 50% and 80% of 1440, and of waking minutes). Sleep-target streak: an all-nighter breaks it; a missing night breaks it; do not skip. Bleed run length. Phase runs, with estimated days marked so a guessed luteal does not look marked. Same-pen return. Count streak, with a day-collapsed view for a tally that is really a day habit hiding inside a minute stamp.

**Rhythms.** Hour-of-day profile: for each clock hour 0–23, the mean across days of occupied minutes in that hour (0–60), per pen, tag, or scope. Weekday profile, or a weekday×hour matrix. Weekend versus weekday only when each group has at least four days; otherwise show the days and withhold the adjective. Sun-relative hour: subtract that date’s `sunriseMinutes`. Days with null sun stay on clock time and are flagged. Sleep midpoint `(sleptMin + wokeMin) / 2` as a signed offset. First and last painted minute per scope, ignoring instants and unknown clocks. The gap from `wokeMin` to first Activity paint is “time to first log.” Intake, thought, and switch clocks.

**Concentration.** On shares that partition (Exact paint, or split shares at a depth). Do not compute entropy on variant reach. Empty days have no distribution. Shannon entropy, normalized entropy, Herfindahl, Gini / Lorenz, top-pen share, effective number of pens `exp(entropy)`, fragmentation (bouts ÷ occupancy hours). Scope divergence: Jensen–Shannon between two scopes’ 24-bin occupancy vectors.

**Switching.** Two events. Paint changes: the Activity pen at minute m differs from minute m−1 inside occupied time. Midnight uses the previous day’s last occupied pen when `spanId` matches or the slices abut. Declared switches: instants with `switchFrom` / `switchTo`, or Switch / Objective pens. Agreement: a declared switch whose `switchTo` names the pen that occupies the next occupied minute. The join is a string join, case-folded the way `eventKind` slugs are. Mean bout. Switch tax: minutes in bouts shorter than a stated threshold, default 5, also offer 15. Self-loop: from and to normalize to the same string, or a paint change returns to the same pen within 2 minutes. Objective changes are goal changes, not activity changes.

**Tag co-occurrence.** Co-minutes, Jaccard, conditional, lift. The universe for lift is painted minutes, not 1440, or sleep-heavy days fake a negative association between daytime tags. Triples only when the pair already has lift above 1 and support above a floor (for example 30 minutes). Split “always” (a pen’s `tags`) from “this block” (`tagIds` only). Pen co-assignment (secondary pens) is a separate matrix.

**Phase effects.** Join key: local `date`. Phase is `phaseForDate` unless the chart is explicitly the estimate layer. For each phase, among days with that phase: mean Activity mix with `n` days; mean mood marks with `n` = readings that set the mark; sleep on the morning date and, when `sleptMin < 0`, the bedtime’s calendar date; intake counts; coverage and entropy. Spotting is a flag inside whatever phase the day already has, not a fifth phase. With fewer than three days in a phase, show the days and do not state an effect. Estimated phase days stay hatched. Marked ovulation days are a single-day bin. A “short luteal” claim uses the learned median only when `lutealSource === "marks"`. If the cycle latch is closed, do not join phase into other charts.

**Within the day.** Gap list per scope. Longest gap. Open-until-midnight tail. Morning / afternoon / evening / night as a starting cut (for example 5–12, 12–17, 17–22, 22–5); sun-relative bins are the better default once a pin exists. Deep-work candidate: a bout of a Work-tagged pen lasting ≥ 50 minutes with no switch instant inside. Label it a proposal. Interleave of A and B. Company × activity, with a “company untracked” bin.

**Across days.** Day vector: 24 × pens or tags, plus coverage, entropy, sleep duration, phase. Template day: median hour-profile among weekdays with coverage above a floor. Lag-1 of Work minutes. Weekend rebound: Monday first-paint and sleep debt after two weekend days. Catch-up bursts: a day whose estimated share is high and whose blocks were not `generatedBy` — reconstruction, not a new lifestyle. Writing delay: sleep `updatedAt` minus morning `date`; day-note `createdAt` minus the day key; metric `createdAt` versus `at`.

### Visualizations

The geometry has to match the grain. A pie of variant reach is a lie. A pie of variant split is honest. Pies only for partitions.

| View | Question it holds |
| --- | --- |
| Day ribbon | One band per scope that has rows. Color is the pen at the selected depth. Instants are ticks. Estimated minutes are hatched. Unknown-clock instants sit in a side list, not at 00:00. Sleep, GPS, and Screen Time get a provenance stripe. |
| Occupancy calendar | Ink is coverage. Hatch is estimated share. A dot is “instants only.” Empty days are cells. |
| Hour × weekday heatmap | Mean minutes 0–60, or probability the pen dominates. A companion sample-size layer gates the color. |
| Sun-shifted small multiples | The same profile on clock hours and on hours after sunrise. |
| Bout survival | Share of bouts still running after t minutes. Mark the 5- and 15-minute switch-tax lines. |
| Lorenz | Pen minutes, one curve per week. Companions: top-pen share, effective number of pens, sorted bar. |
| Transition matrix | Rows are the pen or `switchFrom` you left; columns are what came next. An “untracked” column for leaving into a gap. Diagonal is continued or self-loop, labeled which. |
| Alluvial of day-type | Morning cluster → afternoon cluster → evening cluster, after days are clustered. |
| Tag co-occurrence matrix | Lift, cells under 30 minutes blanked. Diagonal is total minutes. A second, smaller matrix is block-only tags. |
| Mood marks | Dots at 1–10 on the date, per word, with `n`. Not a radar. Grasping with `about` and without are two means. |
| Sleep timeline | Signed axis from `sleptMin` to `wokeMin`. Estimated ends dashed. All-nighters are a mark. `updatedAt` delay is a tick when the night was written more than a day later. Median window only after ≥ 3 nights. |
| Cycle calendar | Solid wash = `phaseForDate`. Hatch = estimated basis, with reason and confidence. Spotting is a dot. |
| Phase small multiples | Average ribbons or hour×pen heatmaps, `n` days, marked-only by default. |
| Screen icicle | Category → app → domain. Mac and iPhone are two trees. AFK is “not at keyboard,” not “Other.” Titles are a drill, off by default. |
| Count ticks on the ribbon | Flag ticks with no matching instant, and instants with no tick. |
| Quality strip | Certain intervals, estimated intervals, unknown-clock instants (count, not minutes), open-until-midnight tails, overlapping minutes, dangling untracked notes. |

### Learning

Each sentence on screen needs a minimum.

- **Seasonality.** Weekday, time-of-year, and leftover on daily occupancy, Work-tag minutes, and sleep duration. With fewer than eight weeks, show the weekday profile only and say the year is not identified. Sun-relative profiles are the seasonality check that does not need a long series.
- **Changepoints.** On daily coverage, entropy, sleep midpoint, and top-pen share. Show dates and before/after means. Do not name a cause. With fewer than 21 days, do not search. A break that lands on a jump in estimated share is a logging change. Turning cycle tracking on is a metadata break.
- **Clustering of days.** Vector: 24 bins of Activity at Category depth, coverage, sleep duration as a missing flag rather than 0, phase one-hot with unknown separate. Small k (2–5) chosen by stability: the same days group if you drop a random week. Name a cluster by its median ribbon. Do not cluster on raw pen ids if pens were reparented; cluster at a depth, or on tags.
- **Sequence mining.** A day as bouts `(pen, duration bucket, company if covered, location if covered)`. Minimum support about 5 days, maximum length 4. Mine declared `switchFrom → switchTo` separately. Where paint and declaration disagree, that disagreement is the finding. Do not print a rule with support 2.
- **Association rules on days.** Items: tags present above a floor (for example 15 minutes), phase, “sleep debt > 60,” “any drug intake,” “company Together for ≥ 30 minutes.” Support, confidence, lift. At least 8 days containing A. Minute-level lift will rediscover “Home and Alone”; day rules are the other instrument. Association is not a cause.
- **Anomalies,** split into bad data and unusual life. Coverage far below the recent median while the previous week was dense. A pen absent from the trailing 28 days that then occupies ≥ 60 minutes. Overlap minutes. A cycle length outside 18–60, shown as excluded from the median. A rejected sleep span. Instants piled at minute 0 with unknown clocks. Open-until-midnight tails covering hours after the last declared switch or last instant.
- **Tomorrow’s shape.** Median hour profile of the same weekday among days with coverage ≥ 25%, plus yesterday’s last pen. If last night’s midpoint is known, shift the template by the difference from the median midpoint, capped at 90 minutes, and label the shift a hypothesis. Report mean absolute minutes per hour on the last four same-weekdays. If that error is large, show the template without a prediction caption. Do not forecast bleeding. Do not forecast phase over a marked ovulation. The estimate layer already has a prior; show its basis note.
- **Mood and context.** For each mark, the distribution when a tag or pen is present in the same minutes versus absent, restricted to minutes that have a reading at all. Paired comparisons with `n`. Both sides need `n ≥ 3`. A regression with many covariates on a handful of readings should not ship.
- **Screen versus stated activity.** On minutes where both a screen scope and Activity are occupied, category versus Activity pen. Systematic disagreement is the finding. Agreement is not validation. AFK-untracked minutes where Activity is painted are life away from the keyboard.
- **Language, lightly.** `eventKind` counts, hapaxes, whether thought-process titles cluster at the same hours as switch spikes. A bag of slugs over the week is the first instrument. Topic models on a few dozen notes are not. Search already indexes name, notes, project, mood word, sensation, vibe, narrative, reframe, about, pen, secondary pen, counts-as names, and action templates. The hit set is a cohort of blocks.

### Information architecture

One Tracking area. Default period: the last 28 local days, including today, empty days kept. Default lens: Activity at Exact, depth control local to analytics. Estimated included, quality strip visible. **Observed only** drops `precision: "estimated"`. If cycle details are concealed, Body omits phase charts.

| Room | Holds |
| --- | --- |
| Today | Ribbon, quality strip, gap list with untracked notes, instants (unknowns apart), day notes with `createdAt`, sleep statement if this date is a morning or the evening before one. Drill a slab to the block. Drill a gap to the note and Fill’s range, without painting. |
| Shape | Coverage calendar, hour×weekday heatmap, Lorenz, entropy sparkline, cluster strip. Default for a multi-day period. |
| Library | Pen trees with minutes at the current depth and at Exact, tags, variant split and reach, event-kind table, counts joined or unmatched to instants. |
| Rhythms | Clock versus sun, sleep timeline and midpoint, first and last paint, intake / thought / switch clocks. |
| Attention | Transition matrix, survival, switch tax, two screen trees, screen category versus Activity, calls and texts by person. |
| Body | Cycle calendar when the latch is open. Sleep, mood, and intake still show when cycle tracking is off. |
| Language | Day notes by writing day versus day key, thoughts in time order, repeated `eventKind`, find-then-calendar. |
| Quality | Overlaps, open-until-midnight tails, estimated share by `generatedBy` kind and by “no stamp,” unknown clocks, dangling edges, dangling gap notes, ticks versus instants, sleep statement versus derived blocks versus other paint, tombstone count, retroactive sleep edits, Screen Time `lastSyncNote` / `lastError`, recovered pens. |

Floors: no forecast caption until the weekday baseline has a computed error; no phase-effect sentence below three marked days; no association rule below eight supporting days; unknown clocks never placed at midnight on a clock chart.

### What Tracking does not store

Edit history of a block. Coordinates on the row. An `eventId` on a confirmed block (only the lifetime id list). Task `timeLogs` and plan rows. Habit grades — tags are the bridge, and Tracking should not recompute a grade. A writer for `estimateOf.kind === "import"`. Window titles when the pref is off. Anything shorter than `minDurationSec`. Pre-install Screen Time. Whether a now-stamp, a grid brush, a desk paint, or ingest produced a given block. The previous pen after an open overwrite. Pause totals after a session stops. Encyclopedia chapters.

---

## Habits

Source: [02-habits.md](02-habits.md). Habits already score themselves. Analytics keeps the app’s percents, curves, floors, and point rules, and asks the questions those numbers were not given room to answer. It does not invent a second grade.

### Entities and grains

Store: `brain2-habits-store` (`useHabitsStore`, persist version 26). A habit is a `WeeklyTask`. A day, week, month, or season is one `TaskCompletion` inside a date-keyed map. Completions are not rows in the task database.

| Map | Habits | Key | What one cell means |
| --- | --- | --- | --- |
| `weeklyData` | `frequency` missing or `"daily"` | local `YYYY-MM-DD` | That calendar day |
| `weeklyHabitData` | `"weekly"` | Monday–Sunday range | The whole week |
| `monthlyHabitData` | `"monthly"` | `YYYY-MM` | The civil month |
| `quarterlyHabitData` | `"quarterly"` | `YYYY-Qn` | The app quarter |

`HabitFrequency` is `"daily" | "weekly" | "monthly" | "quarterly"`. Frequency chooses the map. It is independent of climb cadence, which exists only on daily `INCREMENTAL` habits. There is no archived flag. `deleteTask` removes the habit and strips its cells from all four maps and from `habitExemptions`. History of a deleted habit is gone. `categoryId` is deprecated. The `categories` array is not how live habits are grouped. Do not group by it.

**`WeeklyTask`.** Identity and scoring configuration. Goal changes are not versioned: the current `goal` is what historical percents divide by.

Fields that change a chart: `id` (stable; `task-{unix ms}` is also a creation instant; seed ids like `task-1` are not dates), `name`, `type` (`BOOLEAN`, `GOAL`, `TEXT`, `INCREMENTAL`; legacy `TIME` and `COUNT` normalize to `GOAL`), `frequency`, `goal`, `unit`, `incrementalData` (`cadence`, `startValue`, `increment`, `unit`, `startedOn`), `rewardValue`, `createdAt`, `gem`, `priorityPinned`, `priorityMuted`, `priorityLog` (append-only display lines), `priorityEvents` (structured presses, oldest first; optional `reasoning` on a manual press only — prose, not a weight; ritual and permanent events have no reasoning), `priorityRefreshedOn`, `priorityPermanent`, `timeEstimate` (`minutesPerUnit`, `minutes`, `precision`), `timeEstimateNA`, `doneTaskPhrase`, `doneTaskUseText`, `taggedTaskTag`, `textTriggers`, `trackingLink`, `coverageLink`, `habitValueLink`, `listLink`, `listSentLink`, `dailyFloorLink`, `sleepLink`, `logExemptions`, `completionSources`, `completionPipelines`.

`HabitCompletionSourceId`: `manual`, `tags`, `taggedTasks`, `coverage`, `sleep`, `list`, `dailyFloor`, `habitValue`, `dailyCompletionAverage`, `listSent`, `keywords`.

**`TaskCompletion`.** One habit × one period key. Absence of a cell is not a stored zero.

| Field | Meaning |
| --- | --- |
| `completed`, `value`, `text` | What Reader A, the grade, actually reads, plus the climb log. |
| `goal` on the cell | Sometimes a snapshot written beside `value`. Row and day grades divide by `WeeklyTask.goal`, not this snapshot. |
| `manualValue`, `trackedValue`, `trackedCompleted` | Hand versus tag-link parts. |
| `handCompleted` | `true` / `false` is the person’s opinion. Absent means they have not touched the cell. |
| `sleepCompleted`, `listCompleted`, `coverageCompleted`, `dailyFloorCompleted` | Auto flags. |
| `habitSumValue`, `dailyCompletionAverage`, `listSentPercent` | Kept even when a hand number owns `value`. |
| `taggedTaskCount` | 0 is a reading, not a typed zero. |
| `keywordLogged`, `keywordValue` | A phone keyword line wrote this cell. |
| `missedOpportunity` | The person named the period as not done. Grades, percents, streaks, gems, and points do not read it. |
| `updatedAt` | Wall-clock ms of the last edit. A newer write wins. Not a history of previous values. |

**How a type becomes a percent.** Yes/No is met when `completed` is true. No partial. An explicit false and a missing cell are the same input to the day average. Goal percent is `min(100, value / task.goal × 100)` when `value` is present and `goal` is set. No goal → 0. Overshoot is stored and then thrown away by the cap. Text: any non-empty string is 100 in the grade. Whitespace can count on the ribbon and still be unmet for streaks, because Reader B wants a trimmed string. Climb, weekly cadence: the day’s target is `weeklyGoalOn`; the target steps up next Monday only if the previous week had ≥ 4 days at or above that week’s target (`WEEKLY_INCREMENT_MIN_DAYS`). How far over does not matter. Climb, daily cadence: the target is the last logged score before today plus `increment`. A day with no log does not move the base. A lower log does. Week percent for a daily-cadence climb is the week’s gain divided by `increment × days`, not the mean of the seven day percents.

**Two readers.** Label which one a chart used.

- **Reader A, the grade.** `calculateDayPercentageAV` and the week, output, and period grades. They read `completed`, `value`, `text`, and the climb log. They do not read `missedOpportunity`, `handCompleted`, or the trust list. Day average: drop exempt habits; if the bucket is missing or no remaining habit has a scored cell, the day is 0; otherwise sum of cell percents ÷ count of non-exempt habits. A missing cell contributes 0 and still counts once any habit has data. A fully exempt day is vacant and left out of the week mean. `calculateDayPercentage` divides only by habits that have data. Week grade does not use it. Offer it only as a labeled sensitivity (“among habits that were touched”).
- **Reader B, met.** `isHabitGoalMet`. Stones, 4-day week streaks, the one-shot `rewardValue`, and “is this cell complete.” If `completionSources` is an array and the type is not climb, the first source with a met or unmet reading wins. Climb ignores that list and uses the derived target.

**Where a number comes from.** Trust order: manual, tracking tags (minutes unioned across scopes; modes `add`, `max`, `replace`; Yes/No checks when tracked ≥ `threshold`, and a missing or ≤ 0 threshold means any positive time), tagged tasks (each Done task with `taggedTaskTag` counts as 1, not as minutes; the Tags row and Auto-fill share one Tracking catalog, and a rename follows this name while minute ids stay on that tag), coverage (paint percent, default threshold 75; the sheet prints that percent over the target, so 90 against 70 reads 90/70 — the old cap that printed 75/75 is abandoned so the overage stays visible; stored percent and grades stay on the real percent), sleep clock, list quota, daily floor, daily-habit sum, daily completion average (the uncurved mean of daily row percents — not the curved week grade and not perfect output), list sent (grace-adjusted), keywords. TEXT and climb are not tag-link targets. Tracking sync will not open an empty cell for a day the tracker has nothing to say, because a stray 0 would become a scored cell.

**Exemptions.** A waived period leaves both sides of the fraction. `required` does not waive. `auto` waives a period that ended before the habit existed; the creation day stays required. Creation day is `createdAt`, else a `task-{ms}` id. Seed ids do not auto-waive. `waved` is the wand. `logged` is daily only: an all-nighter keyed by the morning date, lifting `evening-before` or `morning-of`. Overrides live in `habitExemptions`. Weekly and monthly ignore log blocks. `undefined` on a link can still mean a name preset; `null` is off. An analyst must use the same effective helpers or will mis-count presets.

**Grades and points.** Knobs are independent: `gradeTolerance` (default 100), `outputGradeTolerance` (default 100), `accomplishmentThreshold` (default 80, not a curve), `accomplishmentBonus` (50), `dayGradeLiftBonus` (25), `weeklyGradeLiftBonus` (25), `weeklyAverageBeatBonus` (5), `monthlyAverageBeatBonus` (5), `gradeUsePriority`, `outputUsePriority`, `goodDaysUsePriority`, `morningRitualPointMultiplier` (drawn on a ritual habit; not a factor inside the 50-point ratio).

`curveDayPercentage(raw, tolerance)` is 0 when raw ≤ 0, otherwise `raw + (100 − tolerance)`. It does not cap at 100. Week grade is the mean of curved elapsed day scores, then the optional priority blend. A future day is not in the mean. A past week is graded through Sunday. Perfect output is the mean of each daily habit’s elapsed row percent, its own curve and blend. The on-grid week-% column is still over the full 7, so early in the week a row’s week % and its contribution to perfect output are different questions. **Week grade averages days. Perfect output averages habits.**

Priority blend, when the toggle is on and some habit has effective weight > 0: `displayed = 0.50 × prioritized + 0.50 × overall`. Floor constant is 50. Completing every prioritized habit and nothing else floors the grade at 50. A day that is 0 on both sides stays 0. Effective weight = consecutive fully empty periods before the current one (cap 52) + 1 if pinned. Mute forces the auto term to 0. Any progress (ratio > 0, not merely met) breaks the run. The star is a different number: 100 on `priorityRefreshedOn`, then −10 per calendar day, 0 on day 10. `priorityPermanent` or “in the ritual today” holds it at 100.

A good day is raw day percent (or the blended day score, if that toggle is on) ≥ the threshold and > 0. The curve is not consulted. Points still needed uses rounded percents. `isAccomplishedDay` uses the unrounded `≥`. Show both when a raw 79.6 against a line of 80 is not a good day while the rounded gap says 0 needed.

Ledger ids, stable enough to join without re-deriving: `habit-day:{taskId}:{dateKey}` (ratio × 50, exempt → 0, max 50), `habit-grade-bonus:{dateKey}` (300 if both shown rails ≥ 75, 100 if either, else 0 — shown grades, after curve and blend), `habit-raw-day-bonus:{dateKey}`, `habit-day-grade-lift:{dateKey}`, `habit-weekly-grade-lift:{weekKey}`, `habit-weekly-avg-beat:{dateKey}`, `habit-monthly-avg-beat:{dateKey}`, and the task id itself for `rewardValue` once, on the not-met → met edge, Reader B. Equal rounded percents pay nothing. 74.6 and 75.4 are not a lift.

**Willpower.** `weekWillpowerStones` emits one stone per daily habit per non-exempt met day in the visible week (Reader B). Nothing is stored. The plate is a function of completions. Weekly, monthly, and season habits do not emit stones. Physics knobs move pixels. They are not behavioral data.

**Outside the habits store, still about a met day.** Meeting a habit upserts a logged-action task. Duration, in order: the logged number if the unit is minutes or hours; else painted tag minutes plus a rate top-up; else `amount × minutesPerUnit`; else flat `minutes`; else none. `timeEstimateNA` skips the assumed paths. A real minutes log or painted time is still observed. `precision: "definite"` means the assumed length does not need confirmation. Morning review stores `priorityHabitIds`. Choosing a habit there refreshes `priorityRefreshedOn`, appends a ritual line to `priorityLog`, and appends a `priorityEvents` row with `source: "ritual"` and no reasoning.

Objectives and goals (`lib/goals-store.ts`) do not reference `WeeklyTask`. A habit does not carry an objective id. Do not imply a habit serves an objective.

### Metric catalog

Recompute from cells. Round to a whole percent only when the comparison is a lift or a points-still-needed gap. Keep the unrounded number for means and trends.

**Adherence.** Cell ratio (Reader A, 0–1). Met (Reader B). Raw day %. Week grade shown: report raw, curved, tolerance, curve bonus (`100 − tolerance`), days included, and vacant days as separate series. Never plot only the blended number. Perfect output shown, same split. Span grade over the active window. Row percent over the window. Paced row percent over elapsed days (what perfect output averages). Period column percent. Good-day indicator. Good period: mean raw day % of that span. Points still needed, and the unrounded disagreement.

**Streaks.** Habit day streak: Reader B, not exempt. Today unfinished does not break it. `streakSkippingExemptDays` neither counts nor breaks on an exempt day. 4+ week streak: ≥ 4 non-exempt met days in the Monday week. The 4 does not by itself raise a climb target; the climb uses the same 4 only as its bump rule. Good-day streak: a fully exempt day scores 0 and can break it, because the collector does not skip vacant days. Good week / month / season, lookbacks 30 days, 12 weeks, 12 months, 4 seasons. Also `longest`, `lastDate`, `totalActivePeriods`.

**Recovery.** A miss day: the day has started, the habit is not exempt, Reader B is unmet. A blank and a named miss are both misses to the math. Keep a second count of named misses. Recovery lag, censored if today is still inside the gap. Return rate within 1, 3, and 7 required days. Bounce: cell ratio the day after a miss, minus the habit’s trailing 28-day mean. Week repair: after a week that failed the 4-day bar, did the next week hit it? Do not call an exempt day a recovery or a miss.

**Trajectories.** Unblended raw day %, curved day %, shown week-to-date grade. Monday residual against the mean of the previous four finished weeks’ Sunday grades (empty weeks skipped, not scored 0). Rail gap: perfect output minus week grade, both unblended. Positive means a few habits are full while other days are empty. Negative means the days look fine while some habits are permanently empty. Curve distortion: curved minus raw. Lift bonuses, using rounded percents.

**Priority.** Weight as of that day. Prioritized-subset score even when the blend toggle is off. Blend contribution `shown − overall` when the toggle is on. Attention yield: met rate in the 14 days after a prioritize press minus the 14 days before, split by kind (set, refreshed, ritual, permanent on, permanent off). The dated line is `priorityLog`; the same press is a `priorityEvents` row. Optional `reasoning` on a manual press is prose, not a weight. Grades and the blend do not read it. The intention for that prose is [Language](06-language.md). Neglect load. Star half-life (10 days unless permanent) crossed with met rate during the fade. Pin and neglect are different populations.

**Willpower.** Stones this week. Stone share. Jewel-on / stone-off: the row jewel inverts on any hit, so a 1-of-7 week still looks on. Report stones per habit, 0–7.

**Sources.** Recompute `trustedOutcome`. Source coverage of met cells. Hand override. Dual contribution (`manualValue > 0` and `trackedValue > 0`) with the mode. Silent machine: met, winner ≠ manual, `handCompleted` absent. Disagreement: printed goal reached while trust says unmet. Keyword share. Occupancy versus threshold, and pace on the open period (`loggedShareOfElapsed`). List grace lift. Floor slack versus `allowAtZero`. Sum versus hand (`habitSumValue − value`).

**Habit versus task.** They meet in four places: the Done row written when a habit becomes met; `taggedTaskTag` (events, not hours); `listLink` (a quota); `rewardValue` (one shot on the met edge). Partial-credit points (50 × ratio) and the met bonus are different ledgers. Stack them.

**Calendar structure.** Weekday profile, Monday-first, exempt cells out, future days out. Weekend delta. Period effect at the habit’s own grain. Do not compare a daily cell to a season cell without aggregating daily cells up (mean of raw days, or sum of `value`, stated). Moon cut only when that window is selected, labeled as the app’s lunar instant. Birthday year is not 1 January.

**Volatility and intensity.** Day volatility of raw day % over 28 elapsed days, empty days as 0, plus the standard deviation conditional on the day having any cell. Habit volatility. Grade volatility of finished-week Sunday grades over the last 12 weeks that have data. Zero inflation. Uncapped intensity `value / goal`, allowed to exceed 1, and overshoot mass. Consistency index = 1 − zero inflation among required days since `createdAt`. Intensity index = median uncapped ratio on days that are not zero. Missing for Yes/No. Text length is a weak proxy and must be labeled. **Uncapped weekly sum / (goal × days)** is the intensity the grade refuses to show. Publish it beside the capped row %.

Windows: `habitWeekWindow` default `sevenWeeks` (`sevenWeeks`, `thisMonth`, `thisSeason`, `fourWeeks`, `thisMoon`). `habitMonthWindow` default `yearToDate` (`yearToDate`, `trailing12`, `sinceBirthday`). View toggles collapse the sheet. They do not change the window used when the view is off. A chart of span grade over time must freeze the window.

### Visualizations

| View | Why it exists |
| --- | --- |
| Habit–day heatmap | Cell ratio. Exempt is a third state, not white-as-zero. `missedOpportunity` is a mark on the zero, not a third color, because the grade does not see it. Sort by weight, then zero inflation. |
| Grade ribbons | Raw band, curved band, blend tick. Monday is a seam. Vacant days are gaps, not zeros. Good-day marks on the raw band. |
| Distribution of daily grades | Histogram of raw day %, threshold line. The 75 bonus is a cliff on the curved rails; do not draw 75 on the raw histogram without that caption. |
| Streak survival | Among streaks that reached k, the share that reached k+1. Pool only inside a type. Mark the one-day grace. A second curve for 4+ week streaks. |
| Recovery curves | Cumulative share met by lag 1…14, named miss versus blank miss. |
| Priority waterfall | Each habit’s `(cell percent / n)` vote. Color by pin, neglect, both, neither. The blend is a separate bridge from overall to shown, so a pin does not look like it already changed the grade. |
| Small multiples per habit | Weekday dots, 12-week capped row %, uncapped intensity, stones 0–7, source rug. Climb adds the target step. |
| Source stack | Met cells by trust winner, per week. A paired bar for unmet cells that still have an auto observation. |
| Climb staircase | `weeklyGoalOn` or the committed base, with the Monday bump annotated. “Percent up” can mean “the bar moved down.” |
| Points stack | 50×ratio, accomplishment bonus, grade bonus (100 vs 300), day lift, 7-day beat, 30-day beat, `rewardValue`. Week lift sits on the week, not on every day. |

### Learning

Show `n`, the exemption rule, and the reader.

- **Clustering.** Each daily habit as a vector of cell ratios on shared required dates. Exempt → missing, not zero. Correlation distance. Also cluster the 7-day weekday profile separately from the level. Leave singletons listed. Text habits cluster on met/unmet only. Echo parents (floor, sum, daily-completion average) default out of clustering and out of “top habits.”
- **Substitution.** Same-day lift of both-met versus the product of base rates, minimum about 28 overlapping required days. A large negative lift, stable across weeks, is “A instead of B.” Time substitution only on days when both have a duration (observed tag minutes or a definite estimate). Source substitution (`manual` falls when `tags` becomes the winner) is a measurement change. Flag it before any sentence about stopping. Climb drops are the same habit moving.
- **Leading indicators of a bad week.** A bad week: Sunday raw week mean < `accomplishmentThreshold`, or the week failing to be a good week. Use only information available by one cutoff, held fixed (Tuesday night or Wednesday). Monday and Tuesday raw day %; named misses so far; habits with auto weight ≥ 1 at Monday; whether yesterday failed the day-lift; prior-7 mean versus the forming week; share of Monday–Tuesday cells whose winner was `manual` versus empty; climb habits already unable to reach 4 hits. The prior-7 and prior-30 gaps are already the app’s leading context. Show them for every past day. Then “visible on Tuesday” is a measured hit rate. Do not use Thursday’s data to predict a week that ended Sunday.
- **Changepoints that are real events.** Habit added (`createdAt`). Priority lines. All-nighter, joined through `logExemptions`, with the counterfactual grade if those habits had stayed required. Window changes and tolerance changes move the shown grade without any cell changing. Plot raw underneath, always. **Edits to `goal`, `increment`, `startValue`, `threshold`, `grace`, `floorPercent`, `trackingLink.mode`, and `completionSources` are not in the store.** A retarget rewrites every past percent. You cannot date it. `updatedAt` on a cell is an edit time, not evidence the target moved. The climb staircase is reconstructable only under the **current** increment. `completion.goal` is not the historical target.
- **Forecasting the grade.** Frozen: remaining days score this week’s elapsed mean. Baseline: they score the prior-7 mean. Habit-paced: each habit’s elapsed ratio, then recompute the day average. Requirement: the minimum raw score each remaining day must average so the week clears the threshold. Perfect output: name the habits that would have to go from 0 to 100 to move the output grade by about `100 / n`. Coverage pace forecasts the open period’s occupancy if current density holds. It does not forecast a Yes/No that is not a coverage habit. Do not forecast exempt future days as required, or a habit before its creation day. Publish last Wednesday’s forecast against the Sunday grade.
- **Difficulty versus follow-through.** Pair `goal` (within a unit), climb `increment`, coverage `threshold`, list grace, floor percent and `allowAtZero`, and `timeEstimate` with met rate and uncapped ratio. `rewardValue` is a prize, not difficulty. Follow-through residual: met rate minus the met rate predicted by goal size within the same unit. Daily-climb difficulty on day t is `increment` relative to recent volatility of the score. The percent already divides by `increment`, so the grade calls a small step and a large step both a full hit. The residual lives in the log.
- **Measurement audit, before any trend.** Habits whose `completionSources` omit `manual`. Weeks where the trust-winner mix shifted by more than 20 points. Goals whose current `goal` is below the median historical `value` (possible silent retarget, not proof). Cells with `updatedAt` more than 2 days after the period key. Tolerance below 100, and by how much the ribbon is inflated.

Within Habits, the crosses that must stay available: overall versus prioritized subset; neglect weight versus whether any source spoke; stones versus raw week grade (the partial-credit gap); stones by trust winner, with an echo caption when the winner is floor, sum, or daily-completion average; parent habit versus the child daily series (`habitSumValue` beside `value` when they differ); counterfactual grade if logged exemptions were required; the four quadrants of good-day × either rail ≥ 75, and the mean points in each; one civil week’s daily raw mean versus the weekly-habit column versus the monthly habit’s pace. Three numbers, three maps.

### Information architecture

Six rooms. The first screen is the grades the person already knows, raw standing next to shown.

| Room | Holds |
| --- | --- |
| This week | Raw day % , threshold, vacant days. Both rails: raw, curved, blended, tolerance, days included. Good-day flag, points still needed, prior-7 gap, prior-30 gap, yesterday gap. Stones and share. Points stack. Frozen, baseline, and “each remaining day needs X.” As-of date matches the grid. |
| The habit | The small multiple. Streaks. Source stack. Exemption calendar. Priority log with the 14-day met rate after each line. Climb staircase. Uncapped intensity. Empty state: created, no required period has a cell yet. |
| The catalog | Heatmap. Grid sorts plus zero inflation, volatility, stone share. Filter by type and frequency. Waterfall for the selected week. |
| Sources and echoes | Source stack. Echo warning. Hand-override table. Coverage pace. List grace lift. Measurement audit. |
| Time structure | Weekday profiles, weekend delta, good-period streaks beside the good-day streak, span grade under the selected window and under the other windows. |
| Learning | Clustering with `n`. Substitution pairs. Leading-indicator table, cutoff stated. Recovery curves. Difficulty residual. Forecast error in public. |

Controls, per chart where a global toggle would lie: Grade math versus Met (default grade math on ribbons, met on streaks and stones). Exemption policy: drop, which is the app’s rule, versus count-as-zero. Raw always; curved and blended are layers. A free last-28 / last-12-weeks that does not move when settings change. Priority term even when the setting is off. As-of date, visible. No physics controls.

### What Habits does not store

A historical `goal`, threshold, grace, increment, or trust list. The previous `value` (only `updatedAt`). An archive. A completion clock on the cell. An objective id. Channel on a `habit:` write (`keywordLogged` is only the keyword path). Willpower as a stored score. Categories as a live taxonomy. Proof that a blank was a failure. `missedOpportunity` as an input to the grade.

Seed habits with no creation key: prefer “since first cell” as the default start. Days before the first log are ordinary zeros if you average a calendar that predates the log. Prior-7 of a brand-new store is 0 because empty days count as 0, so the first real day can “beat” the average and pay the +5. Call that the formula. Neglect: `autoPriorityWeight` does not skip exempt days. Explain a red wash on required days only, and note that the live wash counts empty exempt weeks too.

---

## Plan

Source: [03-plan.md](03-plan.md). Plan is a calendar of **prospective** intentions at several grains, plus a written log. It is not a record of what was lived (**retrospective** paint, task actuals, day-summary prose — [`TEMPORAL_POLARITY.md`](../TEMPORAL_POLARITY.md)). Outcomes are not fields on a calendar event or a free block.

### Entities and grains

| Writing | Store | One row |
| --- | --- | --- |
| Calendar event | `brain2-event-storage` | One titled span. Opalescent chip. |
| Planned action | `brain2-planned-actions` | One timed intention on one local day. Dashed chip. |
| Period plan text | `dayPlan-` / `weekPlan-` / `monthPlan-` / `quarterPlan-` | Immutable stamped paragraphs, plus one unsubmitted draft. |
| Scheduled item | the task store | Live period assignment, and `schedulePlacements` for periods left unfinished. |

**Event.** `id`, `title`, `date`, optional inclusive `endDate`, `startTime` / `endTime` as `"HH:mm"`, `isAllDay`, `type`, optional `taskId`, `color`, `isScheduled`, optional `estimatedDuration` and `rewardValue` (on the type; the calendar does not fill duration, and Plan does not award the reward), `location`, `description`. Writers always save `type: "event"`. Do not build a series on `"task"` or `"hardcoded"`. `isScheduled` is set true on create and on edit; dropping an event on the rail does not clear it. It sets `isAllDay: true`. Treat the flag as unused for “is this on the clock.” All-day drafts are stored as `00:00`–`23:59` and then timed minutes are 0 because `isAllDay` is set. Multi-day events also contribute 0 timed minutes. A clock that wraps past midnight contributes nothing. There is no `createdAt`, `updatedAt`, `movedFrom`, recurrence rule, exception date, timezone id, batch id, or tombstone. `deleteEvent` removes the row. Paste may leave a title prefix that also picks a color; the prefix is not stored separately. A pasted zone token (`Timezone: PST`) lives in `description` and does not shift the clock. Ids from one Paste Events click share a `Date.now()` base plus `-${index}`. That is an id convention, not a field. Call it a batch only when the suffix is `0..n-1` with no gaps.

**Planned action.** `id`, `date` (`YYYY-MM-DD` only; it does not span midnight as a range), `startTime`, `endTime` snapped to 15 minutes, `title`, `notes`, `source` `"free" | "todo" | "habit"`, optional `sourceId`. A second drop of the same to-do or habit on the same day moves the existing block. A drop on a different day can create another. Free blocks never collapse. Duration is `end − start`, and the helper never returns less than 15. A clock that wraps, including an end clamped to 24:00 and stored as `00:00`, becomes a 15-minute block, not an overnight span. Default length is 30. Habit drops use flat `timeEstimate.minutes` when that number is positive, else 30. Per-unit rates are not the block length. `timeEstimateNA` refuses the drop. A habit drop does not complete the habit. Month-grid habit drops are forced to 09:00. Editing rewrites in place. Same id. No previous version. Week-grid drag changes the action’s date and start hour and does **not** rewrite the linked task. Day-rail unschedule of a to-do clears `scheduledTime`, keeps the date, and deletes the placement. Week-rail and month-rail unschedule move the task coarser and **keep** the planned-action row. `deleteAction` is a hard delete. No tombstone list.

**Plan text.** Append-only. Entry: `id`, `createdAt` (null sorts as “earlier”), immutable `text`, optional `stampSuffix`. Telegram `plan for rn` and the morning day-plan step write `stampSuffix: "from text"`. Ordinary Submit omits it. The draft is unsubmitted. An empty string on a month key is a tombstone meaning “no plan,” not a blank plan. Module plan-sync appends `• {item title} [{module title}]`. The link is the sentence, not an id. `scheduleSync.toEvents` has no Plan writer. Settings export walks day, week, and month logs only. It omits season logs and planned actions.

**Task schedule.** Finest grain wins. `scheduledDate`, `scheduledTime`, `scheduledWeek`, `scheduledMonth`, `scheduledYear`. Writing a finer grain clears the coarser fields. Inbox (`stage === "inbox"`) is not a Plan schedule even when a date was parsed out of prose. `deadline` puts a task on a rail when no schedule field is set. It does not by itself put a timed chip on the hour grid. `schedulePlacements[]`: `period` (`day` \| `week` \| `month` \| `year`), `value`, `resolved` omitted or `assimilated` \| `pushed` \| `discarded` \| `clarified`. Omitted means the period ended unfinished (roll-up) or a backfill. `pushed` is an explicit or automatic same-grain deferral; push counters increment; roll-up does not. `clarified` dismisses a past Scheduler card. `discarded` is To Do Discard; the task remains. Do not assume every coarser landing is `assimilated`. Done and missed tasks are not rolled.

Completion on the same task: `completed`, `completedDate`, `status` (`active` / `partial` / `deferred` / `cancelled` / `missed` / `done`), `missedAt`, `startedAt`, `startCertainty`, `actualDuration`, `durationCertainty`, `timeRough`, `estimates[]` (why an autogenerated clock was filled: `tracked`, `logged`, `rate`, `flat`, `now`, `anchor`, and whether it was confirmed), `timeLogs[]` (`date`, optional `startTime` / `endTime`, `durationMinutes`, notes), `completedChunks[]`. Header “followed” can append a time log. A blank length copies the plan into `actualDuration` and marks it estimated (“filled from the planned length”). That residual is zero by construction.

Shape and intensity: `estimatedDuration` (new next actions default to 30), `pertEstimate` (expected = `(optimistic + 4·likely + pessimistic) / 6`, spread = `(pessimistic − optimistic) / 6`), `todoMarks[]` (`required` and/or `prioritized` on a period), `urgency`, `importance` (1–5), `cognitiveLoad` (1–3), `entropy` (0–1), `rewardValue`, `context` (GTD context, not tags), `dependencies[]`, `schedulingConstraints`, `isRepeated`, `repeatSettings`, `autoPush`, `scheduleable`, `hiddenFromTodo`, `dayRatings` (morning importance / excitement, 1–10, distinct from the 1–5 `importance`), `resistanceReadings[]`, `attributes.headerTracking` (`"plan"` or `"unplanned"`), `createdAt`. Rail-added to-dos set `createdAt` to local midnight of the period, so their lead time is zero by construction. Header plans stamp the real clock. `daysPushed` / `weeksPushed` / `monthsPushed` are lifetime totals, not per-period lists.

Month chip rule: a task is on a day when it is scheduled that day and not inbox, or the day is already past and `completed` with `completedDate` on that day. A future day does not show a task merely because it will be completed then. Gem mode draws completion icons on past days and does not erase the schedule. Do not infer “no plan” from a gem cell. Ghost outlines of tracked blocks on the day agenda are not plan rows.

**Rail intention** is computed, not stored: untimed to-dos, undone non-exempt habits, and workable next actions that have not been given a finer slot. Quarterly habits are not a Plan rail. Completed habits leave the rail and do not delete a planned action already written.

**Recurrence.** Count-type tasks advance `completedCount` toward `totalCount`. Frequency-type tasks store `times` per `day` \| `week` \| `month`. Completion does not generate the next instance and does not tick a per-period counter. Habit recurrence is the habit’s `frequency`, not a field on the planned action. Calendar events do not recur. A run of identical all-day titles in a paste collapses into one multi-day event.

**Links that are stored.** Planned action → task (`source: "todo"`, `sourceId`). Planned action → habit (`source: "habit"`, `sourceId`). Task → event via `links[]` relation `checklist-of`, plus `mustBeDoneBefore` = event start. Event → task via optional `taskId`, which is not the checklist. Task → task via `dependencies[]` (a different graph from `links`). Header plan → `attributes.headerTracking = "plan"` plus a matching planned action. Plan entry → inbound text via `stampSuffix`. Checklist rollup is derived. Reviews (`planReflection`, `nextPlans`, start-ritual fields) use the same period keys and are not the plan log.

**Capacity, selected day only.** Commitment minutes = non-inbox tasks with `scheduledDate` that day (`estimatedDuration`, missing adds 0) unless a `todo` placement that day already covers that task id, plus timed event minutes (all-day and multi-day add 0), plus planned-action durations (minimum 15). Overlapping blocks are added twice. The waking window is wake of the morning that ended that day and bedtime of the evening that started that night, bedtime shifted forward by 24 hours. Each end may fall back to the person’s median over the last 30 nights. If either end is missing or the span is not positive, the window is unknown and the 10 pips stay empty. Pips are `round(10 × planned / window)`, capped at 10. Overfill stays at 10 pips and bolds the sentence. It does not change color. The window’s evidence is outside Plan. The numerators are native. A week analytic must sum days itself. The rail’s sentence is always the selected day.

Dayparts are an analytics convention. The product stores `morning` / `afternoon` / `evening` / `night` as words with no bounds. When a chart needs clocks, use: morning 05:00–11:59, afternoon 12:00–16:59, evening 17:00–20:59, night 21:00–04:59. Keep the stored word as its own column.

### Metric catalog

**Adherence, tasks.** Committed to a local day if the live `scheduledDate` is that day and the task is not inbox, or a day placement exists. Adhered if `completed` is true and `completedDate` falls on that day. Missed if `status` is `missed`. Deferred if the placement is `pushed`. Cancelled as a plan if `discarded` or `status` is `cancelled`. Set aside if `clarified`. Unfinished residue if the placement exists, `resolved` is omitted, and the task is not completed on that day. Day adherence = adhered ÷ (committed − discarded). Report pushed, clarified, missed, and unfinished beside the rate. Coarser periods: adhered means `completedDate` falls inside the period. Roll-up is not a push. Partial adherence: `status === "partial"` or chunk minutes ÷ `estimatedDuration`, ratio capped at 1, raw minutes still shown. Count-type series: `completedCount ÷ totalCount`, without also requiring a `scheduledDate` per occurrence. A `todo` planned action uses the linked task’s adherence for the action’s own date, even if the live date has since moved. A free block has no done flag. A habit block’s performance is the habit log. An event has no adherence field. Native proxy: checklist `completed ÷ total` as of the event’s deadline. An event with no checklist has no proxy. Attendance is an outside join. Written prose has no adherence.

**Slip.** Positive means it sat later than planned. Native when the task carries both clocks. Planned start = `scheduledTime`, or the action’s `startTime` when `sourceId` is the task. Actual start = the earliest `timeLogs[]` row on that date with a `startTime`, else `startedAt` if its local day matches. If `startCertainty` is estimated or unknown, or `timeRough` is set, or an unconfirmed `estimates` row covers the start, label the slip estimated. Duration slip = `actualDuration − estimatedDuration`. Exclude “filled from the planned length” from a calibration average, or show it in an “assumed the plan” bin. Internal divergence (action `startTime` minus task `scheduledTime`) is disagreement inside the plan, not evidence of what was lived. Event slip and habit-performance slip are outside joins. All-day and untimed: no clock.

**Overcommitment.** Publish both numbers. Commitment is the capacity sum. Occupancy is the union of timed single-day events, planned actions, and tasks that have `scheduledTime` plus a duration (`estimatedDuration`, else 30 if they are on the hour grid). All-day and multi-day excluded. Stacked minutes = commitment − occupancy, time promised twice. Overcommit ratio = commitment ÷ window, only when the window is known. Occupancy ratio the same. Headroom = window − occupancy. Coarser: week-only estimates that never received a day are an unplaced pile, not a fake Wednesday.

**Empty.** Clock empty = 1440 − occupancy. That counts sleep and meals as empty, so it is a ceiling. Awake empty needs the window. Unplaced intentions (untimed day to-dos, deadline-only rows, undone non-exempt daily habits, next actions the rail would show) are latent load, not empty minutes. Written emptiness: no entries and no draft, versus draft only.

**Recurrence reliability.** Count-type: native. Frequency-type: the rule is native and the score is unavailable. Habit placement: native numerator is distinct days with a `habit` action for that `sourceId`. The denominator (days the habit was daily, already created, and not exempt) is an outside join. Without it, report “days this habit was given a block,” not a rate. Event “recurrence” is a title+location pattern, not a series. Count spans and event-days separately so a week-long hold is not five successes.

**Lead.** Task lead = local calendar days from `createdAt` to the start of the finest schedule. Break the histogram into rail-or-funnel created (midnight `createdAt`, often id prefix `todo-`) versus created earlier and later placed. Header rows use a real `createdAt`. Event and free-action birth is not stored. Do not use the id’s `Date.now()` except as a labeled paste-batch heuristic. Writing lead = local days from the entry’s `createdAt` to the period’s start. Null `createdAt` drops out of the average. Drafts have no lead until submit. Checklist lead = event start minus the prerequisite’s `createdAt`, and minus `completedDate` when done.

**Reschedule.** The rate below is recorded departures, not every drag. A drag onto a future day overwrites `scheduledDate` and does not append a placement. Recorded departures = `schedulePlacements` length, by period and by `resolved`. Push rate uses the lifetime counters and, separately, the share of placements marked `pushed`, so one chronic task is a distribution. Roll-up share = omitted `resolved` ÷ all placements. Same-grain survival among tasks that completed. Event reschedule and action reschedule are not stored. Day, week, and month unschedule write different residues. One blended “reschedule rate” will lie.

**Horizon.** Days from today to the start of the live period, open tasks only. Horizon mix by grain, plus next actions with no `scheduled*`. Event horizon from `date`, multi-day events counted once at their start, span length separate. Writing horizon from writing lead. Deepest native horizon is the season log plus a year assignment. There is no five-year plan object.

**Daypart load.** Start load and minute load, as three series (events, actions, tasks with `scheduledTime`) that can triple-count one intention. Prefer placements over the task clock when both exist. Keep events separate. Split a block that crosses a bin boundary. Overnight wrap is not representable; those blocks look like 15 minutes. Preference fit: share of tasks whose start bin matches `timeOfDayPreference`, using the table above. Constraint violations against `canOnlyBeDoneAt`, days, dates, and must-before / must-after. The product does not prevent them. Weekday profile from the date, not the column index.

**Other native metrics.** Checklist readiness, including “ready before start.” Dependency readiness (dependencies still open **now** is a biased proxy for “blocked when the period started”; label it). Critical-chain load from PERT expected duration along the zero-slack chain; unsized tasks listed, not treated as free. A cyclic graph is partial. Grain leak: a planned action whose task now has only a coarser live field. Orphan placement: `sourceId` missing from tasks or habits. Duplicate placements of the same `sourceId` on different dates. Push inflation: max and median, not only the mean. Required-mark minutes. Context load, blank context its own bucket. Reward promised (not awarded). Schedule-placement points (+1 per changed bucket) live in the points ledger: outside join. Paste density. Writing volume and the gap between consecutive `createdAt` values. Unwritten periods. Banner share. Default-duration share at exactly 30 minutes.

### Visualizations

State the grain in the title: minutes promised, minutes occupied, tasks, event-days.

| View | What it shows |
| --- | --- |
| Planned-load calendar | Commitment heat and occupancy heat, switchable. Unknown window stays neutral ink with the minute total as text. Hatch where stacked minutes are above zero. Corner mark for banner event-days. Optional ticks for a submitted day plan and for a draft. Week strip includes the unplaced week-only pile as its own bar. Past days that were finished without being scheduled get a different mark (“finished here”). |
| Three ribbons | Day ribbon in lanes (events, free / todo / habit, timed tasks with no placement). Overlap is two bars, not a taller bar. Banners above the clock. Wake and bed only when the window is known. Horizon ribbon of open tasks by grain. Critical-path ribbon on work order, PERT band, zero-slack ink. Cycles get an explicit broken state. |
| Slippage histograms | Only rows that have both clocks. Subtitle is the count excluded. Clock slip in 15-minute bins. Duration slip. Internal divergence labeled disagreement. Checklist lateness. Scatter of planned versus actual duration, estimated points marked differently. Events do not appear. |
| Commitment versus capacity | Occupancy solid, stacked extra as a second segment, window as a tick. Missing window: column still shows commitment, tick absent. Unplaced rail minutes off to the side. Keep the ratio; do not collapse overfill into “full” because the 10 pips saturate. |
| Recurrence | Count-type steps and a survival curve by age since `createdAt`. Habit blocks as a calendar of placement dots, cumulative count until the exempt denominator is joined, labeled as placements. Frequency-type: the rule as a sentence and an empty frame. Title-pattern events as dates on a line. One multi-day span is one segment. |
| Strips | Horizon by grain. Writing lead by period type. Weekday × daypart minute load. Placement resolution stacked by the week the period ended. Default-duration spike at 30 beside the real distribution. |

### Learning

- **Which plans survive.** Unit: a task-period commitment whose period has ended, or a placement row. Censor open periods. Outcome: adhered, as defined above. Stratify one feature at a time: grain, duration bucket and whether it is the 30-minute default, daypart or untimed, preference match, urgency, importance, cognitive load, and entropy kept separate, required versus prioritized versus neither, `autoPush`, context, the biased dependency proxy, PERT spread, deadline slack, whether a placement exists, count-type versus frequency-type (frequency-type is its own stratum with no outcome), checklist item versus ordinary task, `rewardValue`, lead with the rail caveat, prior placement count. Survival curve by days since the period started. A logistic model is optional and should stay interpretable. Do not train on events. A stratum of three is a list, not a rate.
- **Planning bias, no lived data required.** Start-minute histogram. Expect spikes at `:00` and at 15-minute snaps, and at 09:00 from month habit drops and dialog defaults. Split “default 09:00, duration 30, untouched notes” from a start someone typed. Weekday × hour. Preference versus placement mismatches as a count. All-day share by weekday. If most plans are banners, daypart charts of timed minutes describe a minority; print that minority’s size. Lived-versus-planned daypart bias is an outside join.
- **Overcommitted days.** Only when the window is known and commitment ÷ window > 1. Unknown-window days are a third state. Runs of consecutive overcommitted days. Weekday odds with counts. Coupling with multi-day banners. Coupling with high unplaced rail minutes. Deadlines in the last three days of the month, which may cluster without adding clock minutes. Autocorrelation of daily commitment at lag 1 and lag 7. With a short history, show the correlogram and the number of days. Do not cluster on the 10-pip value.
- **Next week’s planned load.** Already placed is native, not a forecast: commitment from events, actions, and day-scheduled tasks already dated there, plus the week-only pile shown as unplaced. That is the floor, a solid bar. Habit-block expectation: share of past days in a stated trailing window that have a `habit` placement, times the block minutes. Dashed. It overstates habits the person stopped dropping and understates habits they only keep on the rail. Exemptions are an outside join. Do not project repeating events from a rule. Optional dashed marks only where a title+location pattern has several past dates and a stable gap, labeled “title has repeated.” Count-type remainder contributes `estimatedDuration` once if the live schedule lands in the week, not `totalCount` times. Frequency-type omitted. PERT band on tasks that have it is optimistic-to-pessimistic minutes, not a confidence interval. Events have no PERT. A forecast run on Sunday night will not match Monday after roll-up. A seasonal naive “same weekday last week,” computed from stored commitment, is the baseline to beat. If it wins, the plan is habitual. If the already-placed bar wins, the plan is literal.
- **Also inside the records.** Checklist remaining at event start. Zero-slack tasks with no `scheduledDate`. Periods with a long plan log and almost no timed minutes, and the reverse. Deferral style as the sequence of `resolved` in period order. The array does not store when the person clicked. Default gravity: share of new timed blocks at 09:00 for 30 minutes, by month.

Within Plan, the day table that must stay available: timed event overlapping an action; banner covering a day that still has clock room; task with `scheduledTime` and a matching placement; task with a clock and no placement; placement whose task date now differs. Also recurrence × placement (weekly habit dropped on a day is “planned off-rail”), `autoPush` × grain × adherence, required × grain, writing lead × scheduling horizon, draft on a period that already ended, `stampSuffix = from text` × hour of `createdAt`, module line × events that day (by day, not by item), `scheduleable` × on the calendar (four populations), PERT spread × horizon, constraint violation × adherence, checklist remaining × event horizon, and `resolved` × current `status`, including the rare done-and-discarded cell.

### Information architecture

Eight views. Default range: the season that contains today. Day / week / month / season / year use the same keys as the plan logs. Every view shows the sample size and the count excluded for missing clocks or missing windows. A status line names the store. When a tile is refused, the sentence is specific.

| View | Holds |
| --- | --- |
| This period | Commitment versus window or “window unknown,” occupancy, stacked minutes, unplaced rail count, banner count, log or draft. The actual items. Required marks and blocked dependencies. |
| Load calendar | The home chart. Toggle commitment / occupancy. |
| Day ribbons | Lanes. Empty hours stay empty. Overlaps stay overlapping. |
| Adherence and slip | Tasks only, periods that have ended. Survival curve and slip histogram. A shelf: events and free blocks have no outcome on the plan. Checklist readiness is the event-shaped proxy. |
| Horizon and deferral | Horizon mix, long ribbon, resolution stack, push distribution, roll-up versus push. |
| Recurrence | Count-type progress. Habit placement dots. Frequency rules as sentences. Title patterns labeled as patterns. |
| Writing | Lead and volume for day, week, month, and season. Drafts. From-text versus desk. Module lines as their own mark. No sentiment score. |
| Forecast and data quality | Next week’s already-placed bar, the soft habit expectation, and the ways Monday’s roll-up will change it. Orphan placements, duplicate `sourceId`s, action/task clock divergence, events demoted to all-day, 09:00×30 defaults, paste batches, season logs missing from the settings export, unknown windows. |

### What Plan does not store

Birth or move history of an event or a free block. Attendance. A done flag on a free block. Habit completion on a drop. Exemption state. A generated instance per frequency-rule occurrence. The path of a live drag (the first durable trace is a placement when a period ends unfinished). When a resolution was clicked. An IANA zone. Sunrise on the plan row (the day agenda reads the home city; a daylight daypart is an outside join). Points awarded for changing a bucket. Review essays. Whether prose was followed. `sourceLine` from the paste parser. Ghost tracked outlines as plan rows.

---

## Now

Source: [04-now.md](04-now.md). Now is the header door onto the present. It does not have a private database. Almost every save lands in a store that Tracking, Plan, Operations, or ingest also write. The dialog’s open and close, which pane was showing, which lane was selected, and the draft clocks die when the dialog closes. There is no persisted sample of “the user looked at Now,” no cognitive-state enum, and no assertion log.

Analytics of Now is analytics of a short-horizon state reconstructed from occupancy, with a thin set of true event times beside it. Reconstructed presence is not an observed check-in. Capture doors (Ingest, From Notes, Phone Notes) do not log the present moment.

### Entities and grains

**Presence lanes.** Fixed scope ids: `activity`, `location`, `mood`, `company`. Update state calls `applyScopeNowUpdate` or `paintScopeSequence`. Both paint the timegrid store. The resulting `TimeEntry` has no `source: "now"`. A later grid edit rewrites the same minutes, and Now’s assertion is gone.

| UI | Stored shape |
| --- | --- |
| Value changed, or lane empty. **Add for now.** Span `open`. | Fill from the previous block’s end (or from this minute) through the current minute. Minutes after now on that view today are erased. The previous pen on those minutes is deleted. |
| Value unchanged. **Update.** Span `open`. | Same fill. Adjacent same-pen blocks merge unless a seam exists, so this often lengthens one block. Confirmation is not a new row. |
| Value unchanged. **Add for now.** Span `minute`. | Paint only this minute. `splitAfter` can keep the new minute as a second block of the same pen. This is the only stored mark of a re-assertion that kept the old value visible as a neighbor. |

`presencePaintEnd` is `min(floor(now) + 1, 1440)`. A now-stamp does not paint through midnight and does not wrap. It is also a deletion of the rest of today on that lane. `spanId` is not set by the Now stamp or the sequence painter. `moodReading` is copied forward when Update continues a neighbor that already had one. The lane picker does not edit the nine ranks. Until a reading is stored, mood analytics here is categorical.

`loggedAt` on a lane is not an assertion timestamp. It is the latest minute that fact still names. A live work or pen-color hint can display a current name with no covering block. Historical analytics never see the hint. Analytics of “what was true” uses coverage. Analytics of “what the dialog would have shown” may use last-known, labeled as the fallback, not as fact.

A **presence frame** at local minute `t` on date `d` is the 4-tuple of covering non-instant intervals. A component is missing when no interval covers `t`. Do not impute it. Joint state is the tuple of the components that are present.

**Events and thoughts.** `submitTrackingLog`, the same function as the Home log. From Now: Events are Activity instants on Text log, `eventKind` = slug of the phrase, clock exact, minute = now if the day key is today, else 08:00. Thought process: `eventKind: "thought-process"`, first line `title`, later lines `notes`. Duration 0. Invisible to presence. No location is attached. No estimate flag is offered from this composer. An exact instant might still have come from the desk. `createdAt` is absent. `startMin` is a proxy for click time only if nobody later moved the instant.

**Wellbeing.** The Metrics key writes `brain2-metrics-store`. A datapoint does not record which door logged it. This is the one series where update latency is identified: `lag_min = minute(createdAt) − minute(at)` in local time. Positive means written after the minute it names. Zero is same-minute logging. Negative means `at` was set in the future relative to `createdAt`, or the clock skewed. This lag is timeliness, not estimate accuracy.

**Working on.** The Operations clock, at most one session in `brain2-work-session`. After stop, `startedAt` and pause fields clear. The painted blocks and the operation’s `timeLogs` remain. Recover the start from `spanId` `work-<startedAt>` if that id survives merges. Elapsed active time is the sum of slice lengths. Pause of a finished session is not recoverable. The “usually ~N” chip is computed at render from the median of past logs. It is not stored. The pen-color session (`pen-color-<startedAt>`) is a second singleton. Current moment reads it as a hint and does not render its strip. Do not describe it as a Now control. Do count the hint when explaining why a lane can say “current” with no covering block.

**Header plan.** `createHeaderPlan` writes three copies: a task per step (`id` prefix `htk`, `stage: "scheduled"`, `createdAt` at save shared by every step, `scheduledDate` of the Plan pane’s day, chained `scheduledTime`, `estimatedDuration`, `startCertainty` on every step, `attributes.headerTracking = "plan"`, `lists: []`), a `PlannedAction` (`source: "todo"`, `sourceId` = task id, no `createdAt` of its own), and one day-plan append line. Ordinary UI submits omit `stampSuffix`, so a Now plan line is not distinguishable from a Home → Plan line except by matching the text to tasks saved in the same minute. “After dinner” sets 19:00 and estimated. “Right now” sets the current minute and exact. Agenda click-drag calls the same writer with `startEstimated: false` and the placeholder title `"Planned action"`.

Rename and retime call `commitItemEdit` with source `"header-tracking"`. That appends an `ItemActivityEntry` (`brain2-item-activity`, cap 200 per item): `itemId`, `at`, `summary`, `changes[]`, `source`, `order`. Creation does not write this ledger.

`recordPlanFollowed`, `recordPlanSkipped`, and `insertUnplanned` exist and are used by tests. The dialog does not call them. Until those buttons exist, do not pretend skipped, followed, or unplanned rows are coming from Now. `attributes.headerTracking = "unplanned"` means a completed, unscheduled row with notes “Not on the plan.” If such a row exists, it is lived residue. It is not a plan. `derivedDurationGap` is a pure function, not a stored field.

**Day notes** in the Tracking pane are the shared day-notes log for today. No Now provenance.

**Ephemeral.** Dialog open, pane, selected lane, sequence drafts, the est. checkbox, undo stack (in-memory, max 40, no timestamps). A failed or abandoned stamp leaves nothing. The undo stack can erase a save; the id may land in `removedEntryIds` without the payload.

### Metric catalog

**Presence.** Coverage per scope = occupied minutes ÷ 1440. Union coverage across the four lanes. Pairwise coverage where two named scopes are both filled. Minutes of a value. Mood display minutes use `moodReading.word` when set, and report the pen as a second key. Gaps are the unlogged present. Lane status `current` \| `last` \| `empty` at a chosen minute, without the live hint.

**Update latency.** Only wellbeing. Median, 90th percentile, share at 0, share above 60 minutes. Split by whether all five keys are present. Do not compute this for presence blocks. They have one clock.

**Corrections, counted separately.** Seam re-assertion: `splitAfter` whose following neighbor is the same scope, same pen, and starts at `endMin`. Also produced by any scissors cut. Value change: interval A ends where B starts and the pen (or mood word) differs. An `open` overwrite destroys A. Plan correction: item-activity rows with `source = "header-tracking"`. Switch rate = pen changes ÷ occupied minutes. Inherited estimate: a continuation that keeps `clockCertainty: "estimated"`. After a merge you cannot always tell an explicit sequence estimate from an inherited one. Both look like `precision: "estimated"`.

**Trajectories.** Categorical `state(d, t)`. Publish both “any lane” and “all four,” and say the complete-case subset is biased toward diligent logging. Mood-rank series only where a reading was stored, point plots at `startMin`, no interpolated ramp. Wellbeing points at `at`, no forward-fill, no line across a gap longer than a stated horizon (default 6 hours). Within a datapoint, `affect_gap = joy − suffering` and `alignment_gap = alignment − situationalSatisfaction` only when both keys exist. Descriptive contrasts, not validated scales. Transition chain skips missing minutes rather than inserting a gap token, and reports the skipped mass.

**Estimates.** `est_minute_share` = estimated occupied minutes ÷ occupied minutes, using `precision === "estimated"` or `clockCertainty === "estimated"`. Calibration of a binary clock flag against a later exact rewrite is usually unidentified, because the later paint replaces the estimate. For header-plan tasks that later gained an actual: `duration_error = actualDuration − estimatedDuration`, `start_error_min` = first time-log start − `scheduledTime`, only where the certainty flag says the number was estimated, captioned with whichever surface wrote the actual. Mean error is bias. Mean absolute error is accuracy. Do not pool estimated starts with exact starts. Do not put wellbeing lag on the calibration plot. “Usually ~N” can be recomputed as of the minute before start from older logs and compared to the new log. That reconstruction is valid. The chip itself is not stored.

**Session rhythm.** Unobserved: dialog opens, pane flips, lane selections, abandoned drafts. Proxies, each labeled: check-in candidates (a presence interval ends and the next minute is empty or a different block, end not midnight — also produced by the grid and by stopping a work session); writing-time pulse (inter-arrival of metric `createdAt`, day-note `createdAt`, plan-log `createdAt`, and header-tracking ledger `at` — mixes doors); work-start pulse (parse `startedAt` out of `spanId`); thought and event pulse (mixes Home log and ingest). Inter-check `Δ`, diurnal histogram, share of gaps longer than 3 hours. State the waking-window assumption (Activity coverage, or clock hours 8–23). Burstiness: coefficient of variation of `Δ`. Near 1 is Poisson-like. Above 1 is bursty. This is not “you opened Now N times.”

**Transitions.** Collapse adjacent merged intervals (same pen, no `splitAfter`) into one dwell. `P_ij` from counts. Leave-rate per hour uses hours spent in the state as the denominator. Joint state: top 12 plus Other. Drop edges with count < 3 on the diagram. Self-loops across a seam are re-assertions, not stays. Stays are the dwell length.

### Visualizations

Default today and the last 7 days, with a coverage mask. A month view is a raster of gaps.

Four-lane timeline. Estimated blocks use the product’s estimate treatment. Instants on a stem under Activity. Seams as a notch. Paper color where nothing was logged. An optional, quieter “last label carried forward” overlay, captioned as the fallback. Joint-state ribbon, broken where the chosen completeness rule fails. Day raster, rows = days, columns = hours, darkness = union coverage or the modal joint state. Markov diagram: edge width follows count, probability is the label. Separate smaller diagrams for mood word and for company. Dwell survival, censoring a dwell that runs into a gap or into an open block. Reliability diagram only for header-plan tasks that have both a plan and an actual, separate panels for estimated and exact starts. Lag histogram for wellbeing, titled timeliness. Transition heatmap, diagonal as seam counts in a side column. Five wellbeing sparklines, no line across long gaps.

Do not draw a single Now score, a smoothed mood line through missing ranks, a pie of pen share that hides coverage, or a ticker that depends on the dialog being open.

### Learning

- **Dwells.** For each pen with at least 5 dwells: mean, median, 90th percentile, share that are exactly 1 minute (the single-minute stamp signature), share censored by a following gap, hazard in the first 15 minutes versus after 60. “Dwell of tension ≥ 7” is the duration of intervals whose stored `tension` is at least 7. Compare that to the dwell of the mood word.
- **What precedes a change.** For transition `i → j`, look back W minutes (default 30) on the other lanes and at instants. Lift versus base rate on occupied minutes. Minimum 10 transitions. Thought instants in the window are a second list. Wellbeing points inside W are case cards, not regression coefficients. A work-session start is a session boundary, not a discovered cause: the session is the Activity paint.
- **Calibration.** Bias and noise of `duration_error`. Reliability by planned-length bins (15, 30, 45, 60, 90+). Mean start error on the estimated-start subset. Flag honesty: the width of start error among `startCertainty: "estimated"` should exceed the width among `"exact"`. If it does not, the checkbox is not carrying information. The tab reports error. It does not rewrite Tracking.
- **Changepoints in practice, not in mood.** Daily series: union coverage, switches, seam count, estimate share, instant count, metric count by `createdAt`, plan steps created with `headerTracking = "plan"`, header-tracking ledger rows. Windowed mean-shift, default 7-day windows, flag when means differ by more than 2 standard errors and each window has data on at least 4 days. If metrics are zero on 90% of days, say they are occasional and skip the detector.
- **Short-horizon forecast.** One-step Markov from the current joint state, three chips, horizon = the median dwell. If the row count is under 8, say “not enough repeats.” Print coverage beside it. The chain is conditioned on being logged. Laplace smoothing stays in the chart’s appendix so a never-seen edge does not appear as a prediction. This is not a forecast of tomorrow.
- **Diversity.** Entropy of occupied minutes on one scope, in bits, plus coverage. High entropy with low coverage is a handful of labels in a mostly blank day. Prefer entropy of mood and of company, and a unique-pen count for Activity, because Activity phrases saturate joint entropy.

Within Now: contingency and mutual information on co-covered minutes only, with the co-coverage denominator on the card. Coupling rate: share of company changes that share a minute with an activity change. Instants attached to the four lanes or “unlogged.” Lag from a thought’s `startMin` to the next mood pen change. Wellbeing joined on `at` to the presence tuple; aggregate means only when at least 15 points share a lane value, `n` per key. Median lag by lane value, not means. Work spans: Activity pen (a mismatch means a later edit), location and company duration breakdown, no pause chart after stop. Header-plan chain beside the Activity timeline as a descriptive intersection. Item-activity `at` is a real correction timestamp. Estimated stretches described by the other lanes in their window: a story about when the user reaches for the estimate flag, which the data can tell, as opposed to whether the clock was right, which it usually cannot. Adjacent estimated steps with no gap are a candidate sequence, labeled “looks like a pasted sequence.” Do not mix candidates into the live transition matrix. The candidate may have been typed all at once.

### Information architecture

Four rooms, in order of trust. Default trailing 7 days. Footnote on every room: presence is reconstructed occupancy; dialog visits are not stored; overwrites delete the previous claim.

| Room | Answers |
| --- | --- |
| Today’s moment | Four-lane timeline, joint ribbon, instant ticks, estimate hatching, seam notches, coverage fraction, current or last value as of the latest covered minute. |
| Rhythm | Day raster, proxy inter-arrivals with their confounds, seam count versus value-change count, entropy of mood and company, changepoint sentences. It must not say the dialog was opened N times. |
| State movement | Markov diagram, dwell survival, precursors, coupling rate. Scope picker defaults to mood, then company, then activity, then the joint tuple. |
| Estimates and the short plan | Reliability diagram only over tasks that have both numbers. Estimate-minute share by scope. Surviving estimated intervals with the other lanes. Wellbeing lag, titled timeliness. Ledger ticks. |

Empty states: no presence intervals, no Markov of zeros; empty metrics store, omit the lag histogram; no `headerTracking: "plan"` tasks, say the Plan pane has not saved a sequence.

### What Now does not store

How often the dialog opened, which pane, how long it stayed open. Click-time of a presence stamp as distinct from the minute it filled. The value overwritten by an `open` update. Whether an exact instant or an estimated block came from Now rather than the desk, the grid, or ingest. Calibration of an estimated interval against the exact interval that replaced it. Pause history of a finished session. A sampled cognitive-state enum. Followed, skipped, and unplanned, until those writers are called from the pane. A shared `spanId` or `createdAt` that would prove several intervals were one sequence save.

---

## Telegram

Source: [05-telegram.md](05-telegram.md). BIM is the phone door. The conversation is a thin rolling audit. The life record is thick, and only some of it remembers that a phone wrote it. Every chart says which grain it is using: the last 200 turns, or the stamped history that survives rotation.

### Entities and grains

A turn arrives as a Telegram update (`message` or `edited_message` only), through one consumer at a time, into `ingestIncomingAsync`, then an `IngestEvent` except where the executor returns before the log. `at` on the event is `receivedAt`, which is `message.date`, not the moment the poller applied it. `edit_date` is ignored on purpose.

| Grain | Durable? | Clock |
| --- | --- | --- |
| Update | Only as dedupe key `upd:{update_id}` inside a ring of 500 | Not stored after the claim |
| Ingest turn | Last 200 events, newest first, GPS successes stripped. Key `brain2-ingest-store` | `at` = send time |
| Pending clarify / ritual | Until the next resolving turn clears it. Key `telegram:{chatId}` | `createdAt` = send time of the turn that opened the question |
| Capture session | Derived. For one `chatId`, sort by `at`. Cut when the gap exceeds 20 minutes, or when a ritual pending opens or closes | — |
| Ritual session | From a morning, night, review, or reviews turn that opens a ritual pending, through the turn that clears it | Step names on the pending ritual. A partial morning is also on `morning.resumeStep` |
| Poller heartbeat | `data/phone-hub-status.json` overwritten about every 10s. Electron poll fields are memory only | Latest only |
| Domain record | Yes, subject to later in-app edits | Usually the send time. Processing time is the exception |

**The log.** Each event: `id`, `at`, `channel` (`telegram` \| `simulate` \| `hub`), `chatId`, `userId`, `username`, `raw`, `kind`, `status` (`applied` \| `clarify` \| `ignored` \| `error`), `summary`, optional `itemIds`. Also on the store: `seenIngestKeys` (max 500), `pendingByChat`, `allowedChats` (`pairedAt` does not expire), `revokedChatIds`, `pairing`, `shortcuts`, `discreteEventTriggers`, `livePins.grocery` (one row; `at` is wall-clock of the pin call, a rare processing timestamp), gates. Duplicate updates and “ingest disabled” return before the log. Successful GPS paints are removed from `events` and kept in a memory ring of 40 that is not in the persist hub. Reply text, bot message ids, pin failures, OCR confidence, and send failures are not columns. A failed `sendMessage` can leave the vault written and the phone unconfirmed.

Updates that never reach the executor: stickers, video, contacts, polls, documents that are neither PDF nor image, photos or PDFs over 12 MB with an empty caption, `getFile` failures, empty text. There is no callback data. Clarify is free text.

**What the bot writes, and what stamp survives.** This is the list the combined tab is allowed to call “from the phone.”

| Stamp | Where | Confidence |
| --- | --- | --- |
| `IngestEvent.channel === "telegram"` | Last 200 turns | Certain for those turns. Blind to older history, GPS successes, silent dupes, and drops. |
| `generatedBy.kind === "text"` | Log, intake, thought, discrete triggers, `currently` / `stopped` / `switched to` spans | Certain those minutes were the text pipeline. Simulate sets it too. Filter `channel` when the 200-log still has the turn. |
| `keywordLogged` / `keywordValue` | Habit cell after `dh:` | Certain a keyword line wrote the cell. A later in-app edit can change `value` and leave the flag. |
| Notes `from text message at {clock}` | Habit done-log notes, activity-span notes | Certain at write. Editable. The clock is process-zone, 12-hour, minutes omitted when zero (`3pm`). Do not re-parse those notes as a time series. |
| `sent from text` | Needed-list item notes | Certain at create. |
| `logged from text` | Morning-ritual to-dos | Certain at create. |
| `stampSuffix: "from text"` | Plan append log | Certain. |
| `morning.source === "telegram"` | Day review morning slice | Certain. Desktop morning sets `"desktop"`. |
| `start.source === "telegram"` | Week-and-longer start ritual | Certain. |
| `allNighterSource === "telegram"` | Sleep night | Certain for the all-nighter flag only. Bed and wake from `gm` or `sleep:` do not set this. |
| `livePins.grocery.at` | Last pin | Certain a pin happened. One row, overwritten. |
| `account: "Telegram"` | Loose-parked read misses | Certain. |
| Folder **From phone**, tags `docs`+`scan` | Journal / PDF | Weak. The app can file a note there by hand. |
| iPhone Screen Time / Calls / Texts, `precision: "estimated"` | Those scopes | Medium. A hand paint on that scope is the same shape. |
| `precision: "estimated"` on sleep | `sleep:` | Weak. The morning UI can also store estimated ends. |

**No stamp. Channel is not identified:** Inbox and quick add, bulk, grocery completion, `habit:` / `did:` (the cell’s `updatedAt` is processing time, and there is no `keywordLogged`), `at:` / `mood:` / `start:` / `track:` paints (they look hand-painted; `track:` may fill `trackedValue` rather than `keywordLogged`), GPS as a unique channel (the grid note `"gps"` survives; the audit row does not; Shortcut and `gps:` text share the note), cycle flags, day jots, night and end reviews (`endCompleted` is not channel-specific), work-session start/stop, regrets, count ticks (join them through a text-log instant at the same date and `startMin` while that instant exists), pantry quantity (a counter, not an event log).

`itemIds` is set only for `status: ok` when the writer returns them. `habit:`, `habit-trigger`, `currently`, location, mood, track, GPS, phone-life scopes, sleep, cycle, day notes, and `plan for rn` do not put ids on the log. The join is then the stamp, or nothing.

Morning is the densest conversation. Partial `PeriodReview.morning` is saved with `source: "telegram"` and `completed: false` until the end. Depth score from the filled fields, 0 through 11: no slice; bed or all-nighter; wake or all-nighter; dream or skipped via all-nighter; affirmations; todos added or `requiredTaskIds` defined, including empty; `priorityTaskIds` defined; `priorityHabitIds` defined; walk index or walk finished into the day plan; `dayPlanLogged`; `bestDayWhy`; gratitude length > 0 and `completed`. `STOP` still saves. It is a partial commit. Voice inside morning advances the step and discards the audio. Live location during a ritual is dropped and usually not logged. The visible scar is a GPS gap whose clock sits inside a morning `resumeStep` interval. That is a hypothesis about missing samples, not a count of dropped updates.

A **telegram day** is a local date where any high-confidence stamp is true: a text-pipeline time entry on that date, a habit cell that day with `keywordLogged`, a plan entry that day with `stampSuffix === "from text"`, `morning.source === "telegram"`, `allNighterSource === "telegram"` on that morning’s night, or a needed item or morning to-do whose `createdAt` falls on that date and whose notes carry the phrase. Do not define it from the 200-row window.

The executor’s timezone is the machine that runs the bot. There is no per-chat zone. A hub in UTC filing a Pacific life will put `gm` on the wrong local day. Any telegram-day chart must bin in the zone the executor used, or the join to habit dates will lie. `message.date` itself is an absolute instant.

### Metric catalog

**Command mix,** ingest turns, channel `telegram`, inside the 200-row window. Collapse aliases. The log stores `kind`, not the surface form. Kind share, family share (help, grocery, needed, capture, bulk, habits, log, monitor, plan, todo, review, track, note, sleep, gps, screen, call, text, iphone-notes, pin, inventory, receipt, journal, read), mutating share, help gravity and the follow-on rate (next turn in the session is a mutating apply). Alias waste is not stored. Infer a shortcut only when `raw` still starts with a one-letter token or a key in `shortcuts`.

**Latency.** `processedAt` is not stored. Do not subtract `at` from itself. Accidental clocks, labeled as such: habit-cell `updatedAt` minus the event’s `at` (last write wins; a later in-app edit measures the edit), and grocery pin `at` minus the event (one pin, the last call). Album wait is 1.1 s, untimed as its own span. Queue lag while the laptop sleeps is censored at about 24 hours, because Telegram drops unclaimed updates. Report that as a coverage caveat, not a number.

**Completeness.** Apply, clarify, error, and refusal rates inside the window. GPS successes are already excluded from the denominator, so the apply rate is biased away from location life. Silent-drop rate and dedupe rate are not stored. Parse-but-no-persist is visible by kind (`help`, `pin`, empty grocery dump, `stop` with nothing running). Capture-completeness ratio `C_d` — stamped writes on day d over stamped plus the in-app residue you are willing to name — only for domains in the high-confidence half of the cheat sheet. For Inbox, grocery, night review, and `habit:` without `dh:`, the ratio is not identified.

**Failure.** Latest poll error only. Clarify abandonment inside the window, and abandoned mornings via `morning.completed === false` with a `resumeStep`, which survives rotation. Human retry: same chat, same kind, normalized `raw`, gap under 2 minutes, previous status `error`. Seen-key overflow is not directly countable. A symptom is two domain rows with the same title and the same send timestamp. Edits are a new `update_id` with the same `message_id`. Because dedupe prefers `update_id`, a text edit is a second command. It does not update the first record.

**Time of day.** Hour and weekday×hour of `at`, in the process zone. Ritual hour: first morning or night turn of a ritual session. Store-trip hour: `bought` and `receipt`. Live-location coverage: Location entries whose notes are the GPS note, by hour. That uses the grid, so it survives rotation, and it still cannot separate Live Location from `gps:` text or the Shortcut.

**Remote versus in-app.** One comparison per domain that has a real stamp: text instants versus other instants; text-pipeline span minutes versus hand-painted Activity minutes, and span starts separately, because `currently` paints through midnight; keyword-met habit-days versus hand-met, with `updatedAt` much later than the ingest turn called “edited after”; morning completion and depth by `morning.source`, comparing telegram mornings to desktop mornings, not to days with no morning; start rituals by `start.source`; plan entries by `stampSuffix`; needed lines by the notes phrase; morning to-dos by `logged from text`. Night review, cycle, day notes, `habit:`, location and mood paints, Inbox, and grocery checkout stay in a section titled not separable.

**Funnels.** Start the published turn funnel at paired turns. Draw sent, extracted, and claimed as a dashed unknown. Clarify funnel: opened, resolved next turn, re-asked, abandoned, escape hatch (`new`, `see`, `again`, `dismiss`, `inv`, `skip`). Morning survival from the depth score, one curve for completed, one for `resumeStep` abandoned. Night funnel: `endCompleted` is the only durable finish bit, and it is not channel-specific. Inside the log window, re-simulating `periodSteps` is deterministic and still an outside join to the review. Pairing: time-to-pair from the first `Unpaired sender` for that `chatId` to `pairedAt`, while both rows exist.

### Visualizations

Name the grain in the corner. Outside joins wear a joined mark. Unidentified domains do not get a fake share.

Command calendar: turn counts (the month looks empty before the window) versus stamped writes (full history) versus ritual days. A mark when the day has stamped writes and zero ingest rows: history exists, the log has rotated. Command mix, last 200 and, separately, last 30 stamped-write days. Three funnels, not one. Ingest-lag dots for the two accidental clocks, log scale, a band at 1.1 s and at the long-poll timeout (25 s), empty state: “Lag is not recorded. These dots are the two clocks that happen to differ.” Source-of-capture small multiples for stamped domains, by week, and a second section that lists the not-separable domains as unknown. Hour ribbon of stamped text-pipeline instants beside ingest-log hours. If they disagree, the window is the reason, or the person logs `log:` at the time of the event and `gm` at a different hour. Session strip: blocks by kind, ritual steps when `raw` plus the state machine can recover them.

### Learning

- **Which prompts get used.** Support of `kind` against the catalog. A kind at zero across ninety days of stamped history, where that history exists, is an unused door. Manual follow-through after `info` and `{prefix} commands`, conditional frequency with a Wilson interval. Shortcut yield from `raw` while it survives, against aliases that are defined even when unused. Keyword yield: presets with zero `keywordLogged` days. Prefix discipline = `dh:` matches ÷ (`dh:` matches + captures whose text would have matched a trigger). The second term lives in the 200-window. Slugs that match no current discrete pattern are retired prompts that still have a past.
- **Drop-off.** Which morning step is the cliff. Median turns-to-complete. Modal `resumeStep` among incomplete mornings. Receipt clarify-chain length versus open grocery count that day. Clarify re-ask rate by pending kind. `STOP` versus finish is depth-at-exit, not a failure.
- **Burstiness.** Inter-event times on stamped instants and on ingest turns, separately. Median, 90th percentile, fraction of gaps under 2 minutes versus over 6 hours. Fano factor of hourly counts, once on discrete instants and once on GPS samples. Do not mix them. Session size is bimodal (drive-by versus ritual). Show the two modes. A backlog burst needs `processedAt`. The weak proxy today is many ingest `at` values whose `dh:` or `habit:` cell `updatedAt` values collapse to the same second.
- **Do telegram days look different?** Difference in means versus other days, with a weekday fixed effect. Outcomes the bot does not fully determine: keyword-habit meets split from hand meets; morning `completed` among mornings that exist, by source; day-plan presence by source of the line; sleep estimated versus exact, with the caveat that `sleep:` always writes estimated; Activity span minutes separated from instant counts before any claim of “more tracked.” The count of text-pipeline instants is higher on telegram days by definition. Do not use it as the finding. The person chooses to text. The contrast is “days I reached for the phone look like this.”
- **Language over time.** 14-day rolling rate of error or clarify, and of one-letter or custom shortcuts, inside whatever history exists. A rising error rate on `switch:` or `log:` may be a parser change or a military-clock surprise. Leave room for a human note. If `screen info` never appears and `screen:` never appears, the phone-life door is undiscovered. If the manual appears and the verb does not, the manual did not convert.

Within the log window, the cube is kind × status × hour × mutating. On full history, where the stamp exists: record type × hour × stamp × clock certainty. Useful slices: which commands fail; grocery and `bought` in the afternoon, `gm` in the morning, `gn` at night (if `gm` is not in the morning, the process zone is wrong or the ritual is catch-up); share of `est` / `unknown` / exact on text instants (a high `est` share means the phone is a memory, not a live tap); intake class × hour, with `ate` / `drank` / `took` and `intake food:` as two doors to the same `eventKind`; `switchFrom` × `switchTo` on rows that stored the strings; `eventKind` × date; morning depth × whether that day’s `priorityHabitIds` were met (outside join on the cell, labeled — the hypothesis is those habits’ cells, not a vague good day); receipt chain versus list size; media × caption. Refuse “Telegram location × later mood,” “Telegram cycle × sleep,” and “night-review gratitude × next-day habits” on a chart that claims to be about the bot. Those channels are not identified. The same crosses can live on a Habits or Tracking chart that does not claim a channel.

### Information architecture

One Phone area. BIM named in the header. The first line is always the coverage line: conversation log, last 200 turns; stamped history, as far back as the vault; GPS successes, this sitting only.

| Section | Holds |
| --- | --- |
| Today’s door | Turns today by family, if still in the log. Stamped writes today. Open pending: step name, age since `createdAt`, last `raw`. Last pin versus the latest grocery turn. Hub heartbeat age when the desktop can read it. |
| Conversation | Session strip, three funnels, filters for kind, status, and chat. Unpaired refusals in a side list. This section expires. Say so. |
| What the phone writes | Source-of-capture multiples, stamped calendar, hour ribbon, event-kind ranking for `generatedBy.text`, keyword triggers, morning depth by `source`. The not-separable footnote is part of the design. |
| Language | Kind support versus the catalog. Error and clarify rolling rates. Shortcut and `dh:` discipline. Top raw first-tokens that became `capture`. That list exists only while `raw` is in the 200. It is the backlog of language the parser does not have. |
| Reliability | Accidental lag dots. Latest poll error, and the absence of a history. Silent-loss checklist, qualitative until the poller counts null extracts. Split-brain note. |

Phone may link to a habit cell or a time entry. It does not recompute a grade.

### What Telegram does not store

`processedAt`, download time, OCR time, apply time. Telegram update id and message id on the event. The surface token before expansion. A count of updates that failed extraction. `sendOk` and `pinOk`. Whether an affirmation step advanced by voice. `source: "telegram"` on night reviews, cycle flags, day notes, `habit:` cells, and location or mood paints. Successful GPS audit rows after the process exits. Poll-error history. The audio of a voice note. Parts of an iPhone-notes dump that have not all arrived (a restart drops the process-local map). Anything older than 200 turns, as conversation. Anything older than about 24 hours that Telegram never delivered.

---

## Cross-section combinations

This is the heart of the tab. Each analysis names the question, the join, the metric or chart, what would be learned, and the side that is missing so the join stays partial. Joins use only keys the five reports already say exist.

### Join keys the vault actually has

| Key | Left | Right | What it can mean |
| --- | --- | --- | --- |
| Local date | Any day-keyed record | Any other | The day cube. Weekday and season are derived. |
| Local minute | `startMin`/`endMin`, plan `"HH:mm"`, wellbeing `at` | The other clock on the same date | What occupied a planned minute, or what was true at a logged score. Unknown clocks do not enter. |
| `spanId` | Midnight slices, `work-<startedAt>`, `pen-color-<startedAt>` | The slices and, while the session lives, `trackingEntryIds` | One bout, or one working-on run. |
| Habit `sourceId` | `PlannedAction` with `source: "habit"` | `WeeklyTask.id` and that habit’s cell for the action’s date, or for the week key if the habit is weekly | A block was intended. The cell says whether the habit was met. The drop does not write the cell. |
| Plan `source: "todo"` | `PlannedAction.sourceId` | `Task.id`, including `attributes.headerTracking` | The block and the task are one intention when the ids match. Week-grid drags break the clocks. |
| Plan `source: "free"` | The action | Nothing | Minutes promised. No completion, no habit, no event. |
| `confirmedEventIds` | Lifetime list on the timegrid store | `CalendarEvent.id` | Some event was confirmed into a block at some time. The entry does not carry `eventId`. The list cannot date the confirmation. |
| `estimateOf: { kind: "done", id }` | A hatched `TimeEntry` | The finished item’s id | Place-as-assumed. Confirm clears precision and keeps the stamp. |
| Task `timeLogs[]` / `startedAt` / `actualDuration` | The task | A plan clock on the same task, and only then a tracking minute if a block also exists | Slip is native to the task. Those logs are not tracking occupancy. |
| `trackingLink.tagIds` | Habit cell `trackedValue` / `trackedCompleted` | Tag-minute set, unioned across scopes | The cell’s machine half. |
| `coverageLink` | Stored coverage percent | Activity occupancy on the period | Pace on the open period. |
| `sleepLink` | `sleepCompleted` | `sleptMin` or `wokeMin` on the morning key | Bed is the evening into the next morning. Wake is that morning. |
| `keywordLogged` | The cell | A `dh:` line, and the done-log note if it still says `from text message at` | Phone touched the cell. Not a general channel flag. |
| `generatedBy.kind === "text"` | The time entry | The ingest turn, only while that turn is still in the 200 and `itemIds` or the summary can be matched | Text pipeline, including Simulate until the channel filter is applied. |
| `stampSuffix === "from text"` | Plan append entry | The day or period key, and `createdAt` | The paragraph arrived as a message. |
| `morning.source` | `"telegram"` or `"desktop"` | That day’s review, `priorityHabitIds`, sleep fields copied onto the morning slice | The morning walk’s door. Night has no equivalent. |
| Wellbeing `at` versus `createdAt` | The datapoint | The presence tuple at `at` | The minute the score applies to, and the minute it was written. |
| `attributes.headerTracking` | `"plan"` on a task | Its planned action, its day-plan line by text match, later `timeLogs` | Born in the Now plan writer, which includes agenda drag-create inside that pane. |
| Item-activity `source = "header-tracking"` | Ledger `at` | The task’s `createdAt` and `estimatedDuration` | Later rename or retime. Not the original save. |
| `allNighterSource` | `telegram` \| `desktop` \| `text` | `logExemptions` on daily habits, and the morning date | Channel of the all-nighter flag only. |

Goals and objectives do not join. Cycle encyclopedia text does not join. Willpower physics does not join. `hiddenPenIds`, grid step, and sort mode do not join.

### Plan × Tracking

#### Adherence and slip where both clocks exist

**Question.** When a task was given a clock, and something later recorded when it actually sat, how late was it, and how long did it run?

**Join.** Local date, then minutes. Planned start is `scheduledTime` or the `todo` action’s `startTime` for that `sourceId`. Actual start is the earliest `timeLogs[]` row on that `date` with a `startTime`, else `startedAt` when its local day matches. Duration slip uses `actualDuration` and `estimatedDuration` on the task. A tracking block enters only as a second picture: the minutes the grid holds during that planned window. It is not the actual start unless the block was the thing the time log describes.

**Chart.** The slip histogram and the planned-versus-actual scatter from the Plan report, with a lane under each included day that shows Activity occupancy during the planned window. Estimated starts and `timeRough` use a different mark. The “filled from the planned length” bin is separate, because that residual is zero by construction.

**Learned.** Whether timed tasks run late, run long, or only look punctual because the actual was copied from the plan. The tracking lane shows whether the grid agrees with the time log. Systematic disagreement (a time log at 10:00, Activity empty or painted Rest) is a data-quality finding.

**Partial.** Free blocks have no actual. Events have no actual on the event. Habit blocks do not write a performance clock. `startCertainty` estimated or unknown means the residual is not a precise lateness. Most plan drags never write a placement, so “the plan” is the current clock, not the clock at the time the task was done. Tracking has no `updatedAt`, so a block cannot be dated as “painted when it happened.”

#### Planned blocks against the minute cube

**Question.** For each promised minute, what did Activity, Location, Mood, Company, and the screen scopes actually hold?

**Join.** Local date + minute. Convert plan `"HH:mm"` to minutes. A planned action contributes `[start, end)`. A single-day timed event contributes its timed minutes. A task with `scheduledTime` and a duration contributes that window only when it is not already covered by a `todo` placement, matching the capacity rule, and the chart says so. All-day and multi-day events contribute a banner, not minutes. On the tracking side, each scope contributes the intervals that cover the minute. Overlaps inside a scope stay listed and marked. Instants attach and do not occupy. Missing scopes stay missing.

**Chart.** The day ribbon with three extra lanes: events, planned actions (dash by `free` / `todo` / `habit`), and timed tasks that have no placement. Color on the tracking lanes is the pen. A minute where a plan lane is occupied and Activity is not is white on the life side. A minute where both are occupied is the intersection, reported as minutes, not as a score.

**Learned.** Which intentions sat on top of a painted life, which sat on a gap, and which paintings had no intention on them. Company and location during a planned block, with an untracked bin that will often be the largest. That bin is the result.

**Partial.** Overlap is not identity. A free block on top of Work is a shared clock, not a link. Title equality does not link a free block to a task. An event and a task that describe the same appointment both count unless `taskId` or a checklist joins them. Open-until-midnight tracking tails are asserted, not observed, and will make a late plan look “fully lived” if the tail is not marked. GPS stretches and one-minute default calls are estimated. A plan block stored as 15 minutes because the end snapped through midnight is not an overnight span. The record does not say it crossed midnight.

#### Overcommitment against real occupancy

**Question.** On days the plan promised more than the waking window, what did the tracking day actually contain?

**Join.** Local date. Plan commitment and plan occupancy are native. The waking window is the sleep join Plan already uses: wake minute of the morning that ended that day, bedtime of the evening that started that night, each end allowed to fall back to the 30-night median, span must be positive. Tracking occupancy is the Activity union (and, as a separate series, the union of the four presence scopes). Sleep-tagged and sleep-generated minutes are the painted night, which may disagree with the statement.

**Chart.** The commitment-versus-capacity columns, plus a third column: tracking occupancy of waking minutes. Window unknown: no ratio, commitment still shown. Do not use the 10-pip value. It saturates at 10 for both a ratio of 1.0 and a ratio of 1.4.

**Learned.** Three different “full.” Commitment full means the sum of promises exceeded the window, overlaps counted twice. Plan occupancy full means the union of promises covered the window. Tracking full means the grid’s union covered it. A day can be commitment-full and tracking-empty (promises never lived, or never logged). A day can be tracking-full and commitment-light (a life that was not planned). Stacked minutes explain a modest tracking day that still had a severe commitment ratio.

**Partial.** The window is unknown when either sleep end is missing and the median cannot fill it. Hand-painted sleep and derived sleep can disagree; show both, do not pick a winner. Estimated tracking minutes, especially open-until-midnight tails, inflate “lived” occupancy. Screen Time AFK stays untracked, so a planned work block can sit on a keyboard that was not AFK while Activity is empty. That is the screen-versus-activity table, restricted to the planned window. All-day banners add no commitment minutes and can still cover a day that looks empty in the heat map.

#### Empty plan against an empty life

**Question.** When the clock had no timed intention, was the day untracked, or only unplanned?

**Join.** Local date. Empty plan: commitment minutes 0, no timed events, no planned actions, and, as a separate flag, no day-plan entries and no draft. Empty life: Activity occupancy 0. Instants do not fill it. A third flag: unplaced rail load (untimed day to-dos, deadline-only rows, undone non-exempt daily habits, next actions the rail would show) and their `estimatedDuration` sum where a duration exists.

**Chart.** A four-way count over the period, empty days included: empty plan and empty life; empty plan and painted life; timed plan and empty life; both nonempty. A second split of “empty plan” into unwritten, draft-only, and written-but-untimed. Inbox dates stay out. Header `unplanned` rows stay out of the plan side. They are lived residue.

**Learned.** Whether blank calendars are blank days. A painted day with no plan is a life the calendar did not intend. An empty grid with a full rail is intentions that never received an hour. An empty grid with a submitted day plan is prose without a clock.

**Partial.** “Undone habit on the rail” is recomputed from the habit’s met flag and exemptions. It is not a stored snapshot of what the rail showed that morning. Quarterly habits are not on the rail. `timeEstimateNA` habits cannot be dropped, so they can sit on the rail forever without ever becoming minutes. Day notes and unknown-clock instants can exist on a day the occupancy metric calls empty. Say “no occupied minutes; N events.”

#### Events with no record of what happened

**Question.** Which calendar spans have no lived trace the vault can attach?

**Join.** Event-day. Native proxy: checklist tasks, `completedDate` at or before the event deadline when both exist. Undated confirmation: `confirmedEventIds` contains the event id. Heuristic overlap: tracking occupancy during the event’s timed minutes, or, for a banner, during the days the banner covers. Dangling checklist: `checklist-of` pointing at an id that is no longer in the event store.

**Chart.** A list, not a rate dressed as attendance. Columns: event, span or clock, checklist readiness, whether the id sits in `confirmedEventIds`, minutes of Activity overlap, minutes untracked. Events with an empty checklist and no confirmation and no overlap are the “no what happened” shelf. Multi-day banners are spans, not five successes.

**Learned.** How much of the month is appointments the vault cannot close. Checklist lateness (`completedDate` after the deadline) is a real native number. Overlap with Outside or Transit during a DRIVE-prefixed title is a hint, labeled as a hint.

**Partial.** The event has no done flag. Confirmation ids are not dated and are not on the block, so “confirmed” means “this id was confirmed sometime,” not “this hour was attended.” Overlap is not attendance. Paste zone text in `description` is a label, not a conversion. Demoting an event to all-day (`isAllDay: true`, `isScheduled` still true) removes it from the clock and leaves it on the banner. That is not deletion.

#### The only id joins from a plan-shaped thing into the grid

**Question.** Which tracked blocks already point at a finished item, and which event ids were confirmed without a datable block?

**Join.** `TimeEntry.estimateOf.kind === "done"` plus the item id. Confirm keeps the stamp and clears `precision`, so “assumed” and “confirmed from that item” are both visible. `confirmedEventIds` intersected with current event ids is the undated set. `generatedBy` is a different provenance (`sleep`, `screentime`, `text`) and is not an event link.

**Chart.** Two lists. Assumed blocks that are still hatched. Assumed blocks whose precision was cleared. Event ids on the confirmation list that still exist, and event ids on the list whose event is gone. Do not place the second list on a calendar.

**Learned.** How often place-as-assumed survives as a hatch, and how often it was confirmed. The confirmation list’s size is a lifetime count. It is not a period rate.

**Partial.** `estimateOf.kind === "import"` has no writer. Do not build an import cohort. The confirmation list cannot be drawn as blocks. A deleted event can leave checklist tasks behind; those tasks remain tasks.

#### Screen, calls, and GPS during a planned span

**Question.** During a timed plan, what did the other instruments say?

**Join.** Date + minute, restricted to planned minutes from the cube above. Mac screen rows carry `generatedBy.screentime`. iPhone screen rows are estimated and unstamped. Calls and texts are their own scopes. GPS is `notes === "gps"`.

**Chart.** The screen-category versus Activity table, computed only on planned minutes, plus a row for “Activity untracked, screen occupied” and “Activity occupied, AFK / no screen row.” Call minutes and text counts whose instants fall inside the planned window, labeled estimated when they are the one-minute default.

**Learned.** Whether a planned work block was a keyboard, a phone call, a place, or a gap. Disagreement is the useful case.

**Partial.** Observed-only mode blanks Mac Screen Time. Pieces under `minDurationSec` never existed. iPhone and Mac trees are not one pen id; union minutes if you combine them. GPS coordinates are not on the row, so this is not a map. A 15-minute GPS block may be one sample. A venue pin is not presence.

### Plan × Habits

#### Habit blocks against the cell

**Question.** On days a habit was given a dashed block, was the cell met, and how full was it?

**Join.** `PlannedAction.source === "habit"` and `sourceId` = `WeeklyTask.id`, on the action’s `date`. For a daily habit, the cell is `weeklyData[date][habitId]`. For a weekly habit, the cell is the Monday–Sunday key that contains that date, and the block is off the day rail (the day rail lists daily habits only). Monthly and quarterly habits are not a day-rail population; a day block for one of them is still a placement. Reader B says met. Reader A says the cell ratio. Exempt cells are neither a miss nor a hit.

**Chart.** A calendar per habit: placement dot, cell ratio, exempt hatch, named-miss mark. Beside it, the native cumulative count of placement days, and the rate only once the denominator is computed: days since `createdAt` (or since first cell for a seed id), frequency daily, not exempt. The Plan report’s rule stands: without that denominator the honest number is “days this habit was given a block.”

**Learned.** Whether dropping a habit on the clock has anything to do with the lamp. A full calendar of blocks can sit on an empty log. A met week can have no blocks, because the rail lists the habit until it is met and a drop is optional. Those are different metrics. Placement reliability is not habit reliability.

**Partial.** The drop does not write a completion. Deleting the habit strips the cells and can leave an orphan action. Deleting the action leaves the cell. There is no birth time on the action, so “planned before it was done” is not identified. `updatedAt` on the cell is the last edit, not the minute the habit was performed. One live `scheduledDate` cannot represent two placement days; both actions still add minutes on their own dates.

#### Priority-weighted habits that never receive a block

**Question.** Which habits the priority math is pointing at have no timed block in the week?

**Join.** For each daily habit and each Monday week: effective weight that week (auto empty-periods + pin, mute clearing the auto term) and the count of `habit` actions whose `sourceId` matches and whose `date` falls in the week. Also recompute whether the habit would have been on the day rail each elapsed day: daily, not exempt, Reader B unmet. That rail membership is a function of stored cells and exemptions. It is not a stored list. Label it recomputed.

**Chart.** A table for the selected week: habit, weight, pin versus neglect, rail-days, placement count, placement minutes, met days, cell ratio. Sort by weight descending, placements ascending.

**Learned.** Neglect that never receives an hour, versus neglect that is scheduled and still empty, versus a pin that is fully met with no block (the star did not need a chip). A muted habit has weight 0 and can still be on the rail. A pinned habit that is done every day has weight 1 and auto weight 0. Color those differently, as the Habits report requires.

**Partial.** Historical rail membership depends on the current `goal` and the current trust list, because met is recomputed. A retarget rewrites who “would have been on the rail.” Say that on the table. The star’s fade (100 down to 0 over 10 days) is a different number from the weight. Cross fade-bucket with met rate inside this table only as a column, not as proof the star caused the block.

#### Scheduled minutes against the grade

**Question.** Does a week with more habit-block minutes have a higher grade, and which grade?

**Join.** Week key. Sum of durations of `habit` actions whose dates fall in the week. Beside it, three series that stay apart: raw week mean, curved week grade (tolerance visible), blended week grade only when `gradeUsePriority` is on. Perfect output the same way, its own tolerance. Stone count (Reader B, daily habits, non-exempt). Vacant days listed, not drawn as zeros.

**Chart.** A scatter per finished week: x = habit-block minutes, y = raw week mean, point size = stone count. A small table under the point: curved minus raw, blend contribution, rail gap (perfect output minus week grade). Do not put the blended number on the axis alone.

**Learned.** Whether scheduled habit time tracks the day-average, the habit-average, or the stone plate. A week can have many stones and a low grade (a few habits met, the denominator full of zeros) or a high grade and few stones (partial credit). Block minutes can be high while both are low, if the blocks were the 30-minute default on habits that stayed unmet. That is a planning habit, not a performance.

**Partial.** Block length is the flat estimate or 30, not observed duration. `minutesPerUnit` is not the block length. The grade divides by the current `goal`. Tolerance and window changes move the shown grade without the blocks changing. Echo habits (floor, sum, daily-completion average) sit in the grade and do not have a behavior of their own; offer the scatter with those parents removed, labeled as a sensitivity. Weekly and monthly habit cells are not stones. A season of perfect monthly habits can sit next to an empty plate.

#### Off-rail drops, exemptions, and blocks that outlive the rail

**Question.** Which habit blocks exist on days the rail would not have offered that habit?

**Join.** Action date and `sourceId`. Off-rail cases the reports already name: a weekly, monthly, or quarterly habit dropped on a calendar day; a daily habit dropped on a day it is exempt (`auto`, `waved`, or `logged`); a daily habit that is already met and still has a block, because completing the habit leaves the rail and does not delete the action. `timeEstimateNA` never produces a block. Month-grid drops forced to 09:00 are marked default-09:00.

**Chart.** A count of blocks in each of those classes, and a list. For logged exemptions, the counterfactual from the Habits report sits beside it: the week grade if those habits had stayed required. The difference is the all-nighter’s effect on the denominator, not a claim the habit was done.

**Learned.** How often the calendar and the rail disagree. A block on an exempt day is a plan that the grade will ignore. A block on an already-met day is residue, not a second success. A weekly habit on a Tuesday is a real intention the day rail would not have listed.

**Partial.** Exemption rules for coverage, sleep, and log blocks depend on effective helpers. `undefined` can still mean a preset. An explicit require beats a log block. You cannot see the rail as it looked before a later cell edit, because `updatedAt` replaced the value.

#### Three clocks for one habit-day

**Question.** What did the habit cost, what did the plan assume, and what did the grid paint?

**Join.** On a date where a `habit` action exists: the action’s duration; the habit’s `timeEstimate` (flat minutes, or `minutesPerUnit`, or `timeEstimateNA`); `trackedValue` and the tag-minute set when `trackingLink` is on; the derived Done-row duration from the order in the Habits report (observed unit, else painted minutes plus top-up, else amount × rate, else flat minutes, else none). `precision: "definite"` versus estimated on that derived duration.

**Chart.** Three bars when all three exist: assumed, planned block, painted tag minutes. A fourth tick for the Done-row duration when a logged action exists. Days with only a block and no link show the block and the estimate, and an empty painted bar labeled “no tag link,” not zero minutes of life.

**Learned.** Whether the chip, the estimate, and the paint are the same length. A 90-minute estimate and a 30-minute default block are not the same adherence even when both days are met. TEXT and climb habits are not tag-link targets, so the painted bar stays empty for them on purpose.

**Partial.** Secondary pens and cross-scope tag unions can change the painted number relative to a single Activity pen. The Done row is a task, and its duration is derived. It can diverge from all three. No clock on the cell means you still do not know when the lamp was checked.

### Habits × Tracking

#### Tag minutes against the cell

**Question.** When a habit reads tracking tags, do the minutes and the cell agree, and which pipe won?

**Join.** `trackingLink.tagIds` to the tag-minute set for that local date (or for each day of a weekly or monthly period), unioned across scopes so the same minute is not double-counted. Cell fields: `value`, `manualValue`, `trackedValue`, `trackedCompleted`, `handCompleted`, `completed`, mode `add` \| `max` \| `replace`. Trust winner recomputed. Grades still divide by `WeeklyTask.goal`, not by any `goal` snapshot on the cell.

**Chart.** For one habit, a strip of days: tag minutes, threshold, manual value, tracked value, the value the grade used, and the winner. Dual-contribution days (`manualValue > 0` and `trackedValue > 0`) marked. Disagreement days (display goal reached, trust unmet) counted. Silent-machine days (met, winner not manual, hand flag absent) counted.

**Learned.** How much of a “perfect” habit is painted time. A week that is 90% `tags` or `coverage` is a different achievement from a week of `manual`. Source substitution across weeks is a measurement change. Flag it before describing a change in effort. Overshoot survives in `value` and in the tag minutes, and disappears from the capped percent. Publish both.

**Partial.** TEXT and climb are not tag-link targets, and sync will not open an empty cell when the tracker has nothing to say. A missing cell is not a stored zero, yet the day grade may still count it as 0. A threshold that is missing or ≤ 0 means any positive time checks a Yes/No. Hours are minutes/60, rounded to 2 decimals. The current `goal` rewrites history, so a chart of “minutes versus percent” must say the denominator is today’s goal. Block-only tags and pen tags both enter `effectiveTagIds`. Say which definition the link uses, and keep the always-versus-this-block split visible.

#### Grade days against mood, company, location, and sleep

**Question.** On days the raw day percent is high or low, what was the body of the day, and what was the night?

**Join.** Local date. Habit side: raw day %, curved day %, blended day % only as its own series, vacant flag, good-day flag, named-miss count. Tracking side: Activity pen shares at Category depth, coverage, entropy, company minutes (Alone, Together, In conversation, and company-untracked), location minutes (and location-untracked), mood-mark means with `n` of set values only, tone counts. Sleep: the morning date’s duration, midpoint, bedtime, wake, and whether `updatedAt` is more than a day later. When `sleptMin < 0`, also show the bedtime’s calendar date if a chart is about the evening. Phase only when the cycle latch is open, marked days by default, estimates hatched.

**Chart.** Small multiples of the hour profile split by a stated grade band (for example raw day % ≥ threshold versus raw day % > 0 and below it, vacant days excluded from both). Mood dots, not a blended radar. Sleep timeline colored by the next day’s raw percent only when the join is the morning date, captioned. A table of mean tension, energy, and enjoyment by band, each with `n`. Suppress a band with fewer than three days.

**Learned.** Whether good-grade days are a different shape (a work pen, Together, a midpoint near the person’s median) or the same shape with a fuller lamp. A large rail gap with a calm mood and a full Work tag is “a few habits carried the paint.” A low grade with high coverage is a logged day that did not meet habits. Those are different stories, and the chart should not collapse them into “a bad day.”

**Partial.** Mood marks are sparse. A missing mark is not 0, and a missing mood scope is not Meh. Company-untracked will often dominate. Sleep statement and `tag-sleep` paint can disagree. All-nighters break sleep streaks and can waive habits, which raises the grade by shrinking the denominator. Show the counterfactual. Estimated phase must not be read as a marked luteal effect. The grade’s empty-as-zero rule means a day with one logged habit and many blanks looks low even if that one habit was met. Offer the sensitivity that divides only by habits with data, labeled, and keep it off the headline.

#### Willpower and perfect output against the shape of the day

**Question.** What does the tracking day look like when the plate is full of stones, when perfect output is high, and when the week grade is high?

**Join.** Week key. Stones and stone share (Reader B). Perfect output and week grade, raw and curved, unblended, rail gap explicit. Tracking: mean coverage, mean entropy, top-pen share, and the median ribbon of Activity at Category depth, over the week’s non-vacant days. Echo-source share of stones: if the trust winner is `dailyFloor`, `habitValue`, or `dailyCompletionAverage`, the stone is reflecting other habits.

**Chart.** Scatter, stones on x, raw week grade on y, from the Habits report, with the week’s median tracking ribbon as the drill. A second scatter uses perfect output. Color a week when more than half its stones are echo sources.

**Learned.** The partial-credit gap in the presence of a real day shape. High stones and a low-entropy Work ribbon is a narrow life that met its lamps. High week grade, few stones, high entropy is a day of partials spread across many pens. High stones that are mostly echoes are not a broad week of direct behavior. Say that in the caption.

**Partial.** Stones ignore weekly, monthly, and season habits. The jewel inverts on any hit; do not use the invert. Physics is not a covariate. A coverage-met stone means the day was painted, which will correlate with coverage by construction. Report that correlation as the definition of the source, not as a discovery. Deleted habits take their stones with them. A cached grade that is not recomputed from the live store will disagree with the tubes.

#### Echo sources and the tracking pipes

**Question.** Which habit cells are a second reading of tracking, of sleep, of a list, or of other habits?

**Join.** Trust winner on the cell. `tags` and `coverage` echo tracking. `sleep` echoes the sleep log. `list` and `listSent` echo lists. `dailyFloor`, `habitValue`, and `dailyCompletionAverage` echo other habits. `keywords` echoes a phone line. `manual` is the person’s opinion. `taggedTasks` echoes Done rows, one per tagged task, not minutes.

**Chart.** The source stack, plus a weekly line of Activity coverage beside the coverage habit’s stored percent (the grade uses the real percent; the sheet prints that same percent over the target). List grace lift as `listSentPercent` minus the raw sent ratio. Floor slack: how many daily habits were at 0 when a floor habit was met, versus `allowAtZero`.

**Learned.** When the habit system is mostly a mirror. Clustering those parents with their children double-counts. Default them out of habit clustering and out of “top habits,” and show them here. A coverage threshold of 75 with occupancy stuck at 60 is a hard line. A threshold of 75 with occupancy at 95 is an easy one.

**Partial.** `completionSources: []` trusts nothing. Absent sources on old rows are derived from the links. Preset `undefined` versus `null` changes the effective link. A hand-owned cell keeps `habitSumValue` beside a replaced `value`. The difference is the person overriding the sum. Pace (`loggedShareOfElapsed`) exists on the open period only.

#### Sleep-link habits against the night and the paint

**Question.** The habit says the clock was met. Does the night statement agree, and did the grid paint sleep on those minutes?

**Join.** `sleepLink.end` `bed` \| `wake` and `beforeMinutes`, against `sleptMin` or `wokeMin` on the morning key. Bedtime for the habit is the evening into the next morning. Also the three layers from Tracking: the statement (clocks, precision, `updatedAt`, all-nighter), the derived `generatedBy.sleep` blocks, and any other paint on those minutes, including hand-painted `tag-sleep`.

**Chart.** The sleep timeline with the habit’s deadline as a vertical line (`beforeMinutes`). Met and unmet ticks. All-nighters as marks. A disagreement count: statement met, paint missing; paint present, statement unmet; statement and paint on different clocks.

**Learned.** How often the lamp is a reading of the sleep log, and how often the log and the grid diverge. Estimated ends stay estimated. A rejected span (> 20 h or ≤ 0) is not an unmet zero. It is a contradiction.

**Partial.** `allNighterSource` is the channel of the flag only. Bed and wake from a telegram `sleep:` or from `gm` do not set it. Sleep `source` (`logged` / `tracked` / `mixed`) is not a channel. Name presets for bedtime-and-11, wake-and-9, and document-and-dream apply while `logExemptions` is unset. An explicit require beats a log exemption, so the habit can stay required on an all-nighter. Show that case.

#### Coverage habits against occupancy

**Question.** Does the stored coverage percent match the Activity union, and is the open period on pace?

**Join.** The coverage habit’s period key to Activity occupancy ÷ the period’s minutes. On the current period, pace = occupancy ÷ the fraction already elapsed. Threshold default 75. Stored percent is uncapped by the threshold.

**Chart.** Stored percent, recomputed occupancy percent, threshold, and pace, for each open and recent period. A mismatch is a quality row, not a second grade.

**Learned.** Whether the habit is tracking the grid. Pace above 100 means the lived fraction is painted more densely than the full-period bar. That forecasts occupancy if the density holds. It does not forecast an unrelated Yes/No.

**Partial.** Overlapping intervals must be unioned or the recomputed percent will exceed the stored one for a reason that is not a bug. Open-until-midnight tails inflate both. Estimated Screen Time is a different scope. Coverage is Activity paint, not “hours lived” summed across scopes.

#### Intake, company, and the minutes a tag was on

**Question.** When the Exercise tag (or any linked tag) is on, who is there, where is it, and do intakes cluster on missed days?

**Join.** Minute set of the tag, then the Location pen and Company pen covering those minutes, untracked bins included. Separately, day grain: classed intake counts and drug-intake presence on miss days versus met days for one habit. Unknown-clock instants count in the day total only if the chart is not an hour chart. They never sit at midnight on a clock.

**Chart.** “Exercise by location” as a bar with an untracked bin. Intake clock beside met versus missed, with `n`. Association rules from the Tracking report are the day-scale version, minimum 8 days containing the antecedent. The minute join is a different claim and must not be slid under a day rule.

**Learned.** Whether a habit’s painted minutes are alone at home or together outside, and whether a miss day is also an intake day. The second is a day rule. It is not a claim about the minute of the intake unless the minute join shows it.

**Partial.** Counts and instants diverge when a count is deleted or a keyword did not paint. Secondary pens take the full block, so co-assignment is overlap. Pen links may have filled a blank company minute. That companion is a real row, and it is also an implication, not a fresh assertion. GPS samples are not visit durations without the stretch caveat.

### Now × Tracking

Now’s presence lanes **are** tracking rows. The combined tab should not build a second Activity chart and call it Now. This section says what Now adds, and which rhythms stay impossible.

#### What Now adds to a tracking row

**Question.** Which features of the vault are Now’s, once the shared `TimeEntry` is set aside?

**What is added.**

| Addition | Where it lives | What it supports |
| --- | --- | --- |
| Wellbeing lag | `MetricDatapoint.at` and `createdAt` | Timeliness of a 0–100 score. Not a mood mark. Not estimate accuracy. |
| Header-plan provenance | `Task.attributes.headerTracking = "plan"` | A task born in the Now plan writer. Not a presence stamp. |
| Estimate flags | `precision`, `clockCertainty` on sequence steps; inherited when a now-stamp continues an estimated neighbor; `startCertainty` on every step of a header plan | A share of occupied minutes that are estimated, and a calibration only where a later actual survived on the task. |
| Working-on span | `spanId` `work-<startedAt>` or `pen-color-<startedAt>` | A recoverable start, overlap with the other lanes, comparison to the recomputed “usual” median. |
| Seam as a beat | `splitAfter` between same-pen neighbors | A re-assertion that kept both blocks. Also any scissors cut. |
| Ledger of later plan edits | Item activity `source = "header-tracking"` | Rename and retime after save. Not the save itself. |

**What is not added.** A `source: "now"` on the block. A click time. A dialog-open count. The previous pen after an `open` overwrite. Proof that an exact thought came from the Now composer rather than the Home log. Mood ranks, unless a reading was already on the neighbor and got copied. Paint through midnight. Now refuses the future. Ingest `currently` / `at:` / `mood:` / `start:` paint through the end of the day and will look “current” until something erases the tail.

**Chart.** The four-lane timeline is the Tracking ribbon restricted to the four presence scopes, plus the wellbeing points and the work-span ticks. The footnote from the Now report stays: a hard stop at “now” is the writer refusing to paint the future, not the user knowing the state would end.

**Learned.** The joint tuple, the seam rate, and the estimate share, on top of occupancy Tracking already counts.

**Partial.** The Time Grid can produce the same shapes. The behavioral fingerprint of a now-stamp (it erases later minutes today, and an open stamp begins at the previous block’s `endMin`) is not a reliable filter. Pen links can fill a blank minute in another scope as a side effect. Those companions look like lane edits. A footnote is the honest detection. After-the-fact separation is not reliable without a source flag.

#### Wellbeing lag beside the cube

**Question.** At the minute a score names, what was painted, and how long after that minute was the score written?

**Join.** `at` parsed as local date + minute, to the presence frame. Keep `createdAt` visible. Missing metric keys stay missing. Do not forward-fill across a gap longer than 6 hours. Mood marks on a covering mood block stay in their own column, 1–10, so a joy of 70 is not averaged with an energy of 7.

**Chart.** One card per datapoint: the five scores, `context`, `details`, the four names or “unlogged,” and `lag_min`. Aggregate mean of a key by mood word, company, or location only when at least 15 points share that lane value, with `n` per key. Median lag by lane value. A lag histogram titled timeliness.

**Learned.** Which painted situations have scores at all. Whether high suffering is written later than high joy, as a comparison of medians. Whether some states are back-logged and others are logged in the same minute.

**Partial.** The logger door is not stored, so this is not “scores logged from Now.” Sparse points do not support a regression of mood-switch on joy. A negative lag is clock disagreement or an `at` edited forward. Flag days where lag is largely negative, or where a `spanId` timestamp’s minute disagrees with the block’s `startMin` by more than one minute, and exclude those days from lag percentiles with a visible count. A datapoint with only context is a note.

#### Working-on spans against the lanes

**Question.** While an operation clock was painting, what did location, company, and mood hold, and did the Activity pen stay the session pen?

**Join.** Slices that share `spanId` `work-<startedAt>`. Activity pen on those minutes. Location and company as a duration breakdown. Mood word if a block covers the span. Elapsed active minutes = sum of slice lengths. Compare to the median of **earlier** logs of that title or type, recomputed as of the minute before `startedAt`. Pause fields are gone after stop.

**Chart.** The span drawn on the four-lane timeline. A mismatch between session pen and current Activity pen called out as a later edit. No pause chart for finished sessions. Pen-color spans included as hints, not as Now controls, and they do not write a Done row.

**Learned.** Where work sits, and whether “usually ~N” was honest for this run. A session that wraps midnight is one bout via `spanId`, not two short days.

**Partial.** The Now strip is one door onto the Operations clock. Desk and ingest can start sessions too. `trackingEntryIds` go stale when a merge replaces the row. Trust `spanId` until a later edit clears it. If stop wrote `timeLogs` and the operation had no pen, there may be duration on the operation and no presence span. Those logs are not a lane.

#### Estimate flags and sequence candidates

**Question.** When minutes are marked estimated, what else is true, and which runs look like a sequence that was entered at once?

**Join.** Estimated if `precision` or `clockCertainty` says so. Other lanes during that window. Candidate sequence: adjacent estimated steps, same scope, same day, no gap. Label them. Do not compute transition probabilities from candidates and from live stamps in one matrix.

**Chart.** Estimate-minute share by scope. A table of surviving estimated intervals with the other lane names. A separate list of candidate sequences.

**Learned.** Whether estimated stretches are mostly one place, or the stretches with no company stamp. That is when the estimate flag gets used. It is not whether the clock was right.

**Partial.** Extension inherits the flag, so a person can believe they logged an exact now while the block stays estimated. Screen Time, phone ingest, GPS, and place-as-assumed are also estimated, and they are not Now sequences. Filter those `generatedBy` kinds and `estimateOf` out of the Now estimate story, or the share is the whole vault’s doubt.

#### Check-in rhythm that is not identifiable

**Question.** How often does the person consult Now, and how long between assertions?

**Answer.** The dialog open, the pane, the lane selection, the abandoned draft, and the click time are not stored. The following proxies exist and must keep their confounds in the caption.

| Proxy | Confound |
| --- | --- |
| Presence interval ends and the next minute is empty or different, end not midnight | Time Grid and stopping a work session |
| Inter-arrival of metric `createdAt`, day-note `createdAt`, plan `createdAt`, header-tracking ledger `at` | Every door that writes those logs |
| `startedAt` parsed from `work-` or `pen-color-` span ids | Operations and the pen-color control |
| Inter-arrival of thought and event instants | Home log and ingest |

Burstiness of those proxies is a shape statistic for the stamps you have. It is not a session rhythm of the dialog. Counting clicks is impossible: an Update that lengthens one block leaves no seam, and a merge folds two clicks into one dwell. Counting dwells under-counts confirmations.

**Also unidentified until an assertion log exists.** The pen that was overwritten. Whether an estimated window was later replaced by an exact one (the estimate is gone, so it cannot be scored). Origin `"now"` versus `"grid"` versus `"desk"` versus `"ingest"`. Calibration of the estimate flag against a retained previous interval.

The chart for this subsection is the proxy histogram with the confound in the title, and a single sentence: real check-ins are not in the vault. The appendix says what row would make them real.

### Now × Plan

#### Header-plan steps inside the day’s plan

**Question.** Of the timed intentions on a day, which were born in the Now plan writer, and how do they sit among events, free blocks, and ordinary tasks?

**Join.** `attributes.headerTracking === "plan"` on a task, its `PlannedAction` via `source: "todo"` and `sourceId`, and the day-plan line whose text matches the step titles and whose `createdAt` is the same minute as the tasks’ shared `createdAt`. Ordinary plan submits omit `stampSuffix`, so the suffix cannot separate them. Agenda drag-create inside the pane uses the same writer, with title `"Planned action"` and `startCertainty` exact. Count those as this writer, and split them from titled sequences in the caption. The Plan pane’s `scheduledDate` can differ from the lanes’ today. Join on the task’s `scheduledDate`, not on “whatever day the pane was browsing” inferred from the UI. The UI day is not stored.

**Chart.** The Plan day ribbon, header-plan steps in their own dash, other `todo` actions, free actions, events, and habit actions. A column: share of timed plan minutes whose task carries the attribute, share that are the placeholder title, share with `startCertainty: "estimated"`. Chained clocks: step 0 at the chosen start, step k at the previous end. Collisions with events are the Plan overlap table, restricted to these steps.

**Learned.** Whether the short plan is the day’s clock or a small chain inside a larger calendar. Whether “right now” steps (exact, start at the current minute) land on covered Activity minutes. Empty Activity at `scheduledTime` is missing paint, not a verdict that the step was skipped.

**Partial.** The day-plan prose is the same text the composer appended. Show it as the note beside the chain. Do not parse it into fake states. Other agenda edits in the pane are ordinary Plan and do not carry the attribute. Creation does not write the item-activity ledger, so the original save’s only clocks are `Task.createdAt` and the plan entry’s `createdAt`. The action has no `createdAt`.

#### Estimate calibration only where an actual exists

**Question.** When a header-plan length or start was marked estimated, and something later wrote an actual, how far off was the plan?

**Join.** Tasks with `headerTracking = "plan"` that have `estimatedDuration` and `actualDuration`, or a `timeLogs[]` row with a start. `duration_error` is `derivedDurationGap`: round(actual) − round(planned). `start_error_min` is the first time-log start minus `scheduledTime`. Include a row in the estimated panel only when `startCertainty` or `durationCertainty` says estimated. Exact plans get the other panel, so an exact plan is not asked to prove the estimate flag. Exclude time logs whose basis is “filled from the planned length,” or bin them as assumed-the-plan. Work-session `timeLogs` belong to an operation. Compare them to a header-plan task only when the item is the same, which it usually is not.

**Chart.** Reliability diagram. X is planned minutes or planned start hour. Y is mean actual or mean start error. Point size is the count in the bin. Reference line y = x. Bins 15, 30, 45, 60, 90+. Subtitle: the actual was written by whichever surface completed the item. The Now pane does not write it.

**Learned.** Bias (positive means the plan ran long) and noise. Flag honesty: if estimated starts are not wider than exact starts, the checkbox is not carrying information. That comparison matters more than the clock error, because the product’s promise is that an estimate is not shown as a fact.

**Partial.** Tasks that were never completed have no error. Do not impute one. Followed-with-blank-length exists as a writer and is not called by the dialog, so a stream of “assumed the plan” rows should not be expected from Now. If `estimates[]` on a task shows that basis anyway, it came from somewhere else. Say so. Replacing an estimated **presence** block with an exact one destroys the estimate. That pair is not on this chart. This chart is only the task’s plan against the task’s actual.

#### Ledger edits against the original chain

**Question.** After a Now plan is saved, how soon is it renamed or retimed, and do the edits move toward a later actual or away from it?

**Join.** `Task.createdAt` to the first item-activity row with `source = "header-tracking"` and `itemId` = the task. `changes[]` carries `field`, `from`, `to`. Later rows are further edits. Cap 200 per item; older lines drop. Compare a duration edit’s `to` with the original `estimatedDuration` and, if an actual exists, with `actualDuration`.

**Chart.** Ticks on the header-plan chain at the ledger `at`, which is a real timestamp. A small table: latency from create to first edit, share of steps edited, share of duration edits that moved closer to a later actual.

**Learned.** Whether the short plan is revised before it is lived. The original save is not in the ledger. A task with no ledger row was not necessarily left untouched in the first second; it was not edited through this writer afterward.

**Partial.** The ledger does not record presence, mood, or dialog use. Edits from other sources are a different `source` and should not be folded into this count. A retime changes `scheduledTime` and, when the writer updates it, the planned action. If a week-grid drag moved the action and not the task, the divergence histogram from the Plan report is the right companion, labeled disagreement inside the plan.

#### The plan pane’s day versus the lanes’ day

**Question.** When the short plan names a day, do the presence lanes of that same date say anything at the planned minute?

**Join.** Only on `scheduledDate` + `scheduledTime`, and only when a non-instant presence block covers that minute. Missing lanes stay missing. Do not attach today’s Current-moment lanes to a plan whose `scheduledDate` is tomorrow. Do not attach them to a plan that was browsed on another day inside ephemeral UI state.

**Chart.** For each header-plan step whose date is in the past or is today: planned window, Activity pen if covered, “activity untracked” if not, estimate flag, and whether a ledger edit moved the window before the first time log.

**Learned.** The descriptive intersection the Now report asks for. Overlap minutes are not a virtue score.

**Partial.** Untracked is not “skipped.” Skipped would be `status: "missed"` from a writer the pane does not call. Unplanned inserts (`headerTracking: "unplanned"`) are completed and not scheduled. If any exist, list them as lived residue and do not put them on the plan ribbon. Do not forecast a stream of them from this door.

### Telegram × stamped records

Channel comparisons use the provenance list in the Telegram section. Unstamped writes do not get a phone-versus-desk split.

#### Provenance share on stamped records

**Question.** Of the records that can remember a door, what share remembers the phone?

**Join.** Per domain, the high-confidence stamp versus the residue the Telegram report names as in-app. Text instants: `generatedBy.kind === "text"` versus instants with no `generatedBy` or with `sleep` / `screentime`. Filter Simulate when the ingest row is still in the 200; older text stamps may include Simulate, and the chart says so. Activity spans: text-pipeline minutes versus hand-painted minutes, and span **starts** as a second rate, because a `currently` span runs to midnight. Keyword habits: `keywordLogged` versus cells with hand fields and no keyword flag, and versus `trackedValue` from a link. A cell can be both; count the flag as “phone touched” and a much later `updatedAt` as “edited after.” Mornings: `morning.source`. Start rituals: `start.source`. Plan lines: `stampSuffix`. Needed items: notes contain `sent from text`. Morning to-dos: notes contain `logged from text`. All-nighters: `allNighterSource`, the flag only.

**Chart.** Small multiples, stacked phone-stamped versus not, by week. `C_d` only on these domains. Sample size on every bar.

**Learned.** What this person bothers to log from the phone, on the records that can say so. A rising keyword share and a flat hand share is a channel change, cousin to the Habits measurement audit.

**Partial.** Notes phrases are editable, so a cleaned note loses the stamp and becomes residue. `generatedBy.text` on a span can be replaced only by another text generator for that kind and day; hand paint is not eaten, but a later edit of the same row has no `updatedAt` to show the edit. iPhone scopes and sleep estimated-ends are medium and weak. Keep them out of this high-confidence stack. Folder **From phone** is weak and stays out.

#### Telegram days versus other days

**Question.** On days that carry a high-confidence stamp, how do the stamped domains look compared with other days?

**Join.** The telegram-day definition: text-pipeline entry, `keywordLogged` cell, from-text plan line, telegram morning, telegram all-nighter, or a needed item or morning to-do created that date with the notes phrase. Outcomes, each with the caveat from the Telegram report:

| Outcome | Comparison | Caveat |
| --- | --- | --- |
| Keyword-habit meets | Split keyword meets from hand meets, among habits that have a `dh:` trigger | The phone can add cells the desk skips. |
| Morning `completed` and depth | Telegram mornings versus desktop mornings | Do not compare to days with no morning. That credits the bot for the ritual existing. |
| Day plan present | By `stampSuffix` | Same: compare sources of the line. |
| Sleep estimated versus exact | Share of nights | `sleep:` always writes estimated. A telegram day can inherit that from one phrase. All-nighter source is the only strong sleep stamp. |
| Activity minutes | Span minutes and instant counts, separate | `currently` inflates span minutes through midnight. |

Weekday fixed effect. Difference in means. Descriptive.

**Chart.** A small table of those differences with `n` days on each side. The command calendar’s stamped layer is the membership. Instant counts are shown as the definition of many telegram days, not as the result.

**Learned.** Whether phone-touched days are also fuller mornings, fuller keyword habits, or simply days with a `log:` instant and an otherwise ordinary grade. The grade, the coverage, and the plan commitment can sit beside this table as context. They are not themselves stamped, so a higher grade on telegram days is “days I texted looked like this,” not “the bot raised the grade.”

**Partial.** Grocery completions and Inbox creates are outside joins and only inside the 200-window. Leave them out of the full-history contrast. Night reviews cannot be split. A day can be a telegram day because of one keyword and have no morning. Do not describe the set as “days I did the ritual.”

#### Text-pipeline instants on the minute cube

**Question.** When a text-pipeline instant lands, what do the other scopes hold, and was the clock a live tap or a memory?

**Join.** `generatedBy.kind === "text"` on date + `startMin`. Attach the presence tuple. `clockCertainty` `estimated`, `unknown`, or omitted (exact). Trailing `loc:` is a second Location instant at the same minute. Intake class and `eventKind` slug are the grouping keys. `switchFrom` / `switchTo` are the string join to the following bout, same rule as Tracking.

**Chart.** Hour histogram of these instants, unknown clocks omitted. A stack of exact / estimated / unknown. The hour ribbon beside ingest-log hours, so a disagreement between send-time and the life-record clock is visible. Cards: phrase by location and by company, unlogged bins included.

**Learned.** Whether the phone is used as a live tap (exact clocks, clustered with a painted place) or as a memory (high `est` share). Whether thoughts from the pipeline sit on a mood block. That last cut cannot claim the thought came from the Now composer. Both doors write Text log instants. The text stamp is what separates the pipeline from a grid brush.

**Partial.** Simulate shares the stamp until the 200-log filter applies. Unknown clocks must not appear at 00:00. Military parse (`6:37` as 06:37) can pile “evening” titles in the morning. Offer that only as a quality hint when titles say night and `startMin` is morning. Edits re-apply as a second instant at the original send time. Two rows with equal timestamps and equal titles are a possible re-apply, not two intentions.

#### Keyword cells beside tag minutes and the grade

**Question.** When a keyword line met a habit, did the tag minutes agree, and what did that do to the day’s raw percent?

**Join.** Cell with `keywordLogged` on a local date, to the habit’s `trackingLink` minute set if the link exists, and to the day’s raw, curved, and blended percents as three numbers. `keywordValue` is the quantity added or the score set. Done-log notes may still contain `from text message at`. Do not parse that phrase into a minute series.

**Chart.** For each trigger: days fired, quantity or score, share of those days that also have tag minutes above the habit’s threshold, share later edited (`updatedAt` more than a day after the period, or after the ingest `at` when the turn is still in the window). The day’s grade sits as context, raw beside curved.

**Learned.** Whether phone keywords are redundant with paint or are the only evidence the cell has. A keyword met with no tag minutes is a real phone completion the grid did not see. A keyword flag with a hand value that replaced it is an edit after. Prefix discipline (captures that should have been `dh:`) stays in the Phone language section. It is a 200-window metric.

**Partial.** `habit:` without `dh:` sets no flag. Those cells are not in this chart. Later edits leave the flag set, so “phone touched” can outlive the number the phone wrote. TEXT habits store text, not a quantity. Climb habits move the base. A keyword on a climb is intensity in the log, and the percent can rise because the bar moved down. Show the staircase.

#### From-text plan lines beside the clock and the prose

**Question.** When a plan paragraph is stamped `from text`, what else is on that period’s clock, and how far ahead was it written?

**Join.** Append entry with `stampSuffix === "from text"`, period key, `createdAt` for writing lead. The day’s commitment, occupancy, habit-block minutes, and whether a telegram morning has `dayPlanLogged`. Module lines (`• title [module]`) are a different mark and are not given this suffix by the phone. Now’s header-plan line omits the suffix. Do not call it from-text.

**Chart.** Writing-lead strip, from-text versus other submits, by period type (day, week, month, season). For day plans, a paired bar: days with a from-text line that also have timed minutes, versus from-text lines on an empty clock. The paragraph shown as itself. No sentiment score.

**Learned.** Whether phone plans are morning ritual steps (`dayPlanLogged`), `plan for rn` bursts, or both. Whether they arrive with a clock full of blocks or as prose alone. Writing lead of 0 is a same-day submit. Lead of 1 is the evening before, for a day plan.

**Partial.** The prose has no items inside it. You cannot score adherence of the paragraph. A new entry does not record that it replaces an older one. Both remain. Character share is optional and must be labeled as length, not as importance. Season logs exist even though settings export omits them. Include them here.

#### Telegram mornings beside priority habits

**Question.** When a telegram morning names priority habits, are those habits met that day, and does depth of the walk matter?

**Join.** `morning.source === "telegram"`. Depth score. `priorityHabitIds`. Each named habit’s cell that day: Reader B met, Reader A ratio, exempt, or no cell. `priorityRefreshedOn`, the ritual line in `priorityLog`, and the ritual `priorityEvents` row (no reasoning) are the habit-side echo of the same choice. Stones this week are the plate, not the ×5 ritual multiplier. The multiplier is drawn. It is not inside the 50-point ratio.

**Chart.** Depth on x, share of named habits met on y, `n` mornings. A second series for desktop mornings (`source === "desktop"`). Incomplete mornings (`completed === false`) plotted by `resumeStep`, not dropped. The hypothesis from the Telegram report: a finished walk co-occurs with those habits’ cells, not with a vague good-day flag. Show the good-day flag as a separate column so the hypothesis can fail in public.

**Learned.** Whether finishing the walk, and especially naming habits, lines up with those cells. A high depth and unmet named habits is a ritual that did not become the lamp. A met day with depth 1 (bed only) is a grade the morning did not script.

**Partial.** This is an outside join from the review onto the cell, labeled. Night and end reviews have no `source`. Do not split them, and do not extend this chart to gratitude-from-night. `STOP` saves a partial. Count it as depth-at-exit. Voice advances are not distinguishable from typed skips. GPS during the ritual is dropped, so a morning walk can have a location gap. That gap is a hypothesis, not a drop count. `priorityHabitIds` empty means the question was not answered or nothing was chosen. An empty array on `requiredTaskIds` means the to-do question was answered. Read the fields the depth table already distinguishes.

#### The domains that stay unstamped

These writes happen from the phone and leave no channel flag. The combined tab lists them in the Phone footnote and does not give them a phone-versus-desk bar.

| Write | Why the channel is not identifiable |
| --- | --- |
| Inbox, `qa:`, `add:`, bulk | `itemIds` only while the ingest row survives. After rotation, `createdAt` equals send time and so does a desktop capture. |
| Grocery add and `bought` | Completions have no phone flag. The pin is one overwritten row. |
| `habit:` / `did:` | No `keywordLogged`. Cell `updatedAt` is processing time and is shared with every later edit. |
| `at:`, `mood:`, `start:`, `track:` | No `generatedBy`. They look hand-painted. `track:` may show up as `trackedValue`. |
| Day notes | No `stampSuffix`. `createdAt` is the write. |
| Cycle flags | A desktop toggle writes the same flag. |
| Night review | `endCompleted` has no source. |
| Sleep bed and wake | Estimated precision is weak. `source` on the night means logged versus inferred from the grid. |
| Work session `start` / `stop` | No channel on the session. |
| Regrets from a blocked night reason | Desktop night calls the same writer. |
| Count ticks | The tick has no channel. Join through a text instant at the same minute while that instant exists. |
| Pantry quantity | A counter. Later bumps erase the path. |

While a turn is still among the last 200 and `itemIds` matches, an outside join can mark those specific rows. The mark expires. The chart says “joined, last 200.” It does not become a historical share.

### The day as a joint cube

#### One local day, five blocks, none of them a score

**Question.** What was this date, across plan load, tracking occupancy, habit grade, wellbeing, and phone stamps?

**Join.** The local date. Build five blocks. Do not average them into a day score.

| Block | Fields | Missing rule |
| --- | --- | --- |
| Plan | Commitment minutes, plan occupancy, stacked minutes, banner count, unplaced rail count, day-plan entry count, draft present, from-text entry count, header-plan step count, window-known flag, overcommit flag only if the window is known | Unknown window is a state, not a fine day. Inbox stays out. |
| Tracking | Activity occupancy and coverage, entropy and top-pen share at Category depth, estimated share, open-until-midnight tail minutes, sleep duration and midpoint as missing if the night is absent or rejected, phase only if the latch is open | Instants do not fill coverage. Unknown clocks stay out of the hour bins. |
| Habits | Raw day %, curved day %, blended day % only if the toggle is on, vacant flag, good-day flag, stone count, named-miss count, echo-stone count | Raw, curved, and blended stay three numbers. A vacant day is omitted from week means and is not drawn as zero. A grade of 0 with `daysIncluded` 0 is “no open days,” not a failed life. |
| Wellbeing | Count of datapoints whose `at` falls on the date, count whose `createdAt` falls on the date, mean of each key among points that set it, median lag | No points is empty, not a zero vector. Keys absent on a point are skipped. |
| Phone | Telegram-day flag from the high-confidence definition, plus which stamp fired | Unstamped writes do not flip the flag. |

**Chart.** The landing card for one day: tracking ribbon, plan lanes, habit strip (ratios and exempt marks, not fake minutes), wellbeing ticks at `at`, a provenance hairline only on rows that carry a stamp, quality strip. The 28-day shape view is five thin calendars, not one blended heat.

**Learned.** Whether the day you planned, the day you logged, the day you graded, and the day you texted are the same picture. A high raw grade on an untracked day is a lamp without a grid. A full grid on a vacant habit day is paint while the habits were waived. A telegram flag with no from-text plan and no keyword is often a single `log:` instant. The card should say which stamp.

**Partial.** Any block can be empty. The card shows the empty block. Phase is omitted when concealed, even though marks exist. Habit echo parents sit inside the raw percent. Offer a second raw percent with echo parents removed, labeled, so the cube does not double-count a floor habit and its children as two kinds of effort. Plan commitment double-counts overlaps; tracking occupancy does not. Put both labels on the card so a “full” plan and a “gap” grid are not treated as a bug.

#### Clustering in the joint space

**Question.** Which days repeat, once plan load, tracking shape, and habit grade are allowed to differ?

**Join.** The day vector from Tracking’s clustering (24 bins of Activity at Category depth, coverage, sleep missing-flag, phase one-hot if the latch is open), plus a small plan block (commitment, stacked minutes, window-known flag, banner flag), plus a habit block (raw day %, vacant flag, stone count). Curved and blended grades stay out of the distance, because a tolerance change would move the cluster without a life change. Wellbeing stays out of the distance unless the window has enough points to define a bin; otherwise a missingness flag. Telegram-day is a label drawn on the cluster, not a dimension that defines it, so the cluster is not “days I remembered to text.”

**Chart.** k from 2 to 5, chosen by stability when a random week is dropped. Name each cluster by its median tracking ribbon plus one plan sentence (“commitment above the window,” “no timed plan”) plus one habit sentence (“raw day % near the threshold,” “vacant”). The alluvial from morning shape to afternoon shape stays a tracking chart. A second alluvial can run from plan-load band to raw-grade band to telegram-day label, width = days, only as a flow of labels. It is not a new clustering.

**Learned.** The shapes this life actually repeats: a tracked workday with a timed plan and a mid grade; an untracked weekend with no plan; a reconstruction day (high estimated share, not `generatedBy`); a waiver day (vacant habits, sleep mark); a phone-touch day that is otherwise an ordinary cluster. Outliers are far from every center.

**Partial.** Do not cluster on raw pen ids. Do not cluster on the 10-pip value. Do not use Thursday’s grade to define a cluster that is then used as a Tuesday warning. Goal retargets rewrite the habit block’s history. Footnote that the habit coordinates are under the current goal. Short history: show the days and skip the claim, the same way Plan skips an autocorrelation claim.

#### Leading indicators that use a Tuesday habit gap, a tracking rhythm, and plan overfill

**Question.** By Tuesday night, was a bad week already visible, once tracking and plan are allowed into the same table as the habit gaps?

**Join.** The Habits cutoff, held fixed at Tuesday night. A bad week remains the app’s own definition: Sunday raw week mean below `accomplishmentThreshold`, or the week failing to be a good week. Features that exist by Tuesday night:

- Monday and Tuesday raw day %, named-miss count, habits with auto weight ≥ 1 at Monday, whether Monday failed the day-lift against Sunday, prior-7 mean versus the forming week, share of Monday–Tuesday cells whose trust winner was `manual` versus empty, climb habits already unable to reach 4 hits.
- Monday and Tuesday Activity coverage, entropy, and estimated share. A high estimated share is a logging feature, not an effort feature. Keep it in its own column.
- Sleep midpoint Monday and Tuesday morning versus the person’s median, when those nights exist. Missing nights stay missing.
- Plan commitment ratio on Monday and Tuesday only where the window is known. Unknown window is its own category, not a zero and not “fine.” Stacked minutes. Unplaced rail minutes.

**Chart.** A table of lift, or a simple logistic model that stays interpretable, with the feature list above and no Thursday columns. Hit rate: share of bad weeks that were in the warned bucket on Tuesday, with `n`. The prior-7 gap in percentage points, the same gap the good-day sheet shows, for every past day.

**Learned.** Whether the week was already gone by Tuesday in the habit arithmetic, and whether those Tuesdays also had an overfilled plan or a broken tracking rhythm. A warning that fires only on low Monday–Tuesday percents is the habit model. A warning that fires when the plan ratio is above 1 and coverage is high is a different mechanism: the clock was full and the lamps were empty. Publish them as separate rows.

**Partial.** Do not use Wednesday or Thursday if the cutoff is Tuesday. Tolerance changes and window changes move Sunday’s shown grade. Score the outcome on the raw week mean so a looser tolerance cannot create the event. Echo habits affect the raw mean. Note them. The rail and the window are partly recomputed. Say so. This is not a cause.

### Time of day

The shared axis is clock hour 0–23, local. Daypart words are a labeling on top of that axis. They are not the same bins in every report.

| Source | Bins |
| --- | --- |
| Plan, when a chart must honor `timeOfDayPreference` | Morning 05:00–11:59, afternoon 12:00–16:59, evening 17:00–20:59, night 21:00–04:59 |
| Tracking, as a starting cut only | 5–12, 12–17, 17–22, 22–5 |
| Sun, when a pin exists | Hours after `sunriseMinutes` / before `sunsetMinutes`. Plan does not store the sun. The astronomy helper does, default pin San Diego, first write wins per date. |

Use the hour axis for every stack. Apply the Plan bins only when the question is preference fit. Say which cut a chart used. A peak in hour 21 is evening in the Tracking example and night in the Plan table. Do not average those labels together.

#### Tracking mix by hour

**Question.** When in the day does each pen, tag, and gap happen?

**Join.** Occupied minutes, `startMin` floored to the hour, unknown clocks excluded, GPS 15-minute floor excluded from the start histogram when the block is still identifiable. Mean across days of minutes in that hour, 0–60. Sample size gates the color.

**Chart.** The hour × weekday heatmap, and the hour profile. Weekend versus weekday only with at least four days in each.

**Learned.** The Tracking rhythm section. Brought onto this stack so plan load and capture bursts can sit on the same hours.

**Partial.** Open-until-midnight tails dominate late hours if they are not hatched. Estimated Screen Time is a separate profile. Scope divergence (Activity’s hour profile versus Location’s) belongs here as a quality companion: a high divergence means one view was logged and the other was not.

#### Plan daypart load on the same hours

**Question.** Where does the plan put its minutes, and does that match the stored preference word?

**Join.** Minute load of timed events, planned actions, and tasks with `scheduledTime`, split across hours. Prefer a `todo` placement over the task clock when both exist. Events stay their own series. Preference fit uses the Plan bin table against `timeOfDayPreference`.

**Chart.** Weekday × hour heatmap of plan minute load, beside the tracking heatmap. A mismatch count: tasks marked `morning` whose start is not in 05:00–11:59. Default gravity: share of starts at 09:00 with duration 30.

**Learned.** Whether the plan is a morning document and the grid is an evening life, which the Plan report names as an outside join and this stack finally draws. Spikes at `:00` and at 09:00 are planning habits. Banner share printed beside the heatmap so a timed-minute chart is not mistaken for the whole month.

**Partial.** Overnight plan wraps do not exist in the store. Late blocks collapsed to 15 minutes undercount the night. All-day events add no minutes. Week-only tasks have no hour. Show them as an unplaced pile, not as a fake 09:00. The sun axis for plan minutes is available only by joining `DaySunTimes`. Days with a null sun stay on the clock.

#### Capture bursts

**Question.** When do phone stamps arrive, and when do the life-record clocks say the event was?

**Join.** Two series. Ingest `at` hour, channel `telegram`, last 200, process timezone. Text-pipeline `startMin` hour, full history, unknown clocks omitted. Ritual hour: first morning or night turn of a ritual session, windowed. GPS-note minutes by hour, full history, not mixed into the instant Fano factor.

**Chart.** The hour ribbon with both series. A burst is a gap under 2 minutes. A return is a gap over 6 hours. Session size shown as two modes.

**Learned.** A `log:` life-record hour that disagrees with `gm`’s send hour is the finding the Telegram report describes. If `gm` is not in the morning, the process zone is wrong or the ritual is catch-up. Live location will dominate any burst statistic that includes GPS minutes. Compute that statistic twice.

**Partial.** The 200-window cannot fill a month of turn counts. Stamped instants can. Edits re-apply at the original send time and can fake a burst of two identical instants. Album waits and sleeping laptops are not separated until `processedAt` exists. The accidental habit `updatedAt` lag is the only backlog proxy, and only for `dh:` and `habit:`.

#### Habit time, only where a clock exists

**Question.** When was a habit done?

**Answer, by what is stored.**

| Clock | What it is | Use |
| --- | --- | --- |
| None on the cell | The lamp has a period key and an `updatedAt` | `updatedAt` is the last edit. It can enter a “edited in this hour” chart. It cannot enter a “done in this hour” chart. |
| Tag minutes | The hours the linked tag was painted | A proxy for when the behavior was on the grid, not when the cell was checked. |
| Sleep link | `sleptMin` or `wokeMin` versus `beforeMinutes` | A real clock for those Yes/No habits. |
| Keyword note `from text message at 3pm` | A phrase formatted at write time | Do not re-parse it into a series. If the zone later changes, old notes keep the old words. |
| Planned-action `startTime` | When the habit was **given a block** | Intention hour, not performance hour. |
| Done-row duration | A derived length on a logged action | A duration, not a start, unless that task also has `startedAt` or a time log. |

**Chart.** For tag-linked habits, the hour profile of the tag-minute set on met days versus unmet days. For sleep-linked habits, the signed bedtime against the deadline. For everything else, no hour-of-completion chart. A caption explains which clock was missing.

**Learned.** Whether painted exercise happens in the hour the plan blocked for it (join the action’s start hour to the tag profile), and whether sleep habits are met by a deadline the night actually cleared.

**Partial.** Most habits have no performance clock. Inventing one from `updatedAt` would date the edit. Month-grid drops at 09:00 will fake a morning habit plan. Split those defaults out.

#### Wellbeing samples

**Question.** At what hours are scores named, and at what hours are they written?

**Join.** Hour of `at`, and hour of `createdAt`, as two histograms. The presence tuple at `at`, from the wellbeing section above. No line across gaps longer than 6 hours.

**Chart.** Five sparklines on the clock, points only. The lag histogram stays titled timeliness.

**Learned.** Whether scores are a morning instrument or an evening back-log. Median lag by hour of `at`.

**Partial.** Missing days are not zeros. The door that opened the logger is not stored. Do not put this series on the estimate-calibration plot.

#### Sun as a second axis

**Question.** Which of these hour profiles lock to sunrise, and which lock to a clock?

**Join.** `DaySunTimes` for the date, when the pin exists. Tracking already defines the comparison. Plan minutes and text-pipeline instants can be shifted by the same sunrise offset. Days with null sun stay on clock time and are flagged. Wellbeing `at` can be shifted the same way. Habit cells cannot, except through a tag-minute or sleep clock.

**Chart.** Small multiples, clock versus sun-relative, for Activity, for plan minute load, and for text-pipeline instants.

**Learned.** A plan that locks to 09:00 while Activity locks to sunrise is a schedule beside a daylight life. That is the outside join Plan named, drawn on the sun axis Tracking already has.

**Partial.** The default pin is San Diego until a home city is set. First cache write wins, so last week is not restamped with today’s clock. Polar or unpinned days stay on the clock. Telegram’s process zone and the sun pin’s zone can disagree if the hub is not in the life’s zone. Document the zone on the chart.

### Sequence and lag

#### What precedes a missed habit day

**Question.** On the day before a miss, and on the morning of it, what did tracking, mood, and sleep look like?

**Join.** A miss is a required, non-exempt day where Reader B is unmet. Keep named misses separate from blanks. Look back one local day: Activity coverage, entropy, top pen, classed intake counts, mood-mark means with `n`, company Together minutes. The morning of the miss: sleep duration and midpoint if that morning’s night exists, estimated ends flagged, all-nighter flagged. Same-day tag minutes if the habit has a link: a miss with painted minutes is a different object from a miss with an empty grid.

**Chart.** Paired comparison, miss days versus met days, each side with `n`. Suppress a side under 8 days for a day-level association, matching the Tracking rule, and under 3 for a mood mean. Recovery curves stay in the Habits wing: lag until the next met day, named versus blank.

**Learned.** Whether misses follow short nights, high tension, a drug intake, or simply an untracked day. A miss with tag minutes above the threshold and trust winner `manual` unmet is a disagreement, not a behavioral miss. Pull those out before the comparison.

**Partial.** Not a cause. Mood may be missing on most days. Sleep may be missing. The current goal rewrites which days count as unmet for a GOAL habit. Blanks are not failures the person named. Exempt days are neither. A deleted habit cannot contribute its misses. You will not see them.

#### What plan overfill precedes a grade drop

**Question.** Does a day or a week that promised more than the waking window show up before the raw grade falls?

**Join.** Lag 1 and lag 7 of the commitment ratio, only on days the window is known, against the next day’s raw day % and against the Sunday raw week mean. Stacked minutes as a second feature, so overlap is not confused with a long sequential plan. Tracking coverage on the overfilled day as a covariate: an overfilled plan that was also fully painted is a full life; an overfilled plan on an empty grid is a promise.

**Chart.** A scatter of Tuesday commitment ratio versus Sunday raw week mean, unknown-window Tuesdays omitted and counted in the subtitle. A simple lag-1 correlation of daily commitment with the next day’s raw percent, `n` days shown. No claim if the series is short, the same restraint as Plan’s correlogram.

**Learned.** Whether overfill leads the grade or merely sits on the same busy weekdays. Lag 7 asks whether this weekday’s plan resembles last weekday’s grade. The Tuesday leading-indicator table already includes the ratio. This chart is the continuous version, not a second model.

**Partial.** Pips saturate. Use the ratio. Window-unknown days are excluded, not treated as ratio 0. A tolerance change can fake a grade drop on the curved rail. Use the raw mean. Goal edits can fake a drop on the habit side. Footnote the current goal. Roll-up on Monday moves last week’s unfinished tasks onto this week and can change commitment after a Sunday-night reading. A lag that uses the placement as it exists now is not the plan as it stood on Tuesday.

#### Send time versus the life-record clock

**Question.** When the phone sent the message, and when the vault says the life happened, do those clocks match?

**Join.** `IngestEvent.at` is `message.date`, the send instant, interpreted in the executor’s zone when it becomes a local day and a `startMin`. Text-pipeline rows store that minute. Plan entries stamped from text store `createdAt` as the send time. Habit `habit:` and `dh:` store the cell on the send date, unless the phrase says `yesterday`, and `updatedAt` is processing time. Explicit dates on log and switch lines (`7/4/26`) file that day. A message at 00:30 local files “today” unless the phrase shifts it.

**Chart.** For turns still in the 200: send hour versus `startMin` hour of the row they created, where `itemIds` or the stamp makes the pair. The two accidental lag dots (cell `updatedAt`, pin `at`) with their biases labeled. A note that the right tail of queue lag is censored near 24 hours.

**Learned.** Live taps (send minute and `startMin` match, exact certainty) versus memories (`est` / `unknown`, or a send hour far from the clock words in the phrase). Backlog apply stamps the life record with the send instant, which is correct for the life record, and is why lag has to be a separate field that does not exist yet.

**Partial.** `processedAt` is not stored. `edit_date` is ignored, and the edit is a second command at the original send time, so a “lag” of zero can be a re-apply. Habit `updatedAt` measures the last edit, not the text, once the desk has touched the cell. The phrase `from text message at 3pm` must not be parsed into this chart. Process-zone mistakes shift the filed day. The ISO `at` can still be the true instant while `formatLocalDateKey` in the wrong zone is the bug. Document the zone.

#### Reschedule and push versus later completion

**Question.** When a task was pushed or rolled, did it finish later, and does that show up in the habit week or the tracking day?

**Join.** `schedulePlacements` in period order. `resolved: "pushed"` versus omitted roll-up, versus `completedDate` after the placement’s period. Lifetime `daysPushed` / `weeksPushed` / `monthsPushed` as a distribution. The sequence of `resolved` is known. The sequence of clicks is not, because the array does not store when the resolution was written. Habit side: a pushed task is not a habit. The cross is by day: on days a pushed placement’s old value names, what was the raw day % and the Activity coverage. That is context, not the task’s adherence.

**Chart.** The resolution × status table from the Plan report. A survival curve of pushed tasks by days from the pushed period to `completedDate`, censored if still open. Beside it, the count of drags you cannot see: tasks whose live `scheduledDate` simply differs from a `todo` action’s date (week-grid divergence). Those are not pushes. They are internal disagreement.

**Learned.** Deferral style. High roll-up and low push means unfinished work is absorbed into coarser lists. A handful of tasks with large `daysPushed` dominate the mean. Show the max and the median. A task that finishes on a later day is adhered for the later period and is a deferral for the earlier one. Keep both.

**Partial.** Most moves are invisible. Funnel moves while the period is still live write no placement. Day-rail unschedule deletes the placement. Week and month unschedule keep the action (grain leak) and change the task. Event drags leave no residue at all. There is no reopen log. If `completed` is cleared, adherence that trusted `completed` can flip. Prefer “`completedDate` fell in the period and `completed` is still true,” and show reopen as a rare state when `status` is active and placements remain. Habit planned-actions have no `schedulePlacements`. A deleted action is gone. You cannot see that it was pushed.

#### Writing time versus the day the record names

**Question.** Are the plan, the note, the night, the score, and the habit cell written on the day they describe?

**Join.** This is the identity question’s lag form. Plan: `createdAt` local day versus the period key (writing lead). Day notes: `createdAt` versus the day key. Sleep: `updatedAt` versus the morning date. Wellbeing: `createdAt` versus `at`. Habit cells: `updatedAt` versus the period key, late if more than 2 days after, from the measurement audit. Tracking blocks: no write time. The only proxies are the other stamps on that date.

**Chart.** Five delay distributions, each named. Legacy null `createdAt` is “earlier,” not midnight. A day-note union by id should not double-count.

**Learned.** A season essay written the week it ends, while tasks are scheduled months out. A sleep night written three days later. A habit cell edited on Friday for Monday, which still counts fully in Monday’s grade. A wellbeing point back-logged by hours. The tracking ribbon has no such arrow. Say that in the caption so a beautiful Tuesday is not described as recorded on Tuesday.

**Partial.** Time entries cannot be placed on this chart. Tombstones are not an edit log. Undo stacks are memory. Item-activity rows cover header-plan edits only, and not creation. Ingest send time is a write time for stamped rows and is already in the previous subsection.

### Identity across domains

#### Concentration of attention, of the habit portfolio, and of the plan

**Question.** Is the day dominated by one pen, one habit, and one kind of plan, or are those three concentrations different?

**Join.** Local date or week, stated. Tracking, on shares that partition: entropy, normalized entropy, Herfindahl, Gini / Lorenz, top-pen share, effective number of pens. Empty days have no distribution. Habits: stone share (one gem can be most of the plate), zero inflation versus uncapped intensity (every day half, versus every other day full), rail gap (days look fine while some rows are empty, or the reverse). Echo parents out of the “who dominated” ranking. Plan: banner share versus timed-minute share, context load with blank context as its own bucket, grain mix of open tasks, default-duration share at 30 minutes, daypart concentration of minute load. Do not collapse urgency, importance, cognitive load, and entropy into one priority score before looking. The task field named `entropy` is a stored 0–1 on the item. It is not Shannon entropy. Label it item-entropy so it is not confused with the tracking metric.

**Chart.** Three small Lorenz curves for a week: pens by minutes, daily habits by stones (or by uncapped contribution), plan minutes by context or by source (`free` / `todo` / `habit` / event). A sentence under each: effective number, top share.

**Learned.** A week that is one pen, many habits at 20%, and a plan of banners is three different people in the arithmetic, and it may be one life. A week that is one habit’s stones and many pens is the partial-credit gap again, seen as concentration. Default-duration share high and pen entropy high means the plan is a 30-minute habit and the grid is not.

**Partial.** Variant reach must not enter the tracking Lorenz. Tag percents of the day may exceed 100. Plan commitment may exceed occupancy. Use occupancy or a partition for any curve that claims to be a share of a whole. Deleted habits and recovered pens change the vocabulary. Cluster and concentrate at a depth, or on tags, so a recolor is not a new personality.

#### Whether the day you plan, the day you log, and the day you grade are the same day

**Question.** For each local date, did a plan get written about it, did the grid receive occupancy, and did a habit cell get its number, and were those acts on that date?

**Join.** Three marks, plus the phone mark.

| Act | The day it is about | The day the act happened |
| --- | --- | --- |
| Plan prose | The period key | `createdAt` local day. Null is “earlier.” |
| Timed plan | The event or action `date`, or `scheduledDate` | Not stored for events and actions. Task `createdAt` only, with rail-midnight lead called out. |
| Tracking occupancy | `TimeEntry.date` | Not stored. Proxies: day-note `createdAt`, sleep `updatedAt`, metric `createdAt`, text-pipeline send time. |
| Habit grade | The cell’s period key | `updatedAt`, when present. The grade includes the cell on the period day even if it was edited later. |
| Phone | The filed local day | `IngestEvent.at` while the turn survives; otherwise the stamp on the row. |

**Chart.** A month of cells with up to four ticks: plan written about this day, grid occupancy on this day, habit cell with `updatedAt` on this day, telegram stamp on this day. A second layer: plan `createdAt` on this day about a different period (writing ahead or behind). Habit edits on this day about an earlier period (retroactive grade).

**Learned.** The lag the identity actually is. A person can plan on Sunday, log on Tuesday, and grade on Friday, and the tubes will still show one Tuesday. The ticks separate those acts. Header-plan tasks are the rare plan rows with a real `createdAt`. Their lead is meaningful. Rail to-dos are not.

**Partial.** You cannot mark “logged on Tuesday” for a block brushed Tuesday about Tuesday, because the block has one clock. The chart must not invent that tick. It can mark occupancy on Tuesday and a day note written Tuesday. Those are different acts. Event birth is unknowable. A drag that moved an event off Tuesday leaves no Tuesday residue. A habit delete removes the cell, so Friday’s edit of a since-deleted Monday is gone.

#### What this identity cannot support

A claim that the same hour was planned, logged, and graded. Grading is a period cell. Logging is a minute. Planning is often a day with no hour. The hour stack is the right place for the minutes that do exist. This identity section is about dates of acts.

A personality type from the clusters. Name clusters by their median ribbon and their plan and grade sentences.

A joint “integrity” score that rewards plan, log, and grade falling on one day. The tubes do not define that virtue. The chart shows the ticks.

### Forecasts that stay honest

Three forecasts are already specified. Each keeps its own baseline and its own error. They are not blended into a learned score.

#### Tomorrow’s tracking shape

**Baseline.** The median hour profile of Activity occupancy on the same weekday, among days with coverage ≥ 25%, plus yesterday’s last pen because people continue.

**Optional shift.** If last night’s midpoint is known, shift the template by the difference from the median midpoint, capped at 90 minutes. Label the shift a hypothesis.

**Error.** Mean absolute minutes per hour on the last four same-weekdays. If that error is large, show the template and withhold the prediction caption.

**Learned.** Whether this life is regular enough to have a tomorrow.

**Refusals.** Do not forecast bleeding. Do not forecast phase over a marked ovulation. Show the cycle estimate’s own basis note instead of a second model. Do not fill missing scopes. Do not treat an open-until-midnight tail as observed when scoring the error. Score observed and estimated as separate errors if the template was built on all rows.

#### The week grade from the days that remain

**Baselines**, all transparent:

| Name | Remaining days score |
| --- | --- |
| Frozen | The mean of this week’s elapsed raw days, then the grade is recomputed |
| Baseline | The prior-7 mean, the same average the +5 bonus uses |
| Habit-paced | Each habit’s elapsed ratio, then the day average is recomputed |
| Requirement | The minimum raw score each remaining day must average so the week’s raw mean clears the threshold |

Perfect output: each habit’s paced row percent if remaining days match the elapsed ratio, then the mean. Name the habits that would have to go from 0 to 100 to move output by about `100 / n`.

**Error.** Last Wednesday’s forecast of each kind against the Sunday raw grade, and against the curved grade as a second column so a tolerance bonus is visible and not mistaken for the forecast being right. Publish both.

**Learned.** Which naive story matches this vault: the week continues as it started, the week returns to the prior week, or the week is a per-habit pace. The requirement line is the sentence the sheet already wants.

**Refusals.** Do not forecast exempt future days as required. Do not forecast a habit before its creation day. Do not forecast a curved grade without showing the raw one. A brand-new store has a prior-7 of 0, so the first real day beats it. That is the formula. Coverage pace forecasts a coverage habit’s occupancy. It does not forecast the week grade.

#### Next week’s planned load from what is already placed

**Baseline to beat.** Same weekday last week, from stored commitment. If it wins, the plan is habitual.

**The floor, not a forecast.** For each day of next week, commitment from events, actions, and day-scheduled tasks already dated there. Week-only estimates shown as an unplaced pile, not spread across the seven days. Solid bar.

**Soft addition.** Habit-block expectation: trailing share of days with a `habit` placement, window length stated, times the block minutes. Dashed. It does not know exemptions. The fair denominator is the outside join from Habits. Until that join is applied, the dash is an expectation of drops, not a rate.

**Error.** Next Monday, compare the Sunday-night floor to the commitment that exists after roll-up, and say the difference is the roll-up, not a model error. A second error: the habit-expectation dash versus the blocks that were actually dropped, over the weeks where you can look back.

**Learned.** Whether next week is already written or is a habit of dropping the same chips. PERT bands on tasks that have them are optimistic-to-pessimistic minutes, not a confidence interval. Events have none. Frequency-type rules contribute nothing, because the instances are not on the calendar. Count-type remainder contributes once, not `totalCount` times. Title patterns are “this title has repeated,” not a scheduled show.

**Refusals.** Future drags overwrite the floor. Auto-push changes which week receives the residue. Do not draw the 10 pips as the forecast. They saturate.

#### The short-horizon presence forecast is a different instrument

Now’s one-step Markov forecast predicts the next joint state for about a median dwell, not tomorrow’s grade and not next week’s load. It requires a row count of at least 8, prints coverage, and refuses a winner when repeats are thin. It is conditioned on minutes that were logged. Put it in the Presence room. Do not let it vote in the three forecasts above.

#### Why there is no joint model

A model that predicted Sunday’s grade from Tuesday’s plan ratio, Tuesday’s coverage, and Tuesday’s telegram flag would need an outcome that is stable under the current goal, a window that is known, and features that are not rewritten when a drag deletes a placement or an edit replaces a block. Those conditions are not met often enough to identify a joint fit. The honest presentation is the three baselines side by side, each with the error defined above, plus the Tuesday table of lifts with `n`. If one baseline wins, say which. Do not train a blender on top of them. Do not invent a feature for event attendance, free-block completion, dialog opens, or unstamped phone channel. Those labels are not in the vault.

### Data quality across sections

One room, always one click from the landing card. It is the legend for trust. Each row is a way the combined tab can double-count, rewrite, or forget.

**Overlaps counted twice.** Tracking occupancy is a union. Summing durations can report a 30-hour day, usually derived sleep on hand-painted work. Both layers stay. Tag minutes union across scopes. Variant reach can exceed the parent. Plan commitment adds overlapping blocks. Plan occupancy unions them. A `todo` placement suppresses the task’s `estimatedDuration` in the capacity sum. An event and a task that happen to be the same appointment are not linked unless `taskId` or a checklist says so, and both count. A week-grid drag leaves the action and the task on different clocks, and both can count. The day card labels commitment and occupancy separately so this is visible.

**Goal edits rewrite the habit past.** The current `goal`, `increment`, `startValue`, `threshold`, `grace`, `floorPercent`, link mode, and `completionSources` overwrite the habit. Historical percents recompute. A retarget from 10 pages to 5 rewrites a logged 5 from 50% to 100%. You cannot date it. `completion.goal` is not the divisor the grade uses. Climb staircases for last year are wrong if `increment` changed last month. Every goal chart says this. The measurement audit lists goals whose current `goal` sits below the median historical `value` as a suspicion, not a proof.

**Deleted habits lose their cells.** There is no archive. `deleteTask` strips the four maps and `habitExemptions`. Grades that included the habit cannot be reconstructed. Orphan planned actions remain, `sourceId` pointing nowhere. Orphan cells whose id is gone from `tasks` are ignored. Analytics recomputes from the live store or it will disagree with the tubes.

**Plan drags that vanish.** An event drag keeps the id and replaces `date` or the clock. The old day is gone. There is no tombstone. A multi-day `endDate` is not shifted by a month drop that writes `date` only, so a span can invert. A live funnel move writes no placement, because the period did not end unfinished. The first durable trace is the placement appended when a period ends still open. Day unschedule deletes a to-do’s placement. Week and month unschedule keep the planned action and coarsen the task: grain leak. `deleteAction` removes the block and leaves the task scheduled. `deleteEvent` can leave checklist tasks aimed at a missing id. Those tasks stay in adherence. Show the dangling link.

**Telegram edits that re-apply.** `edited_message` is a new `update_id` and the same `message_id`. Dedupe prefers `update_id`, so the edit is a second command at the original `message.date`. It can create a second capture, instant, or plan line. It does not update the first row. After the seen-key ring of 500 evicts a key, the same update can apply again. Two domain rows with equal send timestamps and equal titles are a possible re-apply. Simulate has no dedupe key. A chart that forgets `channel === "telegram"` mixes practice into the life record, and `generatedBy.text` is set for Simulate too. Successful GPS paints are stripped from the 200-log. A historical GPS rate from `events` is mostly failures. Live location during a ritual is dropped and not logged. The grid gap is the only scar.

**No `updatedAt` on time entries.** Retroactive drags, splits, and repaints are invisible. Do not claim “edited on” for a block. The honesty stamps that do exist: sleep `updatedAt`, pen `editedAt`, day-note `createdAt` versus the day key, wellbeing `createdAt` versus `at`, habit-cell `updatedAt`, item-activity `at` for header-plan edits, ingest `at` for the turns that remain, plan-entry `createdAt`. `removedEntryIds` remember that ids were deleted. They do not remember what the row said. The in-memory undo stack is not a dataset.

**GPS pen without coordinates.** Notes are the literal `"gps"`. The last fix’s lat/lon live in a side key. This tab does not draw a map. A block may be one sample stretched to 15 minutes, or a dropout bridged under 45 minutes, or a pen held because the jump was fuzzier than 150 m. A venue pin is a shared place and must not count as a sample. Shortcut, `gps:` text, and Live Location share the note. They are not separable.

**Frequency rules with no instances.** A task with `repeatSettings.type === "frequency"` stores times per day, week, or month. Completion does not generate the next row and does not tick a counter. Reliability is unavailable. The frame stays empty, with the rule as a sentence. Count-type tasks are the recurrence that advances. Habit frequency is a different mechanism: the cells exist in the maps. Do not describe a habit as a frequency-rule with missing instances.

**Other signals that belong in the same room.**

| Signal | What to show |
| --- | --- |
| Open-until-midnight tails | “Asserted to end of day.” Keep them out of entropy and out of “you were in transit for 9 hours” unless the chart is about the assertion. |
| Unknown clocks at minute 0 | Badge. Exclude from hour histograms. |
| iPhone call of 1 minute | Estimated default, not a measured call. |
| Observed-only blanks Screen Time | Every Mac screen row is estimated. Say so. |
| iPhone versus Mac screen ids | Two trees. Union minutes if you combine. The phone rows are not stamped `screentime`. |
| Rejected sleep spans | “These two clocks contradict,” not duration 0. |
| Luteal prior | `lutealSource: "prior"`. Not this body’s luteal length. |
| Cycle latch closed | No phase charts. Marks remain. |
| Header plan filled from the planned length | Zero slip by construction. Its own bin. |
| 09:00 × 30 and month habit drops | Default gravity, not a measured morning. |
| Paste batch ids | Only `base-0` … `base-(n-1)` with no gaps. Not a `source: paste` field. |
| Settings export | Omits season logs and planned actions. Say so, or a backup looks like the whole plan. |
| Count ticks versus instants | Unmatched both ways. |
| Hand paint versus derived sleep | Both layers. |
| Wellbeing versus mood marks | Different instruments. Do not average them. |
| `confirmedEventIds` | Lifetime, undated. |
| Grain leak and orphan `sourceId` | List them. |
| Echo habits inside a grade | The sensitivity with parents removed. |
| Priority blend with no weighted habits | A no-op. Do not draw a floor. |
| Curve above 100 | Allowed. Clip only when the label says clipped for display. |
| Night review | No channel. Do not split. |
| Split brain | A domain row can exist when `sendMessage` failed. Absence of a phone memory is not absence of a capture. |
| Clock skew | Negative wellbeing lag, or `spanId` time disagreeing with `startMin` by more than a minute. Exclude from lag percentiles. Do not “fix” the day. |
| Dangling edges | `startEventId` / `endEventId` missing. Pen links that point nowhere. Gap notes whose key no longer matches a gap. |
| Recovered pens | Name “Recovered pen.” |
| Military-clock suspicion | Titles that say night and `startMin` in the morning. A hint, not a finding. |
| Voice notes | Outside a ritual: no audio, no transcript. Inside morning: the step advances and the audio is discarded. |
| Disabled ingest and silent duplicates | No event row. |
| Machine timezone change | Floating plan clocks and tracking minutes are reinterpreted. The data cannot say that this happened. |

---

## Information architecture

One analytics tab. The subject is the vault, not a gallery of chart types. Default landing is **one local day**: today, or the last day that has any of the five blocks if today is still empty and the person is looking backward. The 28-day shape is one step away. Empty days stay in every range. As-of date is visible and uses the same rule as the habit grid when a grade is on screen.

The first paint is the day card from the joint-cube section: tracking ribbon, plan lanes, habit strip with raw beside curved, wellbeing ticks, provenance hairline only where a stamp exists, quality strip with the worst overlapping minutes and the estimated share. No single score. No forecast caption until that forecast’s error has been computed.

### Rooms

| Room | What it is for | Where the detail lives |
| --- | --- | --- |
| Day | The landing. One date as five blocks. Drill starts here. | This document, joint cube |
| Shape | Last 28 days. Five thin calendars: coverage, commitment (unknown window in neutral ink), raw day % with curved as a layer, wellbeing count, telegram-day marks. Cluster strip named by ribbon, plan sentence, and habit sentence. | Tracking Shape, Plan load calendar, Habits ribbons |
| Clock | Hour 0–23 stack: tracking mix, plan minute load, capture bursts, wellbeing `at` versus `createdAt`. Sun toggle. Habit hour only where a clock exists. | Time-of-day section |
| Cross | The combination analyses, each card stating its join key and its partial side. This is a room, not a junk drawer. Grouped as this document groups them. | The combination sections |
| Habits | The six habit rooms. Raw standing next to shown. Echo parents called out. | [02-habits.md](02-habits.md) |
| Plan | The eight plan views. Tasks-only adherence. Events and free blocks on the shelf that says they have no outcome here. | [03-plan.md](03-plan.md) |
| Tracking | The eight tracking rooms. Occupancy as a union. Quality strip. | [01-tracking.md](01-tracking.md) |
| Presence | Now’s four rooms. Footnote on reconstructed occupancy. No dialog-open count. | [04-now.md](04-now.md) |
| Phone | Coverage line first. Stamped history versus the 200-row conversation. Not-separable footnote. | [05-telegram.md](05-telegram.md) |
| Forecast | Three baselines, each with its error. Markov dwell forecast kept in Presence and linked, not mixed in. | Forecast section |
| Quality | The cross-section quality room. Always one click from Day. | Data-quality section |

Shared controls: local date range; depth lens that does not write the grid’s `displayDepth`; Observed only; cycle latch respected; reader toggle per habit chart; exemption drop versus count-as-zero; raw always visible under curved and blended; priority term shown even when the blend is off; process zone named on every phone chart; sample size and exclusion count on every view.

### Drill

Day → minute → record.

**Day.** The landing card. Click a calendar cell in Shape to get here.

**Minute.** The cube at that `startMin`. Each scope’s covering pen, or missing. Instants at that minute in a side list, unknown clocks not forced onto minute 0. Plan blocks whose windows cover the minute, by source. Wellbeing points whose `at` is that minute, with lag. Habit cells do not appear as if they occupied the minute. They appear in a day-level strip, unless a tag-minute set, a sleep clock, or a planned-action window actually covers the minute, in which case the habit is listed as “linked through this minute” with the link named. A keyword flag without a clock stays on the day strip.

**Record.** The row itself.

| Record | What the drill shows |
| --- | --- |
| `TimeEntry` | Pen, secondaries, tags, variants, title, notes, project, books, pages, mood reading, precision, clock certainty, `generatedBy`, `estimateOf`, span siblings, `splitAfter`. |
| `CalendarEvent` | Clock or banner, checklist readiness, whether the id is in `confirmedEventIds`, overlap minutes. No attendance field. |
| `PlannedAction` | Source, `sourceId`, duration, and the task or habit it claims, or “free, no outcome.” |
| `Task` | Schedule grain, placement resolutions, completion fields, `headerTracking`, time logs, estimates. |
| `TaskCompletion` | Ratio, met, source flags, keyword flag, `updatedAt`, exempt reason. Current goal labeled as current. |
| `SleepNight` | Both clocks, precisions, `updatedAt`, all-nighter and its source. |
| `MetricDatapoint` | Values that are present, `at`, `createdAt`, context. |
| `AppendLogEntry` | Text, `createdAt`, `stampSuffix`, and whether the key is a day, week, month, season, or a day note. |
| `IngestEvent` | Only if it is still in the 200. Kind, status, channel, raw. Otherwise the drill says the conversation row has rotated and shows the domain stamp instead. |

Click a gap to the untracked note and the Fill range. Do not paint from this tab. Click a cluster to its member dates. Click a heatmap hour to the blocks in that hour. Click a slip bar to the tasks that had both clocks, and to the count that were excluded.

### Rooms that stay blocked

These views are drawn as a sentence and an empty frame, not as a zero.

| Blocked until | What the frame says |
| --- | --- |
| An assertion log | Check-in counts, click time versus occupancy, the overwritten pen, origin of a stamp, calibration of an estimated interval against the exact one that replaced it. |
| Write timestamps on `TimeEntry` | “Edited on” for a block. Any claim that the ribbon was brushed the day it names. |
| `eventId` on the block, or a dated confirmation | Attendance, and a calendar of confirmed events. |
| An outcome on free blocks | Whether a free block was done. |
| Generated instances for frequency rules | Reliability of “three times a week.” |
| Channel stamps on night reviews, cycle flags, day notes, `habit:` cells, and location/mood/`track:` paints | Phone-versus-desk share for those domains. |
| `processedAt` on the ingest event | Ingest lag, backlog sessions, censoring at 24 h as a measured tail. |
| Snapshots of `goal`, threshold, grace, increment, and trust order | A dated retarget. The climb staircase for any period before the current increment. |
| Move history on events and planned actions | How many times a chip was dragged, and what time it used to occupy. |
| Retained previous intervals | The estimate-versus-later-exact plot for presence. |
| A joint label the three baselines do not have | A single learned forecast of grade from plan and tracking. The Forecast room shows the baselines instead. |

Phone does not recompute a habit grade. Tracking does not recompute one either. Habits does not invent a second formula. Plan does not treat a ghost outline as a plan row. Now does not treat last-known as fact unless the overlay is on and captioned.

---

## Appendix: history that is not stored

This appendix is a wish list. None of these fields exist today. The tab above is designed to be true without them. Each row says what it would unlock. It is not a specification of a logger, and it is not a claim that the current vault contains the column.

| Missing history | Where it would sit | What it would unlock |
| --- | --- | --- |
| Assertion log: `assertedAt`, `clientNow`, `gesture`, scope, pen, span, the estimate flag **this gesture** set, `previousPenId`, resulting entry ids, `origin` | Beside the paint, append-only | Real check-ins, including dialog open and close and pane. The overwritten value. Calibration of an estimate against a later exact. Transitions conditioned on gestures rather than on merged dwells. Separation of Now, grid, desk, and ingest. |
| `updatedAt` or an append-only edit log on `TimeEntry` | The time entry | “Edited on.” Separation of a live tap from a Friday repaint of Tuesday. A real history behind `removedEntryIds`. |
| Coordinates on the location entry, or a durable fix log | Beside GPS blocks | A map. Visit duration that is not the 15-minute floor. Separation of one sample from a bridged dropout. |
| `eventId` on a confirmed block, and a date on the confirmation | The time entry or a confirmation row | Attendance as an id join. A calendar of confirmations. Today’s list is lifetime and undated. |
| `createdAt`, `updatedAt`, `movedFrom` on events and planned actions, plus a tombstone | Those stores | Lead time for events. Reschedule rate that includes drags. The previous clock. |
| A row per frequency-rule occurrence | The task | Reliability of “N times a week.” Today the rule is stored and the score is unavailable. |
| Snapshots of habit `goal`, `increment`, `threshold`, `grace`, `floorPercent`, and `completionSources` | The habit, append-only | A dated retarget. Honest historical percents. A climb staircase that survives an increment edit. |
| `processedAt`, telegram update id, message id, surface token before expansion, extract-drop counts, `sendOk`, `pinOk` | The ingest event or the poller | Lag, edit versus new message, true dedupe rate, alias yield, silent drops, split brain. |
| `source: "telegram"` on night reviews, cycle flags, day notes, `habit:` cells, and location/mood/`track:` paints | Those domain rows | The channel share that is not identified today. |
| `advancedBy` on a morning affirmation step | The morning slice | Voice versus text. Today a voice note becomes the same reply as a skip. |
| Previous interval retained when a now-stamp overwrites | The assertion log is enough | The estimate-calibration plot for presence. Undo snapshots are memory and cap at 40. They are not this log. |

Until those exist, the tab stays inside the native metrics and the partial joins above. Empty frames stay empty. Missing stays missing. The minute stays the join, the union stays the occupancy, the hatch stays the doubt, and the empty day stays a day.
