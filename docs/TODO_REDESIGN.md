# To Do redesign plan

Home → To Do. _Last mapped: 2026-10-15._ **Status:** Phases 0–2 shipped on 2026-10-15. Phases 3–7 are planned. `Task.penLinks` exists and the clock uses it; Phase 5 adds editing it from item detail and pen settings, plus totals.

The room's current behavior is [`components/Home/ToDo/README.md`](../components/Home/ToDo/README.md). The house order is [`DESIGN_STYLE.md`](DESIGN_STYLE.md): failures first, then layout, then palette. Tidy is the model for plans and for "currently working on", and its internals are mapped in [`components/Modules/README.md` → Tidy internals](../components/Modules/README.md). To Do copies Tidy's patterns but never imports `TidyView`, which the Modules room keeps private.

**Rule for every phase: break nothing.** Every row verb, keyboard key, lens, ritual row, mark, Done/Missed/Undone well, load strip, undo path and outside import listed in the To Do README keeps working. Each phase ships with its tests, and `todo-panel.test.tsx` and `todo-utils.test.ts` stay green throughout.

---

## The use case this is built for

> "Plan for the next 3 hours. Bare minimum: CDs almost done, on track to finish tonight."

Today that takes four rooms and still does not add up:
1. Break **Finish CDs** down until every step has an estimate.
2. Pick the steps that fit three hours.
3. Order them so prerequisites come first.
4. Work through them one at a time, with a clock.
5. Know when the bare minimum is met.
6. Have the time land in Tracking under the CD pen, and show on the item.

The plan below makes that one flow, starting from the To Do tab.

---

## What is wrong now (diagnosed)

| # | Complaint | Cause |
|---|-----------|-------|
| F1 | Pushes do not line up; nothing lines up with the head labels | The head is a three-column grid (`todo-chrome.css` ~821). Each row is a free `flex` line (~891). The push tube sits inside the name cell (`TodoTable.tsx`, `.todo-row-nameplate`), so it slides with the length of the name. The step chip only renders when there are steps, and Delete changes width when it is hovered, so every cell after them moves too. |
| F2 | Required / Prioritized are lost after a push | Marks are keyed by `(period, periodKey)` (`lib/todo-commitment.ts` `markKey` ~46). No push path writes a mark for the new period. The paths are `pushTaskOnePeriod` (`lib/item-utils.ts` ~485, reached through `services/scheduling-service.ts` `pushTask` ~151), `pushUndoneFields` (`lib/scheduling.ts` ~577), `autoPushOneStep` (~288, looped by `autoPushUntilCurrent` / `rollUpScheduleFieldsCascaded`, run by the day rollover) and `pushYearUndoneFields` (~623). |
| F3 | White text where it should not be | `.todo-glass-q` / `.todo-glass-well` set `color: #e8eef6` (`todo-chrome.css` ~1750). The `<input>` inherits it, so typed text is white on a white field (the "con" in the screenshot). The prompt line is light grey on grey. |
| F4 | Just Start step is unreadable | `.just-start-step h1 { color: #f8fafc }` (`components/Focus/just-start.css` ~69) loses to `html[data-pcb-ink="dark"] body.win95-app h1` (`app/pcb-backdrop.css` ~102, dark ink with a light emboss) and `body.win95-app h1` (`app/win95.css` ~274). Result: dark text with a ghost outline on a dark panel. |
| F5 | Just Start picks the wrong step | `nextMolecularStep` (`lib/molecular.ts` ~116) looks at **top-level** steps only: the first `isMolecular` one, else the first incomplete one. It never descends into nested steps, ignores estimates and prerequisites, and always runs a fixed 2:00. |
| F6 | Docs disagree with code | The To Do README says Push goes through `task-store`; it goes through `services/scheduling-service.ts`. The Focus README and `lib/README.md` say Just Start picks the "single smallest" step and "recursively splits"; the code does neither. Both are corrected in this pass. |

