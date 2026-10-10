# Analytics vision: Now

Now is the header door onto the present. The word key (`components/cognitive-state.tsx`, export name `CognitiveState`) opens one dialog. The caption is **Recent now** on the Tracking pane and **Upcoming now** on the Plan pane. The body is `components/header-tracking/`. Current moment sits above the pane switch on both sides: four presence lanes, a Metrics key, Working on, Events, Thought process, and Update state.

This report designs an Analytics tab for that surface. It is grounded in the fields those writers actually leave behind. It does not describe any Analytics screen that already exists.

The honest premise comes first. **Now does not have a private database.** Almost every save lands in a store that Home Tracking, Home Plan, Operations, or ingest also write. The dialog’s open/close, which pane was showing, which lane was selected, and the draft clocks are React state. They die when the dialog closes. There is no persisted sample of “the user looked at Now.” There is no cognitive-state enum, no trajectory table, and no assertion log that says “at 14:07:12 the user claimed Location = Library, estimated, via Update.”

What survives is the **result** of those claims, mostly as minute-resolution intervals and instants in the time-tracking vault, plus a few records that do carry a writing time. Analytics of Now is therefore analytics of a **short-horizon state reconstructed from occupancy**, with a thin set of true event times beside it. The tab should say so in the chrome: reconstructed presence is not the same thing as an observed check-in.

Capture doors (`components/capture-doors.tsx`, `components/capture-door-bus.ts`) were checked and set aside. They open Ingest, From Notes, and Phone Notes. They do not log the present moment.

---

## 1. Data inventory

### 1.1 Two layers

| Layer | What it is | Can Analytics treat it as Now history? |
| --- | --- | --- |
| **Stored Now history** | Rows written by Now’s own functions, still readable after refresh | Yes, with the provenance limits below |
| **Live pointers** | The same rows, or other sections’ rows, that Now is merely showing | Only as context. Do not count a desk paint as a Now check-in |
| **Ephemeral UI** | Dialog, drafts, undo stack, live overlay when no block covers this minute | No. Design the chart so a missing series is an empty state, not a zero |

Provenance is the hard limit. A presence stamp, an event, and a thought are ordinary `TimeEntry` rows. They do not store `source: "now"`. A later edit on the Time Grid rewrites the same minutes. After that rewrite, Now’s assertion is gone. The one durable “this came from the Now plan composer” mark is `Task.attributes.headerTracking`.

### 1.2 Stored Now history

Grain is the unit one analytic should count. Persistence is where a refresh still finds it.

#### A. Presence lanes — the situational state

Now’s Current moment shows four views, fixed in `PRESENCE_SCOPE_IDS`:

| Scope id | Label | What the user is asserting |
| --- | --- | --- |
| `activity` | Activity | What they are doing |
| `location` | Location | Where they are |
| `mood` | Mood | The name of the state, plus an optional structured reading |
| `company` | Company | Who they are with |

Seeded company pens are Alone, Together, and In conversation (a child of Together, with a “Who?” variant). Activity, Location, and Mood start with their own pens; a new name typed in Now calls `ensureScopePen` and becomes a pen on that view (`lastUsedAt` stamped on the stroke).

**Write path.** Clicking a lane opens Update state.

- **Now / Add for now / Update** calls `applyScopeNowUpdate(scopeId, name, now, span)`.
- **Recent sequence / Save sequence** calls `paintScopeSequence(scopeId, today, steps)`.

Both paint `useTimeTrackingStore` (`brain2-timegrid-store`). There is no second copy.

| Field on the resulting `TimeEntry` | Grain | Meaning for Now | Persistence |
| --- | --- | --- | --- |
| `id` | one block | Identity. Splits and merges mint new ids. Do not treat id lifetime as dwell time | Yes |
| `date` | local `YYYY-MM-DD` | Calendar day of the **occupancy**, not of the click | Yes |
| `scopeId` | view | Which lane | Yes |
| `penId` | primary pen | The value, unless mood display prefers `moodReading.word` | Yes |
| `title` | optional string | On a **new** pen, Now stores the typed name here. On a continued neighbor, Now copies the neighbor’s `title` | Yes |
| `startMin` | minute past local midnight, inclusive | Start of occupancy | Yes |
| `endMin` | exclusive | End of occupancy. A block covering “now” ends at the current minute + 1, never through midnight | Yes |
| `kind` | omitted or `"instant"` | Now’s lane stamps are intervals. Instants do not count as presence | Yes |
| `precision` | omitted = definite; `"estimated"` = speculative | Set when a sequence step is estimated, or when a now-stamp **continues** an already estimated neighbor | Yes |
| `clockCertainty` | omitted = exact; `"estimated"`; `"unknown"` | Sequence estimates store `"estimated"` alongside `precision`. Inherited continuation copies `"estimated"` only | Yes |
| `splitAfter` | boolean seam | **Add for now** on an unchanged value forces a seam so the same pen stays two blocks | Yes |
| `moodReading` | see below | Copied forward when Update continues a neighbor that already had one. The Now lane picker does not edit the nine ranks | Yes |
| `spanId` | string | **Not set** by the Now stamp or the sequence painter. Present on Working-on paints (below) | Yes when some other writer set it |
| `secondaryPenIds`, `variantIds`, `tagIds`, `notes`, `generatedBy`, `estimateOf`, `switchFrom` / `switchTo` | various | Not written by Update state. A pen link may still fill a **blank** minute in another scope as a side effect of the stroke | Yes |

**There is no `createdAt` or `updatedAt` on `TimeEntry`.** The minute the block names is the only clock. You cannot tell a 14:00–14:07 block that was asserted at 14:07 from one painted at 18:00 about the afternoon, except by the behavioral fingerprint of a now-stamp (it erases later minutes on that view today, and an open stamp begins at the previous block’s `endMin`). That fingerprint is not a reliable filter: the Time Grid can produce the same shape.

**Span modes, and what they do to history.**

| UI | `span` | Stored shape | Question it can answer |
| --- | --- | --- | --- |
| Value **changed**, or lane was empty. One button, **Add for now** | `open` | Fill from the previous block’s end (or from this minute, if nothing precedes, or if something already covers now) through the current minute. Minutes after now on that view today are erased | “What did the user claim has been true since the last log?” The claim **replaces** that stretch. The previous pen on those minutes is deleted |
| Value **unchanged**, **Update** | `open` | Same fill. Adjacent same-pen blocks merge unless a seam exists, so this often lengthens one block | “The user confirmed the running value still holds.” Confirmation is not a new row |
| Value **unchanged**, **Add for now** | `minute` | Paint only this minute. If the same pen already covers it, split there. If the same pen ends exactly on this minute, set `splitAfter` so the new minute stays a second block | “The user re-asserted the same value as a new beat.” This is the only stored mark of a **correction-in-place that kept the old value visible as a neighbor** |

`presencePaintStart` is the rule for `open`: a covering block means “do not rewrite history, paint this minute only”; a gap after a prior log means “fill the open stretch”; nothing earlier today means “this minute only.” `presencePaintEnd` is `min(floor(now) + 1, 1440)`. Future minutes are cleared with a null pen. A now-stamp is also a **deletion of the rest of today** on that lane.