Also found, kept on purpose: the parent step marker is a star (`.todo-via.is-parent` clip-path). Star icons stay.

---

## Scenario 2: a live working log (CD design for a band)

Real notes, typed in the moment while doing **Finish CDs**:

```
6:30ish started making mockups
8:06 finished making mockups, also organized files in foxtide folder,
     now quick sketch summarizing what needs to be done for each
(I expected this to take 10m?! maybe just the thinking about it. Expect that to take ~15m?)
to do for chaos: disc still done
Overall: fix wood, get better wood, harvest wood
insert: reformat insert, moving back to new template and signatures next to album cover,
        photos on wood and detailed credits on the other side (find and place good photos on the wood)
8:24 been actually doing cd inside for a bit
Back/holder – Chaos: create files · plan what you're going to do · try photo instead of color blocks…
Back: remove extra text at bottom, fix foxtide and position (reformat back like ent) · bring back in ·
      save and export (package) · add spines (see what we did for vinyl)
Inside holder: confirm wood · confirm hidden message
NOW 8:47 looking for photos of band
```

That is four kinds of information at once. Each one needs a home.

| In the notes | Kind | Where it lands after this plan |
|--------------|------|--------------------------------|
| `6:30ish started making mockups` / `8:06 finished` | A timed span, with a rough start | A Tracking block on the task's pen, 6:30 (`~`, estimated start) to 8:06. It becomes the actual time of the step **make mockups**, and a `timeLogs` entry on Finish CDs. |
| "expected 10m … maybe just the thinking about it" | An estimate miss, and why | The step keeps its estimate snapshot (10m) next to its actual (96m). The review shows the miss and asks for a one-line reason, saved on the step. The reason offers the split it suggests: **Split: think 15m / do the rest**. Per-task misses feed a learned multiplier for the fit gauge (Phase 4). |
| `disc still done` | Status of a branch | Chaos › disc stays ticked. A line that names an existing step and says done ticks it, or confirms it if it is already ticked. |
| `Overall: fix wood, get better wood, harvest wood` | Cross-cutting steps | Steps on the task itself (not under one CD), in that order, each needing the one before. `confirm wood` under Inside holder needs `get better wood` (Phase 3). |
| `insert: …` / `Back/holder – Chaos:` / `Back:` / `Inside holder:` | An outline: a heading, then bullets | Nested steps: `heading:` becomes a step, and bullets (`*`, `-`, `·`) under it become its children. Empty bullets are dropped. A parenthetical becomes the step's `context`. A trailing `(see what we did for vinyl)` stays as context, not a new step. |
| `8:24 been actually doing cd inside` | A switch, in the past | The live block's step changes to **Inside holder** at 8:24 without splitting the pen block, and a `NowObjective` stamped 8:24 records it. |
| `NOW 8:47 looking for photos of band` | What I am doing this minute | A `NowObjective` added at 8:47, matched to the step **find and place good photos on the wood**. Ticking it later gives that step a real actual. |

**How it gets in.** Three doors, one parser (`lib/work-log-parse.ts`, pure and unit-tested on exactly the text above):

1. **Paste into the lid.** The Steps fold already accepts pasted lines. It grows a **Paste as log** mode that runs the parser and shows a preview: new steps (tree), spans (clock bars), status ticks and objectives, each with a checkbox. **Apply** writes them. Nothing is written without the preview.
2. **Live, while the clock runs.** The Objectives popup takes a line like `8:47 looking for photos`. A leading clock backdates `addedAt`, and a leading `NOW` is ignored. `heading: a, b, c` adds steps.
3. **From the phone.** A new ingest phrase `now:` (alias `obj:`) adds an objective to the live clock, with the same clock words as `st:` (`at 8:47`, `est`, `~`). If no clock is running and a task was the last one on the clock today, it starts it. This sits next to `so:` in `lib/ingest/command-catalog.ts`. `so:` keeps writing the Objective pen, unchanged.

**What the session view does with it.** Opening a session (Phase 4) on Finish CDs after these notes shows:
- the outline as the pick list;
- the 96-minute mockup span as the plan's first done line;
- the estimate miss as a warning on the fit gauge ("your design steps run ~3× estimate");
- `find and place good photos` as the live line, with its clock running since 8:47.

From there, **Bare minimum** for "CDs almost done tonight" is the remaining Back and Inside-holder leaves. The gauge shows whether they fit before bedtime.

---

## Phase 0: fixes (shipped 2026-10-15)

**0.1 One column grid for head and rows (F1).**
- Define the columns once on `.todo-table` as a custom property and use it for both `.todo-table-head` and `.todo-row-closed` (CSS `subgrid` where supported, the shared template otherwise).
- Column order, as you asked (variable-width things left, pushes pinned right):

  `fold · Task (1fr) · Tier · Lamp · Progress · Time · Steps · Actions · Pushes`

- Every cell always renders, even when empty: no steps shows `–`, zero pushes shows a dim `0` tube. Hover never changes a cell's width. The Delete slot is always reserved, at its quiet weight, and only brightens on hover.
- The head gets a label over every column (Tier / Progress / Time / Steps / Actions / Pushes), with the existing Pushes legend tooltip.
- Narrow widths: Progress, then Steps, then Time collapse into the lid (container query on `.todo-table`), and Pushes stays put. The open row keeps the same grid, so the name input does not reflow the row.

**0.2 Marks follow a push (F2).**
- New `carryTodoMarks(task, period, fromKey, toKey)` in `lib/todo-commitment.ts`. It copies `required` / `prioritized` from the old period's mark to the new one, at the same grain. The old mark stays as history.
- Call it from all four push paths above, so manual Push, Undone Push, review/ritual Push and auto-push all behave the same.
- A day-review **priority** (`priorityTaskIds`) is not a mark. When a prioritized row is pushed, write a real day mark for the new day, so the jewel survives even if the next morning review is never written.
- Tests: one per path, plus auto-push across several missed days (carries hop by hop) and the week-key canonicalisation.

**0.3 Readable text (F3).**
- The glass well input gets the house field ink (`#111` on the light field). The prompt text uses `--chrome-ink-soft` on the lip, not `#e8eef6`.
- Sweep `todo-chrome.css` for light ink (`#fff`, `#e8eef6`, `#eef…`) and fix each one that sits on a light surface. Add a test that renders the open lid and checks the computed input colour differs from its background.
- Also: the stray bare via pad left on its own line under the glass well (screenshot 2) goes away. The well sits flush with the Steps fold.

**0.4 Just Start legibility (F4).** Scope the rule as `body.win95-app .just-start .just-start-step h1` (beats 0,2,3), set `color` and `text-shadow: none`, and give the step its own phosphor face, the same type as the timer. Add a test asserting the step text has contrast against the panel.

**0.5 Docs (F6).** Already corrected in this pass (see the README links at the end).

---

## Phase 1: Just Start, rebuilt (shipped 2026-10-15)

Shipped as described below, except that the ▶ on each step in the lid and the Now working hookup wait for Phase 2. `Subtask` gained `dependsOn`, `actualDuration` and `completedAt` early, so Blocked by… works today.

**Picking the step.** New pure `pickStartStep(task)` in `lib/next-step.ts` (unit-tested; `lib/molecular.ts` keeps its exports for the other callers):

1. Walk the whole step tree and keep **leaves only** (the lowest level: steps with no nested steps).
2. Drop completed leaves.
3. Drop leaves with an **unmet prerequisite** (Phase 3), and drop everything if the task's own `dependencies` are unmet.
4. Keep only leaves **with an estimate** (`estimatedDuration > 0`).
5. Choose the **lowest estimate**. Ties go to `isMolecular`, then tree order.