**Questions the lanes can answer, once reconstructed:**

- What value occupied each scope at minute `t`, when a non-instant block covers `t`.
- How long a value dwelled, as `endMin - startMin`, with seams (`splitAfter`) keeping same-name beats apart.
- Which minutes were estimated rather than exact.
- Which pen was used, including pens Now created.
- The latest ten non-instant blocks on a view (`recentScopeSequence`) — a window, not a separate store.

**Questions they cannot answer:**

- When the user clicked, as distinct from the minute the block covers.
- How many times they opened Now.
- What the previous value was after an `open` overwrite.
- Whether the stamp came from Now, the Time Grid inside the Tracking pane, the Home desk, or ingest (`currently` / `switchScopePen` still paint through end of day; Now does not).

#### B. Mood reading — the only structured “inner state” on a stretch

`MoodReading` lives on a mood-scope interval. Now’s lane shows `moodReading.word` when it is set, otherwise the pen name. Update state does not open the rank plates. It can only **carry an existing reading forward** when the continued neighbor has one.

| Field | Scale | Empty means |
| --- | --- | --- |
| `word` | free text | Use the pen name |
| `sensation`, `vibe`, `narrative`, `reframe`, `about` | free text | Omitted, never `""` stored as a blank mark |
| `tone` | `pleasant` \| `unpleasant` \| `neutral` | Unset |
| `energy`, `tension`, `loop`, `sociability`, `initiative`, `cast`, `enjoyment`, `grasping`, `knowing` | integers 1–10 | Unset. Never stored as 0 |

Water plate: `cast`, `sociability`, `initiative`. Marks plate: the other six. A derived sentence is not copied into `notes`. Different readings refuse to merge, so a mood change that also changes the reading stays two blocks.

Until a reading is actually stored, mood analytics is **categorical** (pen / word), not a 9-dimensional trajectory. The tab should not invent ranks.

#### C. Events and thought process — point assertions

`NowLogLists` writes through `submitTrackingLog`, the same function as the Home Tracking log. From Now the call is fixed:

| List | `mode` | `clock` | `minute` | Stored shape |
| --- | --- | --- | --- | --- |
| Events | `event` | `"exact"` | now, if the day key is today; else 08:00 | Activity **instant**: `kind: "instant"`, `startMin === endMin`, pen Text log, `title` = the phrase, `eventKind` = slug of the phrase |
| Thought process | `thought` | `"exact"` | same | Activity instant, pen Text log, `eventKind: "thought-process"`. First line is `title`; later lines are `notes` |

Grain: one instant, duration 0. Instants are **invisible to presence**. A thought at 14:07 does not make Activity “current.”

`eventKindSlug` lowercases, strips punctuation, and collapses spaces, so “left room” and “Left room.” count as one phrase. The list copy on Events says any repeated phrase can be counted later. That count is a frequency over instants, not a duration.

No location is attached from this composer (`locationPenId` is omitted). No estimate flag is offered here; Now always sends `clock: "exact"`. The Home log can mark the same kinds estimated or unknown. A row with `clockCertainty: "estimated"` did not come from this composer’s current buttons, but Analytics cannot prove the converse: an exact instant might have come from the desk.

`createdAt` is absent. For a Now submit, `startMin` is the minute of the click **if** the user did not later move the instant. That is a proxy for assertion time, contaminated by every other writer of Activity instants.

#### D. Wellbeing datapoints — the only dual clock

The Metrics key on Current moment opens `MetricLogger` / `MetricLoggerButton`. It writes `useMetricsStore` (`brain2-metrics-store`). The same panel exists elsewhere; a datapoint does not record which door logged it.

| Field | Grain | Role |
| --- | --- | --- |
| `id` | one snapshot | Identity |
| `at` | local `YYYY-MM-DDTHH:mm` | The minute the reading **applies to**. Editable, so it can be back-logged |
| `values` | subset of five integers, each clamped and rounded to 0–100 | `joy`, `suffering`, `alignment`, `selfSatisfaction`, `situationalSatisfaction`. A key left blank is absent, not zero |
| `context` | short text | What was happening |
| `details` | longer text | Free annotation |
| `createdAt` | `Date`, wall clock of the insert | **When the row was written.** Distinct from `at` |
| `colors` | per-metric hex on the store, not on the row | Display only. Not a sample |

This is the one Now-adjacent series where **update latency is identified**: the user can name a past minute and the store keeps both clocks. Back-log is a feature, not an error.

Questions: level and co-movement of the five scores; gap between the minute named and the minute written; whether a score was left out; text context at that minute. Not: which surface opened the logger.

#### E. Working on — a live pointer that leaves a recoverable start

Current moment embeds `WorkingNowStrip`. It is the Operations clock, not a private Now session. Start / stop / tick live in `lib/operation-work-session.ts`. The blob in `useWorkSessionStore` (`brain2-work-session`) holds **at most one** session:

| Field | While live | After stop |
| --- | --- | --- |
| `operationId` | which operation | Cleared. The painted blocks and the operation’s `timeLogs` remain |
| `startedAt` | ISO timestamp, **seconds** | Cleared from the singleton. Encoded in Tracking `spanId` as `work-${startedAt}` if that id survives merges |
| `title` | operation name at start, copied onto the block title | On the blocks and on `timeLogs` |
| `scopeId`, `penId` | where it paints | On the blocks |
| `trackingEntryIds` | ids of the live slices | Cleared with the session. Ids on the entries remain until a merge replaces them |
| `pausedAt` | ISO of the open pause | Cleared. Not a history of pauses |
| `pausedAccumMs` | completed pause milliseconds | Cleared. Elapsed math uses it only while the session object exists |

Paint is minute slices (`splitIntoDaySlices`). The clock starts at the exact second; the block starts at the minute that contains that second and grows on tick (`WORK_SESSION_TICK_MS`). Tick is silenced from undo. Stop writes Done / `timeLogs` / `actualDuration` on the operation.

A second, independent singleton is the pen-color session (`brain2-pen-color-session`, `lib/pen-color-session.ts`): `penId`, `scopeId`, `title`, `startedAt`, `trackingEntryIds`, `pausedAt`, `pausedAccumMs`. Span id `pen-color-${startedAt}`. It does not write a Done row. Current moment does not render that strip; it only **reads** the session as a live presence hint if one is running. Do not describe pen-color as a Now control. Do count its hint when explaining why a lane can say “current” with no covering block.

The **usually ~N** chip is computed at render from the median of past `timeLogs` / unflagged `actualDuration` for that title or type (`usualDurationMinutes`). It is not stored on the session.

#### F. Short plan written from the Plan pane

`createHeaderPlan` (`lib/header-tracking-plan.ts`) is the Now-native plan write. One save produces three copies of the same intention:

1. A `Task` per action (`useTaskStore`).
2. A `PlannedAction` placement (`source: "todo"`, `sourceId` = task id).
3. One day-plan append-log line, titles joined by newlines (`appendPlanEntry("day", date, …)`).