It returns `{ step, path }`. The path is the breadcrumb, for example `Finish CDs › Chaos › insert › disc`.

**When nothing qualifies,** say why instead of guessing:
- No leaves at all → "Break it down": the first-step question (the glass) opens in place.
- Leaves without estimates → a short list of them, each with 2 / 5 / 10 / 15 / 30 chips. The first estimate entered makes it pickable.
- All blocked → name the blocker, with **Start that instead**.

**The screen.**
- Breadcrumb eyebrow, then the step in large phosphor type with its `context` underneath.
- The timer counts down the step's **own estimate**. An optional "just 2 minutes" opener stays as a toggle, so the old trick is still there.
- Verbs:
  - **Done**: ticks the leaf, logs the elapsed minutes, and immediately offers the next pick.
  - **Skip**: picks the next-lowest estimate.
  - **Blocked by…**: opens the prerequisite picker and re-picks.
  - **Too big**: splits the step in place into smaller steps with estimates.
  - **Stop**.
- Under the timer: "N of M leaves · X of Y min".
- Starting here sets **Now working** (Phase 2), so the header and Tracking know.

**Launch points:** the row **Start** key (as now), a ▶ on any step in the lid (starts that exact step, ignoring the picker), the item detail Subtasks tab, and a session run (Phase 4).

---

## Phase 2: Now working, built on the Tracking ▶ clock and its objectives (shipped 2026-10-15)

Shipped as below, with these choices:
- The block's `title` becomes the task name while a task rides the clock; the pen is still its colour.
- Switching to another task on the same pen stops and logs the first task, so each task keeps its own span.
- **Keep as steps** at Stop is offered by the focus bar only. The header and Tracking Stop keys stop plainly and leave free objectives on the block.
- A tied objective's actual minutes are wall time from `addedAt` to `completedAt`. Pauses inside that span are not taken off yet.

_Revised 2026-10-15 after mapping Tracking's live clocks._ Brain2 already has two of the three pieces Tidy has. Phase 2 joins them rather than adding a third clock.

| Exists | What it is |
|--------|-----------|
| `PenColorSession` (`lib/pen-color-session.ts` + `-store.ts`) | Tracking's ▶ **Working on right now**. One live block of one pen, painted as it runs, with pause / resume. Shown in the Tracking NOW row and the header Now well. |
| `WorkSession` (`lib/work-session-store.ts`, `lib/operation-work-session.ts`) | Operations' **Working on this now**. Writes `timeLogs` and a Done row, and paints Tracking. |
| `NowObjective` (`lib/now-objective.ts`) | **Objectives for right now**: a free-form checklist on whichever block is live (`addedAt`, `completedAt`), mirrored onto `TimeEntry.nowObjectives`. This is already on-the-fly subtask tracking; it just is not tied to a task's steps. |

**What Phase 2 adds**