| Task field set by the composer | Grain | Notes |
| --- | --- | --- |
| `id` | `htk{index}-…` | One step |
| `title`, `description` | text | Same string |
| `stage` | `"scheduled"` | Not completed by the save |
| `createdAt` | `Date` at save | **Assertion time of the plan**, shared by every step in that save (same `createdAt` instant) |
| `scheduledDate` | local day | The Plan pane’s day, which can differ from today |
| `scheduledTime` | `HH:mm` | Chained: step 0 starts at the chosen start; step k starts when step k−1 ends |
| `estimatedDuration` | minutes, rounded | The length the user typed. This is the plan, not an observation |
| `startCertainty` | `"estimated"` if the start clock was checked est., else `"exact"` | Applied to **every** step in the save, not only the first. “After dinner” sets 19:00 and estimated. “Right now” sets the current minute and exact |
| `attributes.headerTracking` | `"plan"` | **The provenance bit.** Desk-scheduled tasks do not carry it |
| `lists` | `[]` | Not filed onto a list by this writer |

`PlannedAction`: `id`, `date`, `startTime`, `endTime`, `title`, `notes`, `source: "todo"`, `sourceId`. No `createdAt`. No estimated flag of its own. The estimate lives on the task’s `startCertainty`. Agenda click-drag calls the same writer with `startEstimated: false` and the placeholder title `"Planned action"`.

Rename and retime call `commitItemEdit` with source `"header-tracking"` and order `"observed"`. That appends an `ItemActivityEntry` (`brain2-item-activity`, cap 200 per item): `itemId`, `at` (ISO of the edit), `summary`, `changes[]` (`field`, `from`, `to`), `source`, `order`. **Creation does not write this ledger** (`addTask` is used directly). The ledger is the history of later corrections to a Now plan, not of the original save.

The day-plan line is an `AppendLogEntry`: `id`, `createdAt` (writing time, or null on legacy plaintext), `text`, optional `stampSuffix`. Ordinary UI submits omit `stampSuffix`, so a Now plan line is not distinguishable from a line typed on Home → Plan except by matching the text to the tasks saved in the same minute.

**Present in the module, not called by the Plan pane:** `recordPlanFollowed`, `recordPlanSkipped`, `insertUnplanned`. Tests use them. The dialog does not. If they are wired later, they would store:

| Writer | Stored result |
| --- | --- |
| Followed | Task `status: "done"`, `actualDuration`, `durationCertainty`, `timeRough`, `completedDate`, a `TimeLogEntry`, and a `FieldEstimate` on `actualDuration` when the length was copied from the plan or marked approximate (`kind: "logged"`, `generatedAt`, `basis` text). Order on the ledger is `"derived"` when estimated, `"observed"` when a typed length is exact |
| Skipped | `status: "missed"`, `missedAt`, `stage: "list"`. Ledger source still `"header-tracking"` |
| Unplanned | New completed task, `attributes.headerTracking: "unplanned"`, `loggedAction: true`, `notes: "Not on the plan"`, optional estimate |

Until those buttons exist, Analytics must not pretend skipped / followed / unplanned rows are coming from Now. It may still read `headerTracking: "plan"` tasks and their later `timeLogs` if some other surface completed them. That completion is an outside join.

`derivedDurationGap(planned, actual) = round(actual) - round(planned)` is a pure function. The UI is specified to mark that difference estimated because it is calculated. It is not a stored field.

#### G. Day notes on the Tracking pane

`TrackingDayNotes` with `forceOpen` for **today** (the grid’s day, not a navigable day inside this pane). `appendDayNote` writes the shared day-notes log: `AppendLogEntry` keyed by local date, `createdAt` defaulting to the write. Same log as the Home desk. No Now provenance.

#### H. Item-activity lines with source `header-tracking`

Grain: one field change on one item, at an ISO timestamp, never rewritten. Useful questions: how often a Now plan step is renamed or retimed after save; latency from `Task.createdAt` to the first ledger `at`; whether duration edits move toward or away from the original `estimatedDuration`. Useless for presence, mood, or dialog use. Capped at 200 lines per item; older lines drop.

### 1.3 Live pointers into other sections

Now renders these. They are not Now-native signals.

| Surface | Reads | Writes if the user edits inside the dialog |
| --- | --- | --- |
| Tracking pane `TimeGrid` | Full time-tracking vault for the grid’s day / week | Ordinary paints. Same store as presence. No Now tag |
| Plan pane agenda | `useEventStore` events, tasks scheduled that calendar day, planned actions | Drag-create goes through `createHeaderPlan` (that part is Now-native). Other agenda edits are Plan |
| Plan pane “Today’s plan” list | Planned actions for the pane’s day, joined to tasks for title and `startCertainty` | Rename / retime are Now writers (ledger source `header-tracking`) |
| Day plan composer | `getPlanEntries("day", dayKey)` | Append is shared with Home Plan |
| Current moment lanes | `trackingScopeStatuses` over **all** scopes, then the UI keeps the four presence ids. Covering block wins; else a live work or pen-color hint; else the latest interval that has already started; else empty | The read is derived. The write is Update state |
| Recent sequence list | Last 10 non-instant blocks on that scope, any day, oldest of that window first | Display only until Save sequence, which paints today |
| Working-on “usually ~N” | Historical `timeLogs` / durations on tasks of that title or type | Display only |

`loggedAt` on a lane is **not** an assertion timestamp. It is the latest minute that fact still names: if the block covers now, `min(last occupied minute, now)`; otherwise the last occupied minute of the latest started interval (`endMin - 1`). An empty lane has `loggedAt: null`. A live hint with no covering block reports `kind: "current"`, `estimated: false`, and `loggedAt` = this minute, even though nothing was written.

`kind` is `current` | `last` | `empty`. The Home tile’s caption “Now” vs “Last” is the same idea: any of the four lanes current ⇒ Now, else Last. That caption is computed, not stored.

Screen Time and the iPhone views are scopes in the vault. The Now README keeps them off Current moment. Do not put them on this tab except as an outside join, named once.

### 1.4 Ephemeral, and therefore invisible

| Thing | Lifetime | Why it matters |
| --- | --- | --- |
| Dialog `open`, pane `"tracking" \| "plan"` | `useState` in `CognitiveState`. Close resets the pane to tracking | Session rhythm of **checking** Now is not data |
| Selected lane, the name in the pen field, sequence draft rows, the est. checkbox, the hint sentence (“Saved through this minute.”) | Component state | A failed or abandoned stamp leaves nothing |
| Pen menu query | Component state | Search-without-choose is invisible. A choose that then isn’t saved is invisible |
| `useTrackingUndoHotkey` while the dialog is open | In-memory `action-history`, max 40 snapshots, labels like `"paint"` / `"erase"`, **no timestamps** | Undo can remove the only copy of an assertion. Redo is the same stack. Neither is a dataset |
| Live presence hint | Derived each render from the singleton session | Can disagree with the vault for the minutes before the first paint lands |
| “Not a ticking clock” | `useCurrentMomentLanes` recomputes when entries, scopes, or the session identity change, not every minute | The **displayed** `loggedAt` can sit still between store writes. Analytics should read the vault, not scrape the label |
| Capture-door bus | Window event, in-memory notes label | Not Now |

### 1.5 What you can reconstruct anyway

Define a **presence frame** at local minute `t` on date `d` as the 4-tuple of covering intervals:

```
state(d, t) = (
  activity pen or title at t,
  location pen or title at t,
  mood word or pen at t,
  company pen at t
)
```

A component is **missing** when no non-instant interval on that scope covers `t`. Missing is not a value called “empty” in the data — the UI’s “—” is that absence. Do not impute it as a state in a Markov chain.

A component is **stale-last** when the UI would show `kind: "last"`. That is a display rule (most recent interval with `startMin <= now`). It is not occupancy. Analytics of “what was true” must use coverage, not the last-known label. Analytics of “what the dialog would have shown” may use last-known, and should label it as the fallback the user saw, not as fact.

**Joint state** is the tuple of the components that are present. That tuple is the closest thing the vault has to a cognitive-situational state. It is high-frequency (1-minute grain) and short-horizon (meaningful over hours, ragged over months wherever the user did not paint).

---

## 2. Metric catalog

Names below are the series an Analytics tab should compute. Each one says whether the inputs exist today.

### 2.1 Presence

**Coverage.** For scope `s`, day `d`:

```
coverage_s(d) = (1 / 1440) * |{ m : some non-instant entry on s covers (d, m) }|
```

Union coverage across the four lanes uses the union of covered minutes, so a day logged only as Location still counts. Pairwise coverage is the minutes where two named scopes are both filled.

**Occupancy of a value.**

```
minutes(s, pen) = Σ (endMin - startMin) over intervals on s with that pen
```

Mood display minutes should use `moodReading.word` when set, and report the pen as a second key so a word and a color are not silently mixed.

**Gap.** A gap is a run of uncovered minutes bounded by two intervals on the same scope, or by midnight. Gaps are the unlogged present. They are the right denominator for “how much of the day Now could have named.”

**Current vs last, as a snapshot statistic.** At a chosen minute (default: the latest minute in the vault, not wall-clock “now” if the app is closed):

```
lane_status_s = current | last | empty
```

using the same rules as `classifyScope`, **without** the live hint (the hint is not historical). Share of days whose last painted minute still has all four lanes current is a completeness score.

### 2.2 Update latency

Only the wellbeing datapoint has both clocks.

```
lag_min(p) = minute(p.createdAt) - minute(p.at)
```

in local time. Positive lag means the reading was written after the minute it names (a back-log, or a slow check-in). Zero means same-minute logging. Negative means `at` was set in the future relative to `createdAt` (clock edited forward, or clock skew).

Summaries: median, 90th percentile, share with `lag_min = 0`, share with `lag_min > 60`. Split by whether all five keys are present or only a subset.

**Do not** compute this for presence blocks. They have one clock. Label any “latency” inferred from block end ≡ wall clock as unavailable.

Proxy, explicitly weaker, for events and thoughts submitted with an exact clock: there is still only `startMin`. Latency is unidentified. You may plot the **time-of-day histogram of instants**, which mixes assertion time and backfilled time.

### 2.3 How often the moment is corrected

A correction, in this vault, is one of three stored shapes. Count them separately. Do not add them into one fake “correction rate.”

| Measure | Formula | What it captures | What it misses |
| --- | --- | --- | --- |
| **Seam re-assertion** | Count of intervals with `splitAfter` whose following neighbor is the same scope and same pen and starts at `endMin` | User chose **Add for now** on an unchanged value (or any other scissors cut) | An Update that lengthens one block leaves no seam |
| **Value change** | A transition: interval A on `s` ends where interval B on `s` starts, and `penId` differs (mood: word differs) | The occupant changed | An overwrite of the same minutes destroys A. The change is invisible; only B remains |
| **Plan correction** | Item-activity rows with `source = "header-tracking"` | Rename / retime after a Now plan save | The original save itself |

**Correction rate, value changes only** (the one that is identified):

```
switch_rate_s(d) = (number of pen changes along s on d) / max(1, occupied minutes on s that day)
```

Per hour is more honest than per day, because coverage varies.

**Inherited estimate** is a fourth, quieter event: a now-stamp that continued an estimated neighbor stores `clockCertainty: "estimated"` on the extended block. The exact/estimated bit was not re-asked. Count minutes that are estimated because they were extended, versus minutes whose sequence step was explicitly estimated. You cannot always tell those apart after a merge: both look like `precision: "estimated"`.

### 2.4 Cognitive-state trajectories

There is no stored cognitive-state machine. Build the trajectory from data that exists.

**Categorical trajectory.** The step function `state(d, t)` from §1.5. Sample every minute that has at least one lane, or only minutes with all four (publish both; the complete-case subset is biased toward diligent logging).

**Mood-rank trajectory.** For each `MoodRankKey`, the series of 1–10 marks on mood intervals, held constant across the interval (it is not a per-minute sample). Point plots at `startMin`, not interpolated ramps. Unset ranks stay missing.

**Wellbeing trajectory.** For each `MetricKey`, points at `at`, values 0–100. This is an irregular point process, not a 1-minute grid. Do not forward-fill a joy score across a day.

**Within-datapoint shape.** At each datapoint, the 5-vector (missing allowed):

```
affect_gap = joy - suffering          // only if both present
alignment_gap = alignment - situationalSatisfaction
```

These are descriptive contrasts, not validated scales.

**Transition trajectory.** The sequence of joint states in time order, skipping missing minutes rather than inserting a `GAP` token into the chain used for probabilities. Report the skipped mass beside the chain so a 2-state diagram is not read as a fully observed day.

### 2.5 EST accuracy

An estimate and a later truth can be compared only when **both survive**.

| Pair | Estimate | Later truth | Survives today? |
| --- | --- | --- | --- |
| Sequence step | `precision` and `clockCertainty` `"estimated"`, plus `startMin`/`endMin` | A later **exact** interval on the same scope overlapping those minutes | Only if the exact paint did not replace the estimated minutes. A normal paint replaces. **Usually no** |
| Now-stamp continued from an estimate | Inherited `clockCertainty` | A later exact rewrite | Same. The flag is on the only copy |
| Plan length | `estimatedDuration`, `startCertainty` | `actualDuration` / `timeLogs` on that task | **Yes, if something completed the task.** The Now pane does not write the actual. Work-session stop writes `timeLogs` for an operation, which is a different object than a header plan step |
| Plan start | `scheduledTime` + `startCertainty: "estimated"` | A covering Activity (or the step’s own) interval | Outside join. Both sides exist; the link is `sourceId` / time overlap, not a stored error |
| Followed-with-blank-length | `FieldEstimate` on `actualDuration`, basis “Filled from the planned length” | A later confirmed exact duration (`confirmedAt`, or `durationCertainty: "exact"`) | Writer exists; **UI does not call it** |
| Metric `at` vs `createdAt` | Not an estimate of a quantity | Lag, not error | Yes, and it is not EST accuracy. Do not put it on the calibration plot |
| “Usually ~N” vs this session | Median of past logs, shown live | This session’s eventual `timeLogs` | The chip is not stored. After stop, you can recompute the median **as of the minute before start** from older logs and compare to the new log. That reconstruction is valid |