1. **The task and step on the clock.** `PenColorSession` gains optional `taskId?` and `stepId?`, and `TimeEntry` gains the same two optional fields. Old blobs read as before, and no persist bump is needed (optional fields, the store's existing rule).
   - Starting ▶ from a To Do row, a step, Just Start or a session starts the pen clock with the task's linked pen (Phase 5). If the task has no pen, it uses the pen last used for that task. Failing that, it asks once and offers **Remember for this task**.
   - Tracking's own ▶ is unchanged. It can now also pick "for task…" from the same search field.
   - One clock at a time, as now. Switching to another step on the same pen does not split the pen block. Only `stepId` changes, and the switch is stamped as an objective boundary (below).
2. **Objectives ↔ steps.** `NowObjective` gains an optional `stepId?`.
   - Typing an objective while a task is on the clock offers **Match a step** (fuzzy match on step names) or **New step under…** (the current step by default).
   - Ticking an objective that is tied to a step ticks the step. The step's `actualDuration` is the objective's `completedAt − addedAt`, minus pauses.
   - Untied objectives stay free-form, exactly as today. Nothing is forced.
   - At **Stop**, untied objectives on a task clock get one prompt: **Keep as steps** (adds them as done or open leaves with their real times) or **Leave on the block**.
3. **Step actuals.** Steps gain `actualDuration?` and `completedAt?` (optional). `effectiveDurationMinutes` is unchanged; actuals are a separate reading.
4. **Stop writes once, everywhere.** The Tracking block (already painted), a `timeLogs` entry on the task with `stepId` and the entry id (so totals do not double count), and the step actuals. It writes no Done row unless the task itself was finished. That matches the pen clock today, which writes no Done row.
5. **Status.** Starting ▶ on an `active` task flips it to `partial` (the existing in-progress lamp). The lamp means "underway across days"; the live clock means "this minute".
6. **Seen everywhere.**
   - The running To Do row and step get a live clock and a lit lamp.
   - The header Now well and the Tracking NOW row show `Finish CDs › insert › find photos` instead of only the pen name.
   - A thin **focus bar** (Tidy's `tidy-focusbar`, in To Do metal) docks at the bottom of Home with path, estimate, clock, Objectives, Pause and Stop.
7. **Operations.** An operation's Working on this now can name a task as well; it then behaves as above. The two sessions stay separate stores, as the Tracking README requires.

## Phase 3: Prerequisites that are quick to mark

- **Steps** gain `dependsOn?: string[]` (step ids inside the same task). **Tasks** keep `dependencies` (task ids).
- `lib/available-tasks.ts` grows `stepIsAvailable(task, step)` and a cycle check that refuses a link which would close a loop.
- **Ways to mark one, all writing the same fields:**
  1. **Link mode** in the Steps fold: press **Needs…** on a step, then click the steps (or, at task level, the rows) it needs. Esc ends it.
  2. A **picker popup**: a generic `PrereqPicker` lifted from the presentational `EventPrereqPicker` (`components/Home/Plan/event-prereq-picker.tsx`). The Plan event dialog keeps using it unchanged. Candidates are steps in this task and open tasks.
  3. **Blocked by…** from Just Start.
  4. Item detail → Dependencies (exists for tasks; gains steps).
- **Display:** a blocked step or row shows a small lock with "needs *insert*". **Available now** (the existing filter) hides blocked steps in pickers as well as blocked rows. A session draft orders its lines with prerequisites first (topological) and warns when a needed thing is not in the session.

---

## Phase 4: Session plans (Tidy's plan, for "right now")

A **session** is a time box with three tiers of things to get done in it, worked through with a clock. Nothing is copied: lines point at existing tasks and steps.

**Model** (new `lib/session-plan.ts`, pure and unit-tested, plus a `lib/session-plan-store.ts` persisted store; past sessions are kept, because Analytics wants them):

```
SessionPlan { id, title, durationMin, startsAt?, tiers: { min, goal, excellent: SessionLine[] },
              phase: "draft" | "run" | "done", clock: { running, startedAt, baseSec } | null,
              createdAt, endedAt?, reachedTier?, note? }
SessionLine { taskId, stepId?, estMin (snapshot at start), actualMin?, doneAt? }
```

The tiers are named **Bare minimum / Goal / Excellent**. The vocabulary is shared with `lib/completion-tiers.ts`, and points use the same rules (`tiers.bareMinPoints`, `goalPoints`, `exceptionalPoints`), so a session awards points the way tiered items already do. Tidy plan tiers never scored; sessions do.

**Where you start one:**
- the To Do fascia (**Session** key, next to Add Task);
- the focus bar;
- dragging across empty time in Plan's day view;
- the header Now box.

**Draft: one popup with two panes.**
- **Left: the pick list.** A plain, flat list of everything open at any level: tasks in the current lens (day / week / month, with a lens switch), and every step inside them, indented. Search, **Available now**, and an **Unestimated** filter. Click or drag a line into a tier. This is the "regular clear list" view, and it can also be opened on its own from the fascia (**Flat list**) without making a session.
- **Right: the three tier buckets**, plus:
  - **Duration** (presets 30m / 1h / 2h / 3h, or typed) and an optional start time.
  - **Fit gauge.** A cumulative estimate per tier against the duration, using the same comfort needle as the load strip and the same Hofstadter factor. Bare minimum alone should fit, and Bare minimum + Goal should roughly fit. Tidy never compared the two; this does.
  - **Estimates are required.** A line with no estimate shows an inline minutes field, and **Start** stays disabled until every Bare-minimum line has one. Goal and Excellent lines may stay rough, marked `~`.
  - **Break it down in place.** Selecting a task line opens its `TodoBreakdown` (the same steps editor as the lid) inside the draft. Your "I first need to break down exact details and estimates" step happens here, without leaving.
  - Ordering by drag, with prerequisites forced first.
  - Optional **pen** for the session, defaulting to each line's linked pen.

**Run.**
- A countdown with pause / resume / **+15**, and the tier lamps (Bare minimum → Goal → Excellent) lighting as each tier's lines are done.
- The current line is the **Now working** line. **Next** uses `pickStartStep` limited to the session's lines, so Just Start and sessions share one brain.
- Each line shows estimate vs actual live.
- Tidy's **interstitials** idea (`interleaveInterstitials`) becomes an optional break line every N minutes.
- At 0:00, or on **End**: the review.

**Review.**
- Per line, estimate vs actual. Which tier was reached, and its points.
- Unfinished lines: **Keep for next session**, **Push**, or **Leave**.
- One sentence of note.
- **Writes out:**
  - a Plan placement for the session block (`placementFromDrop`, source `"session"`);
  - Tracking blocks for each line's pen;
  - `timeLogs` on the tasks;
  - a session record for Analytics (estimate accuracy, tier hit rate).

**Templates later:** "Evening 3h", "Morning 90m", with saved tier shapes.

---

## Phase 5: Pens on items (both directions)

People already do this: a person's company pen (`PersonPipeline { kind: "company-pen", penId }`, `lib/people-i-know.ts`) makes blocks painted with that pen theirs. Tasks get the same.

- `Task.penLinks?: { scopeId, penId }[]` is the only place the link is stored.
  - **From item detail:** a Pen picker in the Time tab (popup) and in Scheduling (page).
  - **From pen settings:** a **Linked items** field in `pen-settings-dialog.tsx`, which reads and writes the same `Task.penLinks`.
- `trackedMinutesForItem(task, entries)` in `lib/tracked-time.ts` sums blocks painted with a linked pen (primary or secondary) plus `timeLogs`. It drops duplicates: Working Now writes both a time log and a block, and the log keeps the entry id.
- **Item detail → Time** shows the total, an est-vs-actual bar, and a list of the linked pen's blocks (date, clock, minutes), as well as the time logs it shows now. **Finish CDs** with its CD pen then reads, for example: 11h 40m tracked · 300m est left.
- Starting Now working on a task with a linked pen paints with that pen, so tracking a task needs no extra step.

---

## Phase 6: Estimates and totals that agree everywhere

- **One rule:** the minutes that count = max(the typed estimate, else the default, against the sum of the steps). `effectiveDurationMinutes` already does this. Two places bypass it:
  - Plan's `handleScheduleTask` (`day-view.tsx` ~116) uses `task.estimatedDuration ?? 30`;
  - `plan-capacity.ts` sums raw estimates.

  Both switch to the shared rule.
- **Default estimate:** when nothing is typed, a default per tier (Settings, default 30m) applies and is shown as `~30` (rough). Typing replaces it. The last value you typed always wins over the default.
- **Time spent everywhere:** the To Do lid, the item detail Time tab, and Operations (whose totals today come only from `timeLogs` and miss pen-painted time) all read from `trackedMinutesForItem`. Operations rolls up its task tree the same way.
- **Usually ~N** (`usualDurationMinutes`) stays display-only. A session review can offer to set an estimate from it.

---

## Phase 7: The look

House language stays: the cool silver well, short rounded cards, nixie tier, engraved verbs, the milled fascia ([`DESIGN_STYLE.md` → Milled fascia](DESIGN_STYLE.md#milled-fascia)). No celestial or astrology costume. Star icons are welcome.

- **Ledger.** The Phase 0 grid. Head labels in Silkscreen caps sit exactly over their columns. The Pushes column is a row of plasma tubes down the right edge, so the eye can scan push counts like a meter bank.
- **Row.** The name, a step-path hint under it (when a step is Now working), and a lock when blocked. The ▶ Now key sits in the Actions group, ahead of Start.
- **Lid.**
  - All three fold labels are left-aligned. Today Flags is left-aligned while Time and Steps are centred.
  - Flags: Required / Prioritized jewels on the left; Missed / View on the right.
  - Time: the segmented control, then the field, then a readout that reads `counts 120m · tracked 3h10m · pen ●CD`.
  - Steps: unchanged cards, each with ▶ (Now), Needs…, a minutes field, its own estimate, and a done tick.
- **Focus bar.** A thin dark glass strip docked at the bottom of Home, with a phosphor clock, the same family as Just Start.
- **Just Start.** Kept in the dark focus room. The step is now as bright as the timer, the breadcrumb is a hairline eyebrow, and a progress bar shows the leaf's estimate.
- **Session popup.** The `.todo95-dialog` frame. The pick list is a ledger well; the tiers are three stacked wells labelled like the Done/Missed headers. The fit gauge reuses the comfort needle.

---

## Order of work

| Slice | Contents | Depends on | Size |
|-------|----------|------------|------|
| A | Phase 0 (grid, mark carry, ink, Just Start CSS) | — | S |
| B | `pickStartStep` + Just Start rebuild | A (CSS) | M |
| C | Step `dependsOn`, availability, link mode, `PrereqPicker` | — | M |
| D | Task/step on the pen clock, objectives ↔ steps, focus bar, ▶ keys, step actuals | — | M |
| E | Pen ↔ item link, `trackedMinutesForItem`, item detail Time, pen settings field | — | M |
| F | Estimate rule everywhere, default estimate, Operations totals | E | S |
| G | Session plans: model, draft, run, review, Plan/Tracking write-out | B, C, D (E for pens) | L |
| H | Flat list view, session templates, Analytics session record | G | M |
| I | `work-log-parse` + Paste as log + live objective clocks + `now:` ingest phrase | C, D | M |

A ships alone, first. C, D and E touch separate files and can run in parallel sessions after A. B needs C for the blocked filter, but can land first with a stub. G is the big one and comes last.

## Invariants (tests that must stay green or be added)

- Every keyboard key in `TodoTable` (arrows, Enter, Esc, D / M / P / R) and the ritual-row exceptions.
- Undo of Done and Missed through `lib/action-history.ts`.
- Outside imports from `todo-utils.ts` (table in the To Do README): same names, same behavior.
- Marks: per period, and now carried on push. Morning-review priorities still read as prioritized.
- Auto-push of **process inbox information** still moves day to day.
- `effectiveDurationMinutes` semantics are unchanged; only its callers widen.
- `molecular.ts` exports keep working for any caller other than Just Start.

## Decisions to confirm before G

1. The name: **Session** (proposed), or Run / Sprint / Block.
2. Tier labels: **Bare minimum / Goal / Excellent** (proposed, matching completion tiers), or Tidy's Bare minimum / Good / Exceptional.
3. Where past sessions live: a persisted store (proposed) or Items on a built-in **Sessions** list. Items fit the house law better and cost more now.
4. The Just Start timer default: the step's estimate (proposed), or the old 2:00 with the estimate as a second phase.