**Calibration of a binary clock flag** is mostly undefined: once the user replaces an estimated block with an exact one, the estimate is gone, so you cannot score it. The minimum extra history in §8 is what makes this plot real.

Until then, the honest EST metrics are:

```
est_minute_share_s(d) = estimated occupied minutes / occupied minutes
```

using `precision === "estimated"` OR `clockCertainty === "estimated"` (the same test as `blockIsEstimated`). And, for header-plan tasks that later gained an actual:

```
duration_error = actualDuration - estimatedDuration
start_error_min = first timeLog start - scheduledTime
```

only where `startCertainty` or `durationCertainty` says the number was estimated, and only with a caption that the actual was written by whichever surface completed the item. `duration_error` is `derivedDurationGap`. Mean error is bias; mean absolute error is accuracy; do not pool estimated starts with exact starts.

### 2.6 Session rhythm of checking Now

**Unobserved:** dialog opens, pane flips, lane selections, abandoned drafts.

Proxies, each labeled as a proxy:

| Proxy | Definition | Confound |
| --- | --- | --- |
| Check-in candidates | Local minutes where a presence scope’s interval **ends** at that minute and the next minute is empty or a different block, and the end is not midnight | Also produced by the Time Grid and by stopping a work session |
| Writing-time pulse | Inter-arrival of `MetricDatapoint.createdAt`, day-note `createdAt`, plan-log `createdAt`, and item-activity `at` where `source = "header-tracking"` | Mixes Now with other doors |
| Work-start pulse | Parse `startedAt` out of `spanId` matching `work-*` or `pen-color-*` | Operations and the pen-color control, not only the Now strip. Now’s strip is one of the doors |
| Thought / event pulse | Inter-arrival of instants with `eventKind = "thought-process"` or an event slug | Home log and ingest share the writer |

**Inter-check interval** on a proxy series `T_i`:

```
Δ_i = T_i - T_{i-1}
```

Report the distribution in minutes, the diurnal histogram, and the share of gaps longer than 3 hours during the user’s typical waking window (waking window itself derived from Activity coverage, not from a sleep join — or left as “clock hours 8–23” with that assumption stated).

**Burstiness.** Coefficient of variation of `Δ_i`:

```
CV = stddev(Δ) / mean(Δ)
```

`CV ≈ 1` is Poisson-like checking; `CV > 1` is bursty (several stamps, then a long hole). This is the right shape statistic for a short-horizon habit.

### 2.7 State-transition rates

On one scope, collapse adjacent intervals that merged (same pen, no `splitAfter`) into one dwell. Then:

```
N_{ij} = count of dwells in state i followed by state j
P_{ij} = N_{ij} / Σ_k N_{ik}
rate_leave_i per hour = (count of leaves from i) / (hours spent in i)
```

Hours spent in `i` is the dwell denominator, so a rare long state is not called “stable” just because it rarely appears as a row in `N`.

Joint-state transitions use the tuple. The state space is large (product of pen vocabularies). Show the top 12 states and an Other bin. Do not draw a hairball of every pen ever created.

**Self-loops** (`i → i` across a seam) are re-assertions, not stays. Stays are the dwell length. Keep them in different charts.

### 2.8 Outside joins, named and not designed

These exist and would enrich Now. They are other sections’ data. This tab should link out, not absorb their models.

- Header-plan tasks vs later Activity occupancy on the same minutes (plan versus what was painted).
- Operation `timeLogs` vs the Tracking span `work-${startedAt}`.
- Habit credit from tags on the work-session pen (`syncTrackedHabits`).
- Sleep- or screentime-generated blocks (`generatedBy`) that sit under a presence lane and were not asserted in Now.
- Ingest `currently` paints, which run through end of day and will look like “current” until a Now stamp erases the future.

---

## 3. Visualizations

Now is a high-frequency, short-horizon signal: minutes, not quarters. Charts should default to **today and the last 7 days**, with an explicit coverage mask. A month view is a raster of gaps, not a smoother line.

### 3.1 Four-lane timeline (the primary view)

One horizontal band per presence scope, local midnight to midnight, blocks colored by pen. Estimated blocks use the dashed est. treatment already in the product (`~`), not a second encoding that looks like fact. Instants (events, thoughts) sit as ticks on a fifth stem under Activity, because they do not occupy the Activity band.

A vertical “as of” hairline marks the latest covered minute. Minutes with no block stay the paper color. Do not draw last-known as if it continued; offer a separate, visually quieter “last label carried forward” overlay that the user can turn on, captioned as the fallback Current moment would show.

Seams (`splitAfter`) are a thin notch, so a re-assertion is visible inside a same-color run.

### 3.2 Joint-state ribbon

Under the four lanes, one ribbon whose color is the joint tuple, broken wherever any chosen lane is missing (default: break only when all four are missing; a toggle requires completeness). This is the trajectory a Markov diagram summarizes.

### 3.3 Day raster

Rows are days, columns are hours. Cell darkness is coverage of the four-lane union, or the modal joint state. Seven or twenty-eight rows. This is how changepoints in **use** become obvious: a week of dense late-night stamps versus a week of a single morning block.

### 3.4 Markov diagram of the joint state

Nodes: top states by occupied hours, plus Other. Directed edges: `P_{ij}` with width proportional to count, not to probability (a 100% edge on two observations is a lie if width follows probability alone — show count as width and probability as the label). Drop edges with `N_{ij} < 3`. Self-loops omitted here; they belong to the seam chart.

A second, smaller diagram for **mood word only**, and a third for **company only**, because those vocabularies are smaller and stabler than Activity.

### 3.5 Dwell survival

For a selected state, a Kaplan–Meier curve of minutes until the pen changes. Censor a dwell that runs into a gap or into “now” (the block is still open). Rug plots of the raw dwells underneath. Median dwell in the subtitle.

### 3.6 Calibration plot (only for pairs that both exist)

Classic reliability diagram, not a scatter of vanished estimates.

- **X:** planned minutes (`estimatedDuration`) in bins, or planned start hour.
- **Y:** mean actual minutes, or mean start error.
- Point size: number of header-plan tasks in the bin that have an actual.
- A `y = x` reference.
- Separate panels for `startCertainty = estimated` and `exact`, so an exact plan is not asked to prove the est. flag.

For wellbeing, a different picture: **lag histogram** of `createdAt − at`, and a strip of the five scores against hour of `at`. That is timeliness, not calibration. Title it that way.

If, in the future, estimated intervals are retained after correction, the calibration plot gains a second series: estimated window vs the exact window that replaced it (start error, end error, duration error). Do not draw that series on today’s data.

### 3.7 Transition-rate heatmap

Rows “from”, columns “to”, for one scope, last 28 occupied days. Diagonal suppressed or drawn as seam counts in a side column. This is the Markov diagram’s table, better when the user wants rates rather than a picture.

### 3.8 Metric small multiples

Five sparklines, irregular points, no connecting line across gaps longer than a chosen horizon (default 6 hours — beyond that the line implies a state that was not sampled). Optional context sentence under the latest point.

### 3.9 What not to draw

- A single “Now score.”
- A smoothed mood line through missing ranks.
- Pie charts of pen share that hide coverage (a pie of painted minutes treats an unlogged day as if it did not happen). Always print the denominator.
- A realtime ticker that depends on the dialog being open. The vault does not know the dialog.

---

## 4. Statistical and learning analyses

These are the analyses worth computing on a single user’s vault. They are descriptive and predictive in the small-n sense: changepoints, simple Markov forecasts, calibration bias. They are not a population model.

### 4.1 Dwell times

For each scope and each pen with at least 5 dwells:

- Mean, median, and 90th percentile of dwell minutes.
- Share of dwells that are exactly 1 minute (the **Add for now** / single-minute stamp signature).
- Share of dwells censored by a following gap.
- Hazard in the first 15 minutes versus after 60 minutes. A state that usually dies immediately is a label the user stamps and leaves; a state that dies after a stable hour is a real occupancy.

Mood ranks, when present: within-stretch the rank is constant, so “dwell of tension ≥ 7” is the duration of intervals whose `tension` is at least 7. Compare that dwell to the dwell of the mood **word**. A long word with a short high-tension reading means the reading was not on every block of that word.

### 4.2 What precedes a state change

For a transition `i → j` on one scope, look back `W` minutes (default 30) on the **other** three scopes and at instants:

- Which activity / location / company values have the highest lift in the window before the change, versus their base rate on all occupied minutes.

```
lift(x before j) = P(x in the W minutes before a transition into j) / P(x on a random occupied minute)
```

Require a minimum count (10 transitions) before showing lift. This answers “what is already true when mood changes,” using only co-recorded Now lanes and instants.

Thought instants in the same window are a second precursor list: share of mood changes with a `thought-process` instant inside `W`, versus share of random minutes. If thoughts do not cluster at changes, the thought log is a parallel channel, not a cause the data can see.

Wellbeing points are too sparse to be precursors unless `at` falls inside `W`. When one does, show the 5-vector as a case card, not as a regression coefficient. With a handful of datapoints, a regression of “mood switch on joy” will fit noise.

Work-session start (`spanId` timestamp) as a precursor of Activity pen changes is legitimate and should be marked as a session boundary, not as a discovered cause: the session **is** the Activity paint.

### 4.3 Calibration of estimates

On the pairs that exist (§2.5):

- **Bias** `mean(duration_error)` for header-plan tasks with an actual. Positive means the plan ran long.
- **Noise** `stddev(duration_error)`.
- **Reliability by bin** of planned length (15, 30, 45, 60, 90+).
- **Estimated-start subset:** mean `start_error_min`. A systematic +20 minutes means “estimated” starts are late, not merely vague.
- **Flag honesty:** among tasks with `startCertainty: "estimated"`, the width of start error should exceed the width among `"exact"` tasks. If it does not, the est. checkbox is not carrying information. That comparison is the calibration of the **flag**, which is more important than the calibration of the clock, because the product’s promise is that an estimate is not shown as a fact.

Do not fit a model that “corrects” estimated blocks in the vault. The tab reports error; it does not rewrite Tracking.

### 4.4 Changepoints in how the user uses Now

The behavior series, one number per day:

| Series | Definition |
| --- | --- |
| `coverage_union(d)` | Share of minutes with any presence lane |
| `switches(d)` | Count of pen changes across the four lanes |
| `seam_count(d)` | Count of `splitAfter` neighbors with the same pen |
| `est_share(d)` | Estimated occupied minutes / occupied minutes |
| `instant_count(d)` | Thought + event instants |
| `metric_count(d)` | Datapoints whose `createdAt` falls on `d` |
| `plan_steps(d)` | Tasks created that day with `headerTracking = "plan"` |
| `plan_edits(d)` | Item-activity rows that day with `source = "header-tracking"` |

Run a windowed mean-shift (two adjacent windows, default 7 days, flag a day where the window means differ by more than 2 standard errors and the windows each have data on at least 4 days). This is a changepoint in **practice**, not in mood. Typical findings worth surfacing in prose: the week logging became single-minute seams; the week estimated share collapsed because the user stopped using Recent sequence; the week plan steps appeared.

Do not changepoint a series that is mostly missing. If `metric_count` is zero on 90% of days, say “metrics are occasional” and skip the detector.

### 4.5 Short-horizon forecast (the only learning that fits this grain)

A one-step Markov forecast: given the current joint state, the distribution `P_{i·}` over the next state, shown as three chips (“most often next”). Horizon: the median dwell, so the UI says “for about 40 minutes,” not “tomorrow.”

Uncertainty: if the row count `Σ_k N_{ik} < 8`, show “not enough repeats” instead of a winner. Laplace smoothing (`(N_{ij}+α)/(Σ N + α|S|)` with `α = 0.5`) belongs in the appendix of the chart, not in the headline, so a never-seen edge does not appear as a prediction.

This forecast consumes reconstructed states. It will be confidently wrong on days with low coverage, because the chain is conditioned on being logged. Print coverage beside it.

### 4.6 Diversity of the moment

Shannon entropy of occupied minutes on one scope, in bits:

```
H_s = − Σ_p p_p log2(p_p)
```

where `p_p` is that pen’s share of occupied minutes over the window. Low entropy is a day spent in one activity. High entropy with low coverage is a handful of different labels in a mostly blank day — report both numbers. Herfindahl–Hirschman on the same shares shows concentration without the log.

Entropy of the **joint** tuple is the “how many different moments” number. It saturates quickly if Activity pens are unique phrases. Prefer entropy of mood and of company, and a separate unique-pen count for Activity.

---

## 5. Within-Now combinations

Combinations that stay inside the signals Now writes or directly triggers. No habit engine, no calendar, no screen time.

### 5.1 The four lanes against each other

For every pair of scopes, on minutes where **both** are covered:

- Contingency table of pen × pen, top cells by minute count.
- Mutual information:

```
I(A; B) = Σ_{a,b} p(a,b) log2( p(a,b) / (p(a)p(b)) )
```

with probabilities over co-covered minutes only. The denominator (co-covered minutes / 1440) must be on the card. High mutual information between Location and Company with tiny overlap is not a lifestyle finding.

Questions this answers: which places are alone; which activities carry which mood words; whether company changes inside a single activity dwell (nested) or only at activity boundaries (coupled).

**Nested vs coupled.** For each company change, was there an activity change in the same minute? The share is the coupling rate. A low rate means company is an independent process the user bothers to stamp. A high rate means the two lanes are one gesture.

### 5.2 Lanes against instants

At each event or thought instant, attach the four lane values covering that minute (or “unlogged” per lane). Then:

- Phrase frequency (`eventKind`) by location and by company.
- Share of thoughts whose minute has a mood block, versus share of random minutes. Thoughts logged into a blank mood are a different practice from thoughts logged on top of a named state.
- Lag from a thought’s `startMin` to the next mood pen change, in minutes. Median lag, and the share with no mood change within 60 minutes. This is “does a thought sit at a turning point,” not a causal model.

### 5.3 Lanes against wellbeing points

Join `MetricDatapoint.at` to `state(date, minute)` on the same local minute. One card per datapoint: the five scores, `context`, and the four names. Aggregate only when at least 15 points share a lane value: mean joy (and the other keys that are present) by mood word, by company, by location. Missing metric keys are excluded from that key’s mean, and the card shows `n` per key so a mean of alignment on 3 of 15 points is obvious.

`lag_min` by lane value asks whether some states get back-logged and others get logged live. Example question: are high suffering points written later than high joy points? Compare median lag, not means, because one forgotten evening dominates.

### 5.4 Working-on against the lanes

For each recovered `work-${startedAt}` span:

- Which Activity pen it painted (it should match the session pen; a mismatch means a later edit).
- Which Location and Company values overlapped the span, as a duration breakdown.
- Pause structure is **not** recoverable after stop (`pausedAccumMs` dies with the singleton). Do not show a pause chart for finished sessions.
- Elapsed active time is the sum of slice lengths. Compare to `estimatedDuration` only when the operation item is the same as a header-plan task — usually it is not. Compare instead to the recomputed “usual” median from **earlier** logs (§2.5).

### 5.5 Plan steps against the same day’s lanes

Restricted to tasks with `attributes.headerTracking = "plan"`:

- Start clock (exact vs est.) versus the Activity lane at `scheduledTime`, if that minute is covered.
- Planned chain as a column of intended blocks beside the Activity timeline (intention vs occupancy). Overlap minutes are a descriptive intersection, not a score of virtue.
- Edits in the item-activity ledger plotted as ticks on that chain: a retime moves the block; the `at` of the edit is the moment of correction, which **is** a real timestamp.

The day-plan prose log is the same text the composer appended. Show it as the note beside the chain, not as a second dataset. Do not NLP it into fake states.

### 5.6 Estimates against the lanes they sat on

Where an estimated interval still exists, list the other lanes during its window. The question is descriptive: “estimated stretches are mostly Location = transit” or “estimated stretches are the ones with no company stamp.” That is a story about when the user reaches for **est.**, which the data can tell, as opposed to whether the clock was right, which the data usually cannot.

### 5.7 Sequence saves as multi-step claims

`paintScopeSequence` can write several steps in one gesture. After the fact they are ordinary intervals. A **within-save** pattern is only recoverable when the steps still share a creation fingerprint they do not have (no shared `spanId`, no shared `createdAt`). Adjacent estimated steps on the same scope, same day, with no gap, are a **candidate** sequence, not a proven one. Label them “looks like a pasted sequence.” Do not compute transition probabilities from candidates and from live stamps in one matrix; the candidate was entered backwards or all at once, so `P_{ij}` would describe the order the user typed, not the order time passed. Offer it as a separate “reconstructed sequences” list.

---

## 6. Information architecture for a Now analytics tab

One tab. Short horizon. Four rooms, in this order, because that is the order of trust in the data.

### Room 1 — Today’s moment

The four-lane timeline for the selected day, joint ribbon, instant ticks, estimated hatching, seam notches. A side list: current or last value per lane as of the latest covered minute, with `loggedAt` formatted the way Current moment formats it (clock today, date + clock otherwise). Coverage fraction in the corner.

This room answers: “What does the vault say was true?”

### Room 2 — Rhythm

Day raster. Inter-arrival histogram for the proxies that exist, each captioned with its confound. Seam count vs value-change count. Entropy of mood and company for the week. Changepoint callouts on the daily series, in sentences (“Estimated share dropped on Oct 2”).

This room answers: “How is checking and correcting happening?” It must not say “you opened Now 12 times.”

### Room 3 — State movement

Markov diagram, dwell survival, “what else was true before this change,” coupling rate between lanes. Scope picker defaults to mood, then company, then activity, then the joint tuple.

This room answers: “How does the situation move?”

### Room 4 — Estimates and the short plan

Reliability diagram for header-plan durations and starts, only over tasks that have both numbers. Est. minute share by scope. A table of surviving estimated intervals (time, scope, name, other lanes in the window). Lag histogram for wellbeing, placed here because it is about the honesty of clocks, with a title that says timeliness rather than accuracy. Ledger ticks for `header-tracking` edits.

This room answers: “When a number was marked approximate, what else do we know?”

### Shared controls

- Day, trailing 7, trailing 28. Default trailing 7.
- Scope filter for rooms 3 and 4.
- “Complete frames only” toggle (all four lanes present).
- A persistent footnote: presence is reconstructed occupancy; dialog visits are not stored; overwrites delete the previous claim.

### Empty states

- No presence intervals: Room 1 explains that Update state has not left a block, and does not show a Markov diagram of zeros.
- Metrics store empty: Room 4 omits the lag histogram rather than drawing an empty axis that looks broken.
- No `headerTracking: "plan"` tasks: the plan half of Room 4 says the Plan pane has not saved a sequence.

### What this tab refuses to be

It does not host plan-versus-reality as a life score, screen time, habit grades, or a cognitive-state room that implies a sampler Now does not have. Those are other tabs’ joins. A single line in Room 1 can point at them.

---

## 7. Edge cases

### 7.1 Ephemeral UI with no history

Opening Now, flipping Tracking / Plan, picking a lane, typing a name, checking est., and closing without Save leave no row. Analytics must not treat “days the dialog existed in the bundle” as use. The undo stack can erase a save in the same sitting; the erased block’s id is listed in `removedEntryIds` so a merge of two snapshots does not resurrect it. Those ids are tombstones, not a change log: they do not store the deleted payload. A deleted assertion is gone.

### 7.2 Duplicate updates

Same pen, `open` span, no seam: `mergeAdjacent` folds the new minutes into the previous block. Two clicks become one dwell. Counting clicks is impossible; counting dwells under-counts confirmations.

Same pen, `minute` span: `keepMinuteSeam` splits a covering block or sets `splitAfter`. Two blocks, one value. Dwell statistics should use the seam as a boundary when the question is “how often was this re-asserted,” and ignore the seam when the question is “how long was this value true.”

Same minute, two scopes: two independent paints. Not a duplicate.

A sequence step with `endMin <= startMin` is skipped and not counted in the painter’s return value. A row that fails `parseClock` is skipped. The user may have believed they saved it. The vault has no failed-stamp record.

New pen names are case-insensitive matches (`trim` + lower). “Library” and “library” are one pen. Analytics should group by pen id, and show the stored spelling.

### 7.3 Clock skew and the one-clock problem

All occupancy is **minutes past local midnight** on a `YYYY-MM-DD` key. There is no timezone field and no monotonic write time on `TimeEntry`. If the laptop clock jumps:

- A now-stamp paints whatever `new Date()` says, and erases the “future” relative to that wrong clock.
- `createdAt` on a metric can fall on the other side of `at`.
- Work `spanId` embeds the ISO string of that same wrong clock. Later slices still agree with it; they do not agree with true civil time.

Analytics should not “fix” skew. It should flag days where metric lag is largely negative, or where a `spanId` timestamp’s minute disagrees with the block’s `startMin` by more than one minute, as **clock disagreement**, and exclude those days from lag percentiles with a visible count of exclusions.

Midnight: Now’s presence stamp does not paint past the current minute and does not wrap to tomorrow. A work session can wrap (`spanId` shared across two dates). A sequence is today-only in the Update state UI. A plan pane can target another day while Current moment stays on real today — so a plan’s `scheduledDate` and the lanes’ `date` can differ. Do not join them by accident.

The Tracking pane’s day notes and grid are pinned to `new Date()` when the pane mounts. The Plan pane has its own day state. A single Analytics “today” should be the local calendar day, not “whatever day the Plan pane was browsing.”

### 7.4 States with no duration

- Instants (`kind: "instant"`, `endMin === startMin`) have duration 0. They are excluded from coverage, dwell, and presence `kind`. Include them only as point events.
- Empty lanes (`kind: "empty"`, `loggedAt: null`) are not a state.
- A live hint can display a current name with **no interval yet** in the second before paint, or if the operation has no pen. Historical analytics never see the hint. If `penId` was empty, stop may still have written `timeLogs` without a Tracking span. Those logs are duration on the operation, not presence.
- A 1-minute block is the shortest interval. It is not an instant. Survival curves should allow a mass at 1.
- `endMin` exclusive means a block `[start, end)` names minutes `start … end-1`. `loggedAt` uses that last occupied minute. Off-by-one in a chart that treats `endMin` as inclusive will invent a phantom minute and a false overlap with the next block.
- Mood ranks left blank are missing, not 1 and not 0. Means must skip them.
- Metric keys left blank are missing, not 0. A datapoint with only `context` and no values is allowed (`canLog` is true). It is a timestamped note, not a zero vector.
- Paused time on a **finished** session is not stored. Do not impute pause as unlogged presence; the painted minutes are the active slices only, because tick and stop use `sessionActiveEnd`.

### 7.5 Overwrite, links, and inherited flags

An `open` stamp deletes from the new end through midnight on that scope. A “planned” paint later today on that lane does not survive a Now update. The tab should not interpret a hard stop at “now” as the user knowing the state would end then. It is the writer refusing to paint the future.

Pen links can fill **blank** minutes in another scope as a side effect of the stroke. Those companion blocks look like assertions. They are implications of a pen (“this place always means Social”). Where `entry-links` behavior applies, a lane can change without the user naming it in Update state. If the companion is indistinguishable in storage (it is), the tab should not claim every block was a conscious lane edit. A footnote on Room 1 is enough; detecting companions after the fact is not reliable without a source flag.

Continuing an estimated neighbor keeps the estimate. The user can believe they just logged an exact “now” while the block stays estimated. `est_minute_share` will count those minutes. The seam chart will not show a new decision. Room 4 should say that extension inherits the flag.

### 7.6 Ids that are not lifetimes

`splitEntryAt` replaces one id with two. Merges drop an id onto `removedEntryIds`. Dwell is a property of a run of minutes and a pen, computed by walking the day, not a property of `entry.id`. `trackingEntryIds` on the live session goes stale as soon as a move or merge replaces the row; after stop, trust `spanId` more than a saved id list, and trust `spanId` only until some later edit clears it.

### 7.7 Two “now” clocks on screen

Current moment’s lanes do not tick. Working-on’s elapsed clock does. A screenshot can show a lane `loggedAt` of 14:01 and an elapsed timer of 00:14:22. The vault’s block may already extend further if a tick painted and the lane memo has not rebuilt. Analytics jobs should read entries, sessions, and datapoints, never the rendered label.

---

## 8. What the persisted fields support, and the minimum history that would unlock the rest

### Supported now, without new fields

- Occupancy, coverage, gaps, and dwell for Activity, Location, Mood, and Company.
- Categorical trajectories and Markov rates on those lanes, with a missing-data mask.
- Mood-rank trajectories **where a reading was stored** (often nowhere, because Now does not edit ranks).
- Event-phrase counts and thought instants as a point process, mixed with the Home log.
- Wellbeing levels, missingness, and true write-latency (`createdAt` vs `at`).
- Estimated-minute share, and the est. hatching on surviving blocks.
- Header-plan sequences as tasks (`headerTracking: "plan"`), their chained clocks, and later renames/retimes via the item-activity ledger.
- Work-session starts recovered from `spanId`, and their overlap with the other lanes.
- Changepoints in daily coverage, switches, seams, estimate share, and plan-step counts.
- Co-occurrence and mutual information across the four lanes.
- Case-level joins from a metric minute or a thought minute onto the lanes.

### Not supported, and should not be faked

- How often Now was opened, which pane, how long it stayed open.
- Click-time of a presence stamp, as distinct from the minute it filled.
- The value that was overwritten by an `open` update.
- Whether an exact Activity instant or an estimated block was produced by Now rather than the desk, the grid inside the Tracking pane, or ingest.
- Calibration of an estimated interval against a later exact interval, after the later paint has replaced it.
- Pause history of a finished work session.
- A sampled cognitive-state enum. The `CognitiveState` component is the door, not a logger.
- Followed / skipped / unplanned, until those writers are actually called from the pane.

### Minimum extra history

One append-only **assertion log**, written beside the paint, never updated in place. One row per successful Now gesture:

| Field | Why |
| --- | --- |
| `assertedAt` | ISO time of the click, including seconds |
| `clientNow` | The `Date` the painter used, so skew is visible against `assertedAt` if they ever diverge |
| `gesture` | `now-open` \| `now-minute` \| `sequence` \| `event` \| `thought` \| `metric` \| `plan` \| `work-start` \| `work-stop` \| `dialog-open` \| `dialog-close` \| `pane` |
| `scopeId`, `penId`, `name` | What was claimed |
| `spanStart`, `spanEnd`, `date` | The occupancy written |
| `estimated` | The flag **this gesture** set, before inheritance |
| `previousPenId` | The pen on those minutes before the paint. This is the overwritten truth |
| `entryIds` | Ids after the paint, so a later merge can still be traced |
| `origin` | `"now"` vs `"grid"` vs `"desk"` vs `"ingest"` if the same log is reused by other doors |

`dialog-open` / `dialog-close` / `pane` are the entire session-rhythm dataset. They do not need a pen.

Keep replaced intervals (or at least `previousPenId` plus the old `startMin`/`endMin`/`precision`) so calibration has an estimate and a later exact. Do not rely on undo snapshots; they are in-memory and cap at 40.

With that log, the tab’s Room 2 can count real check-ins, Room 3 can condition transitions on gestures rather than on merged dwells, and Room 4 can draw the calibration plot the est. flag was meant to earn. Without it, the tab should stay inside the list in “Supported now,” and its footnote should stay visible.
