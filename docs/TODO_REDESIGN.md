# To Do redesign plan

Home → To Do. _Last mapped: 2026-10-16._

**Status.**
- **Shipped 2026-10-15:** Phases 0–3. What they built is described in the room READMEs, not here (see [What already exists](#what-already-exists)).
- **Built 2026-10-16, not committed:** Phase 4 sessions (slices G, Q, H), Phase 5 (slice E), Phase 6 part one (slice F) and Phase 8 (slice J).
- **Next:** K, S (task half), L, and the Phase 4 leftovers.
- **Planned:** Phases 6–7 and 9–15.

Behavior as it is now lives in [`components/Home/ToDo/README.md`](../components/Home/ToDo/README.md). The house order is [`DESIGN_STYLE.md`](DESIGN_STYLE.md): failures first, then layout, then palette. Tidy is the model for plans and for "currently working on" ([Modules README → Tidy internals](../components/Modules/README.md)). To Do copies Tidy's patterns but never imports `TidyView`.

**Rule for every phase: break nothing.** Every row verb, keyboard key, lens, ritual row, mark, Done/Missed/Undone well, load strip, undo path and outside import in the To Do README keeps working. Each phase ships with its tests, and `todo-panel.test.tsx` and `todo-utils.test.ts` stay green. New fields are optional, so old vaults and backups read as before. Where a phase changes something you can see on purpose, it says so and updates the test on purpose.

---

## How this plan is laid out

Phase numbers are fixed, because other READMEs link to them. Parts group them by what they build on. Build order is in [Order of work](#order-of-work).

| Part | Phases | What it gives you | State |
|------|--------|-------------------|-------|
| 1. Foundations | 0 · 1 · 2 · 3 | One ledger grid, marks that carry on push, Just Start that picks well, a task on the clock, prerequisites | Shipped |
| 2. Sessions | 4 | "Plan the next 3 hours" in three tiers, with a clock, a review, park and resume | Built; leftovers planned |
| 3. Time that adds up | 5 · 6 | Pens on items, one estimate rule, time spent rolled up through the tree, your own pace | 5 built; 6 planned |
| 4. The look | 7 | House language for every phase, applied as each ships | Ongoing |
| 5. Rites | 8 | Morning and Night rows that follow the sun; a calmer night and a weekly check-in | Built; additions planned |
| 6. The step tree | 9 · 10 · 11 | One tree everywhere, tiers and weighted progress inside tasks, steps that are items | Planned |
| 7. Working surfaces | 12 · 13 | The To Do task card, and sessions that use the whole tree | Planned |
| 8. What to do first | 14 | Locked vs incomplete, and prerequisites that rise | Planned |
| 9. Less pressure | 15 | A gentler Just Start, neutral words, a Waiting shelf, quiet points | Planned |

---

## Decisions

| # | Question | Decided |
|---|----------|---------|
| 1 | Name for a short "right now" plan | **Session** |
| 2 | Tier labels | **Bare minimum / Goal / Exceptional** everywhere. See [Tier vocabulary](#tier-vocabulary) |
| 3 | Where sessions live | The persisted store `lib/session-plan-store.ts`, with park, resume and history (built, slice H) |
| 4 | Just Start timer | The step's own estimate (shipped). The 2:00 opener stays as a toggle |
| 5 | Steps as items | **When needed.** A step becomes an item the first time it needs to be one (Phase 11) |
| 6 | Name of the new popup | **To Do task card** ("task card") |
| 7 | Step points | **Extra**, paid on tick, on top of the task's own points |
| 8 | A top-level step with no tier | **Goal** |
| 10 | Night ritual on a future day | **Shown as now** while not done. The sun rule only touches today (built) |
| 11 | Can a prerequisite be met at a level? | **Not at first; yes later.** Phase 14 ships "met when done". [Phase 14 E](#e-later-prerequisites-met-at-a-level) is the planned follow-up |
| 12 | How unlock value fades along a chain | One link away counts in full, two links 70%, three 49%. One constant in `lib/unlock-value.ts` |
| 13 | How loud are points? (Phase 15 D) | Points keep accruing everywhere. **Step points** are hidden by default behind a **Points visible** setting. Task, tier and session points show as today |
| 14 | Waiting shelf (Phase 15 C) | **On, after 5 pushes**, with a Pace-bay setting (0 turns it off). Required and Prioritized rows never move |

Open, with a proposal that the plan builds behind:

| # | Question | Proposed |
|---|----------|----------|
| 9 | Drag steps across tasks | Allowed. `dependsOn` links that would cross tasks are dropped and named in a notice. The other choice: moves inside one task only |

---

## Tier vocabulary

_Last mapped: 2026-10-16._ One set of names for every "how done" ladder.

| Label | Short | Meaning |
|-------|-------|---------|
| **Bare minimum** | B | Did enough that it counts |
| **Goal** | G | What was intended |
| **Exceptional** | E | Above and beyond |

| Place | Stored ids | Note |
|-------|------------|------|
| Completion tiers (`lib/completion-tiers.ts`, `CompletionTiersPanel.tsx`, `AttributeSchemaEditor.tsx`) | `tier_bare_min`, `tier_goal`, `tier_exceptional` | The model |
| Points rules (`lib/points-rules.ts`) | `tiers.bareMinPoints`, `goalPoints`, `exceptionalPoints` | |
| Sessions (`lib/session-plan.ts`) | `min`, `goal`, `exceptional` | Renamed from `excellent` by slice Q (`migrateSessionBlob`) |
| Tidy plans (`lib/house-cleaning.ts` `PLAN_TIERS`) | `min`, `good`, `extra` | Labels only changed (Good → Goal). Ids stay in `module.config.houseCleaning`; not worth a module migration |
| Step tiers (Phase 10) | `min`, `goal`, `exceptional` | New |

Stored ids never change in place; a rename needs a migration. The tag on a step is `B · G · E`.

---

## Locked vs incomplete

_Last mapped: 2026-10-16._ Two relations, never mixed (R18).

| | **Parts** | **Prerequisites** |
|---|-----------|-------------------|
| What they are | What the task is made of: steps (`task.subtasks`), and step items (Phase 11, `parentTaskId`) | What must be finished **before** it can start: `Task.dependencies` (task ids), `Subtask.dependsOn` (step ids in the same task) |
| An undone one makes it | **Incomplete**: a level not reached, a percent under 100 | **Locked**: not workable yet |
| Can you work on it? | Yes, any open part | No, not until the prerequisite is done |
| Shown as | Level gauge and percent (Phase 10), `3/6` | A lock chip, "needs *Record*" |
| Code | `lib/step-progress.ts`, `levelReached` | `lib/prereqs.ts`, `lib/available-tasks.ts`, Available now, Hide locked |

- **Only a prerequisite locks.** A parent with open children is incomplete, never locked.
- **Locked is not a level.** A locked task can be 40% done. It shows the gauge and the lock.
- **A lock reaches down, not up.** A step under a waiting ancestor waits too (`openBlockers` walks ancestors), and a locked task locks all its steps. A locked step leaves its task workable.
- **Family is never a prerequisite.** `blockerCandidates` already refuses a step's ancestor or descendant. Phase 11 extends this to step items: a task cannot list its own part or parent in `dependencies`.
- **Met means done** (`hasUnmetDependencies`: a missing task, or one no longer open work, does not block). Met at a level comes later (Decision 11).
- **Words.** "Locked" and the padlock are for prerequisites only. No screen calls a task with open steps "blocked".

---

## Requests and where they land

_Last mapped: 2026-10-16._

| # | Request | Lands in |
|---|---------|----------|
| R1 | Night row hidden until sunset, Morning row hidden after; both still open from Header → Rituals | Phase 8 (built) |
| R2 | Steps are items | Phase 11 |
| R3 | Open a step's item detail in a popup on top, without losing your place | Phase 11 |
| R4 | The lid's steps look like item detail → Subtasks: clear hierarchy, no unrequested blanks | Phase 9 |
| R5 | Drag steps and branches; Shift/Cmd-click several and move them at once | Phase 9 |
| R6 | Keep ▶. Time spent per step adds up until done, compared with the estimate and the sum of the parts | Phases 6, 9 |
| R7 | A To Do task card, distinct from item detail, linked both ways | Phase 12 |
| R8 | In the card: prerequisites, quick points, mass edit, period values | Phase 12 |
| R9 | **Hide locked** in the To Do tab | Phase 9 |
| R10 | B / G / E tiers on tasks and every step; show and filter by tier | Phase 10 |
| R11 | Sessions: drag a whole step into a tier with its substeps | Phase 13 |
| R12 | Sessions: parts of one tree in different tiers | Phase 13 |
| R13 | Sessions: new tasks are session-only until **Persist** | Phase 13 |
| R14 | Completed to Bare minimum, then Goal, then Exceptional | Phase 10 |
| R15 | B % / G % / E % in the detail views | Phases 10, 11, 12 |
| R16 | Percent done weighted by the tree | Phase 10 |
| R17 | Sessions stored, paused, resumed | Phase 4 (built) |
| R18 | Parts make a task incomplete; prerequisites lock it | [Locked vs incomplete](#locked-vs-incomplete), Phase 14 |
| R19 | Prerequisites of valuable work rise up the list | Phase 14 |

**Less-pressure ideas (added 2026-10-16).** Drawn from Gabor Maté's *Scattered Minds* as design inspiration, not clinical guidance; each stands on its own as less pressure, more visible time, and smaller first steps. Ids follow the source list.

| # | Idea | Lands in |
|---|------|----------|
| UI-1 | Ghost "usually ×2.4 for you" beside an estimate | Phase 6 |
| UI-2 | A time-box ring in Just Start; time's up counts | Phase 15 A |
| UI-3 | No "should" in the chrome; neutral words | Phase 15 B, Phase 7, `DESIGN_STYLE.md` |
| UI-4 | Done well shows attention given, not only output; tier lamps as facts | Phase 15 B |
| UI-5 | "Everything else is waiting, not forgotten." under hidden things | Phase 9 |
| UI-6 | **Show next only**: a closed branch shows its next leaf | Phase 9 |
| UI-7 | Spark mark: tag steps you feel pulled toward | Phase 10 |
| UI-8 | Notice dot on rows pushed 3+ times: "What's going on with this one?" | Phase 15 B |
| UI-9 | End-of-sitting strip at Stop: "Sat 52m. Left it here:" | Phase 15 A |
| FN-1 | "Note to tomorrow-you" on park and end | Phase 4 |
| FN-2 | Your own time-blindness multiplier, seen and settable | Phase 6, Phase 4 fit gauge |
| FN-3 | "Just 25 minutes on this" time-box session | Phase 4 templates |
| FN-4 | Bare-minimum floor: suggest the smallest step that counts | Phase 4 |
| FN-5 | Sparked steps win ties; **Pull me** in Just Start | Phase 15 A |
| FN-6 | Just Start offers two or three choices | Phase 15 A |
| FN-7 | Points visible switch; step points quiet by default | Phase 15 D (Decision 13) |
| FN-8 | Waiting shelf for tasks pushed many times | Phase 15 C (Decision 14) |
| FN-9 | Night rite opens with "Put the day down" | Phase 8 |
| FN-10 | Weekly self-care check-in | Phase 8 |

The source list's FN-5 says "spark mark from UI idea 8"; it means UI-7.

### Rules that hold for all of these

- **One brain for "what is next".** `pickStartStep` (`lib/next-step.ts`) and `lib/session-plan.ts` share one ranking. Today: open, unlocked leaves with an estimate, lowest estimate first, then `isMolecular`, then tree order. As phases land, the full order is:
  1. lowest level not yet reached (Phase 10);
  2. highest unlock value (Phase 14);
  3. lowest estimate;
  4. sparked, most recent first (Phase 15);
  5. `isMolecular`, then tree order.

  Each step is a no-op for a task without tiers, `dependsOn` or sparks, so such a task picks exactly as today. Phase 15 exposes the top three as a ranked list (`rankStartSteps`).
- **One tree component.** The lid, item detail → Subtasks, the task card and the session pick list all render `StepTree` (Phase 9).
- **One progress rule.** Every percent over a step tree comes from `lib/step-progress.ts` (Phase 10).
- **One lock rule.** Locked comes only from prerequisites (`lib/prereqs.ts`).
- **One unlock rule.** How much waits on a task or step comes from `lib/unlock-value.ts` (Phase 14).
- **One pace rule.** Your estimate-vs-actual multiplier comes from `lib/estimate-pace.ts` (Phase 6), for the fit gauge, the ghost figure and the review.
- **Item detail is the item. The task card is this period's work on it.** Each has a key that opens the other.
- **No "should".** No UI text tells you what you should do (Phase 15 B).

---

## What already exists

_Last mapped: 2026-10-16._ Shipped or built pieces later phases build on. Details live in the linked READMEs.

| Piece | Where | Documented in |
|-------|-------|---------------|
| One grid for head and rows; Pushes pinned right; every cell always renders | `todo-chrome.css`, `TodoTable.tsx` | To Do README |
| Marks carry on push (`carryTodoMarksPatch`) from every push path | `lib/todo-commitment.ts` | To Do README → Required, prioritized, assigned |
| `pickStartStep`, `placeSteps`, `stepPath`, `blockerCandidates`, `finishStep`, `splitStep` | `lib/next-step.ts` | `lib/README.md`, Focus README |
| Just Start: own-estimate countdown, Done / Skip / Blocked by… / Too big / Stop, the "why nothing is ready" states | `components/Focus/` | Focus README |
| A task and step on the Tracking pen clock (`taskId` / `stepId` on the session and `TimeEntry`), ▶ on rows and steps, focus bar, Keep as steps | `lib/pen-color-session.ts`, `lib/task-clock.ts`, `FocusBar.tsx`, `TaskClockStarter.tsx` | Focus README, `lib/README.md` |
| Objectives tied to steps; `parseObjectiveClock` reads `NOW 847 …` | `lib/now-objective.ts` | `lib/README.md` |
| Step `dependsOn`, `actualDuration`, `completedAt`; link mode; lock chips; task **Needs…** (`TaskPrereqDialog`, reusing `EventPrereqPicker`) | `lib/prereqs.ts`, `TodoBreakdown.tsx` | To Do README → Steps |
| Sessions: draft, run, review, park, resume, shelves, Run again, Plan placement and `timeLogs` on review, `sessionPace` | `lib/session-plan.ts`, `lib/session-plan-store.ts` (persist `version: 2`), `SessionPlanner.tsx` | To Do README → Sessions |
| Rites follow the sun (`ritesFollowSun`, `ritualHiddenAt`, `use-rites-sun.ts`) | `lib/ritual-todo.ts` | To Do README → Rites follow the sun |
| Pens on items: `Task.penLinks` edited from item detail and Pen settings; `trackedTimeForItem` | `lib/tracked-time.ts`, `ItemPenTime.tsx`, `pen-linked-items.tsx` | ItemDetail README, Tracking README |

**Known gaps left from shipped phases.**
- A tied objective's actual is wall time from `addedAt` to `completedAt`; pauses inside it are not taken off.
- Item detail → Dependencies does not list steps yet (Phase 14 A).
- Pickers do not hide blocked steps yet (Phase 9 Hide locked).
- Many-step prerequisite edits wait for the task card (Phase 12).

---

## Scenario 2: a live working log (slice I)

Real notes typed while doing **Finish CDs**. This text is the test fixture for `lib/work-log-parse.ts`:

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

| In the notes | Becomes |
|--------------|---------|
| `6:30ish started …` / `8:06 finished` | A Tracking block on the task's pen, 6:30 (`~` start) to 8:06; the actual of step **make mockups**; a `timeLogs` entry |
| "expected 10m … maybe just the thinking" | The step keeps est 10 beside actual 96. The review asks for a one-line reason, saved on the step, and offers **Split: think 15m / do the rest**. Misses feed `lib/estimate-pace.ts` |
| `disc still done` | A line naming an existing step and saying done ticks it, or confirms it |
| `Overall: a, b, c` | Steps on the task itself, in order, each needing the one before |
| `heading:` then bullets (`*`, `-`, `·`) | Nested steps. Empty bullets dropped. A parenthetical becomes `context` |
| `8:24 been actually doing …` | The live block's step changes at 8:24 without splitting the pen block; a `NowObjective` stamped 8:24 |
| `NOW 8:47 …` | A `NowObjective` at 8:47, matched to an open step |

**Three doors, one parser.**
1. **Paste as log** in the Steps fold: a preview (steps, spans, ticks, objectives, each with a checkbox), then **Apply**. Nothing is written without the preview.
2. **Live:** the Objectives popup takes `8:47 looking for photos` (`parseObjectiveClock` already reads the clock) and `heading: a, b, c`.
3. **Phone:** ingest phrase `now:` (alias `obj:`) adds an objective to the live clock, with `st:`'s clock words, next to `so:` in `lib/ingest/command-catalog.ts`. With no clock running, it restarts today's last task. `so:` is unchanged.

**In a session.** A session opened on Finish CDs after these notes shows the outline as the pick list, the 96-minute span as its first done line, the miss as a note on the fit gauge ("your design steps run ~3× estimate"), and the 8:47 objective as the live line.

Also used by the Night rite's **Put the day down** (FN-9, Phase 8).

---

# Part 2. Sessions

## Phase 4: Session plans

_Last mapped: 2026-10-16._ Built (slices G, Q, H), not committed. A session is a time box with three tiers of lines, worked through with a clock. Lines are pointers (`SessionLine { taskId, stepId?, estMin?, actualSec?, doneAt?, outcome? }`), never copies. Points follow the completion-tier rules. Behavior as built: [To Do README → Sessions](../components/Home/ToDo/README.md#sessions-park-resume-shelves).

**Not built yet from the original plan** (not found in `SessionPlanner.tsx` / `lib/session-plan.ts` on 2026-10-16):
- **Ways in:** focus bar, dragging across empty time in Plan's day view, the header Now box, and **Session with this / these** on the task card (Phase 12). The fascia **Session** and **Sessions** keys exist.
- **Flat list:** the pick list opened on its own from the fascia, without making a session.
- **Break it down in place:** selecting a task line opens its steps editor in the draft.
- **Hofstadter factor** in the fit gauge (the load strip's needle uses it; the draft uses `sessionPace` only).
- **Interstitials** (Tidy's `interleaveInterstitials`): an optional break line every N minutes.
- **Park** in the focus bar; **Save as template**; templates ("Evening 3h", "Morning 90m", saved tier shapes).
- `lib/vault-guard.js` counts `history` only; it should count `open` too.

**Additions (2026-10-16).**
- **Note to tomorrow-you (FN-1).** Parking or ending asks for one optional line, stored as `SessionPlan.futureNote?`. On resume it is the first thing shown, above **Resume as was / Fresh clock, same lines**. A done session shows it in its review. **Run again** carries it over, marked with its date.
- **Padded for you (FN-2).** A toggle on the fit gauge. On: each line's estimate is multiplied by the Hofstadter factor and your own pace for that pen or list (`lib/estimate-pace.ts`, Phase 6), and the gauge says "padded for you ×1.6". Off shows raw estimates. Remembered in `todo-prefs`. Below three finished samples the pace is 1, as `sessionPace` does now.
- **Just 25 minutes on this (FN-3).** A built-in template, and a one-key **Just 25** on the row and the task card. The session's shape is `"timebox"` (`SessionPlan.shape?`, default `"lines"`): the clock is the commitment and the lines are optional. Its Bare minimum is reached when the clock runs out with you on it ("showed up", time given regardless of progress); finished lines can still reach Goal. This is the one case where Bare minimum is a duration, not a set of steps. Duration is editable (10 / 25 / 50).
- **Bare-minimum floor (FN-4).** A draft with no Bare-minimum lines shows one suggestion in the empty well: "Smallest step that counts: *…*", from `rankStartSteps` across the draft's tasks (or the lens, if the draft is empty). One click adds it. Nothing is added unasked.

**Files and tests.** `lib/session-plan.ts` (`futureNote`, `shape`, timebox `tierReached`), `SessionPlanner.tsx`, `lib/estimate-pace.ts`. Tests: future note round-trips through park, resume and Run again; padded gauge on and off; a timebox reaches Bare minimum by time alone; the floor suggestion respects locks; old blobs load with neither field.

---

# Part 3. Time that adds up

## Phase 5: Pens on items (both directions)

_Last mapped: 2026-10-16._ **Built (slice E), not committed.** `trackedTimeForItem` / `trackedMinutesForItem` in `lib/tracked-time.ts`; `ItemPenTime.tsx` in item detail (popup Time tab, page Scheduling tab); `pen-linked-items.tsx` in Pen settings; `tasksLinkedToPen` / `setTaskPenLinked` in `lib/task-clock.ts`. Logs that name their blocks (`entryIds`) only add what those blocks did not. The task card header waits for Phase 12. Behavior: [ItemDetail README](../components/ItemDetail/README.md).

People already do this: a person's company pen (`PersonPipeline { kind: "company-pen", penId }`, `lib/people-i-know.ts`) owns blocks painted with it. Tasks get the same.

- `Task.penLinks?: { scopeId, penId }[]` is the only store of the link. It exists, and the clock uses it (**Remember for this task** writes it). This phase adds editing and totals.
  - Item detail: a Pen picker in Time (popup) and Scheduling (page).
  - Pen settings: a **Linked items** field in `pen-settings-dialog.tsx`, reading and writing the same field.
  - Task card header (Phase 12).
- `trackedMinutesForItem(task, entries)` in `lib/tracked-time.ts` sums blocks painted with a linked pen (primary or secondary), blocks carrying the task's `taskId`, and `timeLogs`, dropping duplicates by entry id.
- **Item detail → Time** shows the total, an est-vs-actual bar, and the linked pen's blocks, beside today's time logs ("11h 40m tracked · 300m est left").

**Tests.** Duplicate entry ids count once; secondary pen counts; a block with a `taskId` counts without a pen link.

---

## Phase 6: Estimates, parts, time spent, and your own pace

_Last mapped: 2026-10-16._ **Slice F built, not committed.** `countingMinutes` (`lib/todo-steps.ts`) is the one rule; Plan's drop and `plan-capacity.ts` use it. **Default est** is one To Do pref (`defaultEstimateMin`, Pace bay, default 30), not one per tier yet; rows show it as `~30`, and the load strip still counts those rows as unestimated. Operations totals read `trackedTimeForItems`, which unions minutes per day so a clock log and its block count once. Not in F: the lid's spent, Operations naming a task, and everything under slice L.

**One rule for counting minutes:** max(the typed estimate, else the default, against the sum of the steps). `effectiveDurationMinutes` does this. Two places bypass it and switch over: Plan's `handleScheduleTask` (`day-view.tsx` ~116, `task.estimatedDuration ?? 30`) and `plan-capacity.ts` (raw sums).

- **Default estimate:** a default per tier (Settings, default 30m), shown as `~30`. Typing replaces it.
- **Time spent everywhere:** the lid, item detail → Time and Operations (which today misses pen-painted time) read `trackedMinutesForItem`. Operations rolls up its task tree the same way.
- **Operations naming a task** (left from Phase 2, not built): an operation's Working on this now can name a task and then behaves like ▶ on it. The two session stores stay separate, as the Tracking README requires.
- **Usually ~N** (`usualDurationMinutes`) stays display-only. A review can offer to set an estimate from it.

**Three numbers on every task and step (R6).**
- **est:** the typed estimate. **parts:** the sum of the children's counting minutes (none on a leaf). **spent:** every minute logged on it and its subtree (▶ runs, tied objectives, Paste as log spans, session lines), across days, until done.
- Pure `stepSpentMinutes(task, stepId, entries)` in `lib/tracked-time.ts`: `timeLogs` and blocks carrying the `stepId`, deduped by entry id, walked over the subtree. At task level it is `trackedMinutesForItem`.
- On completion, if spent is larger than `actualDuration`, `actualDuration` takes spent.
- A finished step shows a quiet chip: "52m · est 30 · parts 45".
- Shown on: the row's Time cell (`spent / counts`), the lid's Time readout (`est 120 · parts 145 · spent 3h10 · pen ●CD`), every step (Phase 9), the task card, item detail → Time.

**Your own pace (FN-2, UI-1).**
- New pure `lib/estimate-pace.ts`. `paceFor(scope)` returns your median actual ÷ estimate for a pen, a list, or overall, from finished steps (Phase 6 spent) and closed session lines (`sessionPace` moves here and keeps its name as a re-export). Fewer than three samples → 1.
- Settings → Time shows each pace with a field to override it, and a switch to turn ghosts off.
- **Ghost figure (UI-1).** While you type an estimate, and on any open step whose spent has passed its estimate, a dim "usually ×2.4 for you" sits beside the field, when the pace for that scope is 1.2 or more. It is a ghost you can type over. Your number is never changed.
- The fit gauge's **Padded for you** (Phase 4) reads the same pace.

**Tests.** `stepSpentMinutes` nested, across days, with duplicates; `actualDuration` takes the larger reading; Plan drop and capacity use counting minutes; `paceFor` median, sample floor and override; the ghost never writes the estimate.

---

# Part 4. The look

## Phase 7: The look

House language stays: cool silver well, short rounded cards, nixie tier, engraved verbs, the milled fascia ([`DESIGN_STYLE.md` → Milled fascia](DESIGN_STYLE.md#milled-fascia)). No celestial costume; star icons are welcome. No yellow. Each phase applies its part as it ships; a last pass checks them together.

- **Row.** Name, a step-path hint under it while a step is on the clock, a lock when locked, an **unlocks N** chip (Phase 14). Actions: ▶, Start, **Card**.
- **Lid.** Fold labels all left-aligned (today Time and Steps are centred). Flags: jewels left, Missed / View right. Time: segmented control, field, then `est · parts · spent · pen` with the pace ghost.
- **Focus bar.** Dark glass strip, phosphor clock. The end-of-sitting strip (Phase 15 A) slides out of it.
- **Just Start.** The dark focus room. Step as bright as the timer, hairline breadcrumb eyebrow. The time-box ring (Phase 15 A) is a thin phosphor ring around the clock.
- **Session popup.** `.todo95-dialog` frame; pick list as a ledger well; three stacked tier wells labelled like Done/Missed.
- **Step tree (Phase 9).** Item detail → Subtasks is the model. Hairline indent guides, one row per step, no empty lines until asked. Parents keep the star, leaves the dot. Parents a weight heavier with rolled-up numbers. Selection: steel-blue wash and a left rule. Drag ghost "3 steps", hairline drop line or well outline.
- **Figures.** `est 30 · parts 45 · spent 52` in the CRT chip face; dim means inherited or rough (`~`).
- **Warm red is for estimate overruns only (UI-3).** Missed, overdue and pushed states use neutral ink, not alarm colors.
- **Tier tags.** `B · G · E` tiny nixie tags; the spark mark (UI-7) is a small spark beside them. The tier filter is a segmented control in the Show bay.
- **Level gauge.** Three thin bars, B over G over E, tabular percents, a lit lamp at a reached level, `—` for an empty one. Never drawn dimmed as a shortfall (UI-4).
- **Task card.** Wide `.todo95-dialog`, a milled header strip, the tree as a ledger well, a mass-edit bar sliding up from the well's bottom, a thin order lane (nodes and arrows on graph rule).
- **Stacked item detail.** Offset a few pixels down and right, breadcrumb eyebrow, **Back**; the layer under dims a little.

---

# Part 5. Rites

## Phase 8: Rites that follow the sun, and calmer rites

_Last mapped: 2026-10-16._ **Built (slice J), not committed:** Night hidden on today's day lens until sunset, Morning hidden from sunset while not done, started or done rites never hidden, other days unchanged, toggle `ritesFollowSun` (default on). See [To Do README → Rites follow the sun](../components/Home/ToDo/README.md#rites-follow-the-sun). Header → Rituals never hides a rite.

**Additions (2026-10-16).**
- **Put the day down (FN-9).** The Night rite (`RitualSteps.tsx`, Reviews room) gains an optional first row: a free-text box for anything still in your head. On **Done** it runs `lib/work-log-parse.ts` (slice I) and shows the same preview as Paste as log: lines that name an open task become steps or ticks on it; other lines become new tasks on tomorrow's day list. Nothing is written without the preview. **Skip** is always there. Turned on per rite in the rite's settings (default off).
- **Weekly check-in (FN-10).** An optional weekly rite in Header → Rituals: four 1–5 sliders, **space, sleep, food, movement**, and an optional line. It stores `{ weekKey, space, sleep, food, movement, note? }` in a small persisted store (`lib/self-checkin-store.ts`, added to `lib/data/backup.ts`). It shows only your own trend (last 8 weeks, four sparklines), never a score, and nothing about output or points. If one slider is 1 or 2, it offers one Bare-minimum task for tomorrow ("Clear one surface: 10 min"), from a short editable list per area. Accepting adds it; ignoring does nothing.
- The calm line under hidden rows (UI-5) also covers rites hidden by the sun (Phase 9).

**Tests.** Put the day down: preview only, Skip writes nothing, unmatched lines land on tomorrow. Check-in: stored per week, trend reads only the store, the suggestion appears only for a low slider and is never added unasked.

---

# Part 6. The step tree

Phases 9, 10 and 11 change how steps are drawn, measured and stored. They share one tree component, one tier rule and one progress rule.

## Phase 9: One step tree

_Last mapped: 2026-10-16._ Two step editors exist: the lid's **Steps** fold (`TodoBreakdown.tsx`: stylus lines, via pads, ▶, Needs…, link mode) and item detail → Subtasks (`components/ItemDetail/SubtaskTree.tsx`: clear nesting, + and minutes). One `components/steps/StepTree.tsx` gets both, and lives outside both rooms so item detail never imports from Home.

**Shape (R4).**
- One row per step: tick, star or dot, name, then the host's columns. Hairline indent guides. Chevron and count fold a branch; the fold is remembered per step.
- **No unrequested blanks.** Each open branch ends in one quiet **+ step**; each row has a hover **+** for a child; an empty tree shows **Add the first step**.
- Composer keys unchanged: Enter commits and goes deeper, empty Enter steps out, Shift+Enter stays, multi-line paste makes several steps (and **Paste as log**).
- Parents show rolled-up numbers (weighted percent, `est · parts · spent`).

| Host | Columns and verbs |
|------|-------------------|
| To Do lid (`TodoBreakdown`) | tick, name, ▶, est, spent, lock chip, Needs… (hover), tier tag, spark, ↗ |
| Item detail → Subtasks (`SubtaskTree`) | tick, name, est, parts, spent, tier tag, level gauge on hover, ↗ |
| Task card (Phase 12) | every column, by column picker |
| Session pick list (Phase 13) | name, est, tier tag, drag-out only |

**▶ stays** on every open step and on the row (R6).

**Move steps like files (R5).**
- Click selects; Shift-click selects a visible range; Cmd/Ctrl-click toggles. Esc clears the selection first, a second Esc closes the lid.
- Press and hold the star or dot to drag; a plain click opens the step's item detail (Phase 11). Drop between rows to reorder, onto a row to nest. A selection moves its top-most steps in order; children come along.
- **Across tasks** (Decision 9, open): drop onto another task's row or open lid. Cross-task `dependsOn` links are dropped and named ("2 links removed").
- Refused: a step into itself or its descendant.
- Keyboard, only with focus on a tree row: Alt+↑/↓ reorder, Tab nests, Shift+Tab lifts, arrows move focus. Ledger keys work once focus leaves the tree.
- One undo per move (`lib/action-history.ts`). Pure `moveSteps(steps, ids, target)` and `topMostSelected(steps, ids)` in `lib/todo-steps.ts`. Step items keep their `itemId`.

**Hide locked (R9).** Show-bay toggle in `todo-prefs` (default off).
- Hides steps waiting on an open prerequisite (`isStepAvailable`, with inherited waits), and rows with unmet `dependencies` (the rows Available now hides). A branch whose children are all locked hides with them.
- Never hides a step for being incomplete.
- Applies to the lid, the task card and the session pick list. Hidden steps still count in progress.
- A step comes back the moment its prerequisite is ticked.

**Show next only (UI-6).** A Show-bay toggle beside Tier and Hide locked (`todo-prefs`, default off). A closed branch shows only its next leaf (the `rankStartSteps` pick inside that branch) and a dim "+ 7 more". One click opens the full branch. Applies to the lid and the task card. The tree's data never changes.

**Waiting, not forgotten (UI-5).** Whenever Hide locked, Show next only, the Tier filter or the sun rule (Phase 8) hides anything, one calm line closes the list or lid: "Everything else is waiting, not forgotten. · 3 hidden". The count is a button that peeks at them without turning the toggle off. With nothing hidden, the line is absent.

**Tests.** `moveSteps` with nesting, multi-select, refusals, cross-task links; composer keys; ▶ on every open step; Esc order; Hide locked with inherited waits; Show next only picks the same step as `rankStartSteps`; the calm line and its peek; both hosts render the same tree.

---

## Phase 10: Tiers inside a task, and weighted progress

_Last mapped: 2026-10-16._ `lib/completion-tiers.ts` gives a task three levels as **quantity** thresholds (1 / 5 / 20 pages). This phase gives a task's **steps** the same three names, so one tree holds a bare-minimum, goal and exceptional version (R10). It replaces the flat percent (the readout `0/2 · 0%` counts leaves, so a branch of many small steps outweighs one big step) with a weighted one (R16), and measures each level (R14, R15).

### Tiers on steps

- `Subtask.tier?: "min" | "goal" | "exceptional"`. No tier inherits the nearest ancestor's. A top-level step with none is **Goal** (Decision 8).
- **Lower tiers pull their path in:** a Goal step with a Bare-minimum child shows, greyed, in the Bare-minimum view as its container. It does not count as a Bare-minimum step.
- A task with no step tiers: everything is Goal; Bare minimum and Exceptional are empty.
- Pure `lib/step-tiers.ts`: `effectiveTier(task, stepId)`, `stepsForTier(task, tier)` (cumulative, with greyed containers), `tierBand(task, tier)` (exactly that tier).

### Weighted progress (R16)

`lib/step-progress.ts`, for every percent over a step tree:
- A ticked step is 100%. An unticked parent is the plain average of its children. An unticked leaf is 0%.
- A task is 100% when done, else the average of its top-level steps. No steps: reads by status, as now.

**BigTask** has medium 1 (4 steps) and medium 2 (2 steps). One step of medium 2 is ½ × ½ = **25%**; one of medium 1 is ¼ × ½ = **12.5%**. A flat count says 17% for both.

Counts (`3/6`) stay counts. Only the percent changes, and only on uneven trees: a deliberate change; `internalStepProgress`'s tests are updated and it keeps its counts. Weighting by estimate is not planned.

### Completed to a level (R14)

A step or task is **done to level T** when it is ticked, or it has children in T's view and all of them are done to T. A leaf is done to T only if ticked. Views are cumulative: Goal includes Bare minimum; Exceptional includes all.
- **Levels climb in order:** Bare minimum, then Goal, then Exceptional.
- **An empty level is never reached.** It reads `—`. Exceptional needs at least one Exceptional step, so finishing Goal never counts as Exceptional.
- `levelReached(task)` → `"none" | "min" | "goal" | "exceptional"`. Sessions' `tierReached` uses it (Phase 13).
- Computed while open. Done records `tierReached` on the Done row.
- **Levels never lock anything** (Phase 14).

### Percent to each level (R15)

`levelProgress(task, stepId?)` → B %, G %, E %, each the weighted percent over that level's view. Greyed containers count only through in-view children. An empty level is `null` (`—`).

Finish CDs: Bare minimum = Back (3 steps, 2 done) and Inside holder (2, 0 done); Goal adds insert (4, 1 done). B = (2/3 + 0) / 2 = 33%. G = (2/3 + 0 + 1/4) / 3 = 31%. E = `—`.

### Spark mark (UI-7)

- `Subtask.sparkedAt?: string` (ISO). A small spark you set yourself on a step that pulls you. Click to set or clear; mass edit in the card.
- No points, no score, no effect on progress. It is a self-observation tag.
- The pick list, the three-column view and the card can sort by it. Just Start uses it (Phase 15 A).

### What it changes

- **Row progress** becomes the level gauge on a task with step tiers. Without tiers: one bar, weighted percent.
- **Done** offers **Done at Bare minimum** / **Done at Goal** when reached. Undo unchanged.
- **Points.** Quantity completion tiers, if any, still decide a task's points. Otherwise the level reached pays the house completion-tier amounts (`activeTierPoints()`). Step points (Phase 12) are extra; how visible they are is Decision 13.
- **Just Start** prefers the lowest level not yet reached (see [Rules](#rules-that-hold-for-all-of-these)).
- **Sessions** pre-sort a dropped task's leaves into the matching wells (Phase 13).

### Seeing it

- **To Do:** a **Tier** control in the Show bay (All / B / G / E, `todo-prefs`). It filters every lid to that view; row progress and counting minutes read for that level ("counts 45m for Goal").
- **Item detail → Subtasks and Time:** the gauge in the header and on hover per step; a step item's detail shows its own.
- **Task card:** header gauge, a B / G / E column, the three-column view.
- **Setting a tier:** click a step's tag to cycle B / G / E / inherit; mass edit; or drag between columns in the card.

**Files and tests.** `lib/step-tiers.ts`, `lib/step-progress.ts`, `Subtask.tier` and `Subtask.sparkedAt` in `lib/types.ts`, backup and vault-guard fields. Tests: BigTask; Finish CDs; inheritance and greyed containers; empty levels never reached; ticked parent counts done; levels climb in order; picker unchanged without tiers; Done at a level and its undo; sparks change nothing but sort order.

---

## Phase 11: Steps are items, and open on top

_Last mapped: 2026-10-16._ A step is a `Subtask` in `task.subtasks` (`lib/types.ts` ~267) with name, tick, estimate, nested steps, `dependsOn`, `actualDuration`, `completedAt`, and no notes, files, links or history. `Task.parentTaskId` exists (~564) and Tidy uses it. Item detail also deletes an older Task-backed subtask sharing a step's id when the step is deleted (ItemDetail README); map that legacy path before reusing `parentTaskId`.

**Steps become items when needed (Decision 5).**
1. `Subtask.itemId?` links a normal `Task` with `parentTaskId` = the parent and `stepOf?: { taskId, stepId }`.
2. **The tree is the source of truth** for order, nesting, done, estimate, `dependsOn`, actuals, tier, spark and points. The item holds the rest: notes, note log, resources, links, tags, attributes, pens.
3. Item detail on a step item reads and writes the shared fields on the step through `updateStepField` (`lib/step-items.ts`). No second copy.
4. Created the first time anything item-only is written, or when opened in item detail. No prompt.
5. Not a To Do row, not on any lens or list (`isStepItem(task)`, checked with `isSessionOnly`). **Schedule on its own** is later.
6. Deleting a step deletes its item; deleting the parent deletes all. Both through `lib/action-history.ts`, so undo relinks. Moving keeps the item; moving across tasks updates `parentTaskId` and `stepOf`.
7. Backups and vault guard learn the fields (`lib/data/backup.ts`, `lib/vault-guard.js`, `lib/vault-coverage.test.ts`).
8. A task cannot list its own step item or parent in `dependencies` (Locked vs incomplete).

**Open on top (R3).** `TaskDetailPopup` gains a stack. Opening a step pushes a layer with a breadcrumb (`Finish CDs › insert › disc`) and **Back**; Esc closes only the top; a crumb opens that ancestor as a new layer. Everything underneath keeps its state (open lid, scroll, selection, link mode, running session). Ways in: click the star or dot in the lid; **↗** in item detail → Subtasks, the task card and a session. A step item shows its gauge, `est · parts · spent`, a **Parent** chip, and **Card** (the parent's card, scrolled to the step).

**Tests.** Lazy creation; shared fields write to the step only; delete and undo keep the link; never on a lens; Esc and Back; state under the stack survives.

---

# Part 7. Working surfaces

## Phase 12: The To Do task card

_Last mapped: 2026-10-16._ Item detail edits the whole item; the lid is for one-line changes. The **task card** is for planning this period's work on one task (R7, R8). It uses the lid's store functions (`updateTask`, `lib/todo-steps.ts`, `lib/prereqs.ts`), so all three always agree.

**Ways in.** **Card** in the row's Actions and the lid header; the task name in a session draft and **More…** on a session's **Add new** line; **Card** in item detail (when on the current period) and on a step item.

**Header** (a small milled strip): name, period nameplate, Required / Prioritized jewels, state lamp, pushes this period, pen (Phase 5), level gauge, `est · parts · spent`, ▶, **Just Start**, **Just 25** (Phase 4), **Session with this**, **↗ Item**.

**Body: the full step tree** with a column picker: tick, name, tier tag, spark, B / G / E %, est, parts, spent, points, Needs, lock, unlocks, ▶, ↗. Level filter, Hide locked and Show next only sit above it. **Three-column view:** B | G | E side by side, greyed containers; dragging between columns sets the tier.

**Mass edit (R8).** Select (click, Shift, Cmd, **Select all open**, **Select leaves**); a bar slides up:
- Estimate: set, ±5, ±15. Tier: B / G / E / inherit. Points: set. Spark: set / clear.
- Needs: **Needs…** (all need one step), **Chain** (each needs the one above, in visible order), **Clear needs**.
- Done / Not done; Move under…; Move to task…; Delete; **Session with these**.
- One undo per bar action.

**Points.**
- The task's points from `resolveCompletionPoints`, with their source (list rule, tier formula, override). Optional `Task.pointsOverride?`; clearing it returns to the rule.
- Optional `Subtask.points?`, paid on tick (`step:{taskId}:{stepId}` in the points store), taken back on untick, **extra** to the task's (Decision 7).
- Whether point figures show is Decision 13 (Phase 15 D). With **Points visible** on, the header reads `task 10 · steps 6 · level +10`; off, it shows nothing about points, and the Points column is absent from the picker.

**Prerequisites.** Needs chips per step (click to change, or link mode). Task-level **Needs…** opens `TaskPrereqDialog`. A thin **order lane** draws the open steps' prerequisite graph left to right; node size reads unlock value (Phase 14); clicking selects. An **Unlocks** list shows what waits on this task and any inherited due date.

**Period values** (side panel, this period only): marks and pushes in and out; spent this period vs all time; est remaining for the chosen level against what is left of the day (the load strip's needle); level reached and B / G / E %; sessions that touched it, with tier reached.

**What stays where.** The lid keeps its quick verbs. Item detail keeps every field; the card links to it for Notes, Resources and Links.

**Files and tests.** `components/Home/ToDo/TaskCard.tsx` + `task-card.css`, mounted once in `todo-panel.tsx`. Tests: each way in; one undo per mass edit; Chain and Clear needs; points override; step points paid and taken back; Points visible off hides every figure but still pays; three-column drag sets tiers; the lid updates live.

---

## Phase 13: Sessions that use the whole tree

_Last mapped: 2026-10-16._ Built on Phases 4, 9 and 10. `SessionLine` already points at a task or one step, so this is mostly rules.

**A. Drag a whole branch in (R11).** The pick list becomes `StepTree` (**Flat list** still flattens). Dragging a step drops **one line** standing for its subtree; its estimate is `effectiveDurationMinutes`. In the well, a chevron opens the substeps it brought, read live. A whole task drops one line with no `stepId`. Shift/Cmd selections drop one line per top-most step. A line's progress is the weighted percent of its subtree; it is done when its subtree is done. `rankStartSteps` limited to the line's subtree gives its next step.

**B. Parts of one tree in different tiers (R12).**
- A line sets the tier for its subtree. **A carve-out wins:** a substep dragged into another tier becomes its own line (`parentLineId`) and leaves the parent's tier; the parent shows it as a dim row "→ Goal".
- **Each leaf counts once,** in the tier of its nearest line or carve-out. `sessionFit` walks leaves.
- Lower tiers pull their path in, greyed, as in Phase 10.
- **Tier reached** is `levelReached` over the lines (empty tiers never reached). A timebox session (Phase 4) reaches Bare minimum by time.
- Dropping a task with step tiers pre-sorts its leaves into the wells as carve-outs. **Save tiers to task** writes them back; nothing else does.
- `SessionLine` gains optional `parentLineId?` and `excludeStepIds?` (computed). Old drafts read as before.

**C. Tasks made inside a session (R13).**
- Each well has **Add new** (name, estimate, optional points and steps; **More…** opens its card). It is a real `Task` with `sessionOnly?: { sessionId }`, so ▶, steps, Just Start and Tracking work on it.
- `isSessionOnly(task)` keeps it off every lens, Open list, the Scheduler, Lists, search and the load strip, checked by `tasksProspectiveForPeriod`, `taskScheduledOnDay` and the list helpers, with a sweep test.
- A **session only** tag in the session, item detail and the card. **Persist** clears the flag and schedules it today (or week or month). It stays with a parked session.
- At review: unfinished → **Persist**, **Keep for next session** or **Drop**; finished → **Persist as done** (lands in Done with its real time) or **Drop** (time stays on the Tracking block and session record). Drop is the normal delete, with undo.
- Points: paid through the session total; **Persist as done** moves them to its Done row.

**Tests.** One line per branch; carve-outs and leaf-once fit; empty tiers; pre-sort; `sessionOnly` absent from every list helper; Persist / Keep / Drop and points; parked sessions keep session-only tasks.

---

# Part 8. What to do first

## Phase 14: Locked vs incomplete, and prerequisites that rise

_Last mapped: 2026-10-16._ Built on Phase 3. `lib/prereqs.ts` knows what a task **waits on**; the Priority sort (`computePriorityScore`, `lib/priority.ts`: urgency, importance, quick win, entropy) knows nothing about what **waits on it** (R19). And no single rule keeps "has open steps" apart from "cannot start yet" (R18).

### A. One vocabulary on every screen (R18)

The rules are in [Locked vs incomplete](#locked-vs-incomplete). Every screen follows them:
- **Row, lid, card, item detail → Subtasks:** lock chip only for unmet prerequisites; gauge or percent for parts; both when both apply.
- **Just Start:** "All locked" names the prerequisite; "Nothing left at this level" names the level.
- **Sessions:** a locked line says "needs *X*" with **Add *X*** (puts it in the session above). An incomplete line shows its percent.
- **Item detail → Dependencies:** **Needs** and **Unlocks** lists, and steps as well as tasks. Parts stay on Subtasks.
- **Status filter:** `Active & available` keeps meaning open and not locked.
- A sweep test renders an incomplete-not-locked task and a locked-and-40% task on each screen and checks the words.

### B. Unlock value (R19)

Pure `lib/unlock-value.ts`, over the `dependencies` graph that `lib/critical-path.ts` and Available now read (loops are already refused):
- `waitingOn(taskId, tasks)`: every open task waiting on this one, directly or through a chain, once each, with its distance.
- **Own value** of a waiting task, 0–1: the mean of its normalized importance and urgency (`normalizePriorityInputs`); a Required or Prioritized mark this period counts as 1. Missing fields read as defaults.
- **Unlock value:** the sum of own values, faded by distance (Decision 12: 1, 0.7, 0.49, …). A task needing three things gives full credit to each.
- `unlockBreakdown(task)` lists what is behind the number: "unlocks 3 · Release CD (0.9), Mix (0.6), Master (0.5 × 0.7)".

### C. It moves the list

- **Formula.** A fifth signal `unlocks`, normalized `1 − 1 / (1 + value)` (0 when nothing waits, 0.5 for one full-value task, ~0.8 for four). `PriorityWeights` gains optional `unlocks?`, read as 1 when missing, so the weights persisted in `lib/task-store.ts` need no migration. The Formula panel gets a fifth slider.
- **A task with nothing waiting scores exactly as today.**
- **Blocker goes first.** Under the Priority sort, an open prerequisite sorts above a locked row that waits on it, within Required and within Assigned. Prioritized rows stay pinned first.
- **Missing prerequisite.** When it is not on this period's list: "needs *X* · not scheduled" with **Schedule *X* today**.
- **Inherited due date.** A prerequisite takes the earliest deadline of anything waiting on it, less the estimates in between along the longest chain ("due Thu for Release CD"). Shown on the row and card; the formula reads it like an own deadline (raises urgency, never lowers it). The task's own `deadline` is never written. Shown in neutral ink (Phase 15 B).
- Tier, name, created, added and pushed sorts are unchanged.
- **unlocks N** chip beside the name when N > 0, plain ink, no padlock; hover lists them.

### D. Inside a task

- A step's unlock value: open steps waiting on it, directly or through a chain, faded as in B. Steps in a level not yet reached weigh more: B 1, G 0.6, E 0.3 (after Phase 10; before it, all 1).
- It is rank 2 in the [one brain order](#rules-that-hold-for-all-of-these). No step `dependsOn` → today's order.
- The session pick list sorts by the same rank; drafts keep prerequisites-first order (`orderByPrereqs`). The card's order lane sizes nodes by it.

### E. Later: prerequisites met at a level

Decision 11: not in the first build, definitely later. Built after Phase 10 and slice S.

- **Model.** The links stay as they are (`dependencies: string[]`, `dependsOn: string[]`). Optional maps beside them name a level per link: `Task.dependencyLevels?: Record<taskId, "min" | "goal" | "exceptional">` and `Subtask.dependsOnLevels?: Record<stepId, …>`. No entry means "done", today's rule. Old data reads unchanged.
- **Met** when the prerequisite is done, or `levelReached(prereq)` is at or above the named level.
- **Marking it.** The Needs chip gets a level picker (Done / B / G / E); link mode and mass edit set it too. The chip reads "needs *Record* to B".
- **What emerges, on purpose.**
  - Work unlocks in waves: Mix can start once Record reaches Bare minimum, while Record keeps climbing to Goal.
  - Unlock value flows into the prerequisite's needed level: a task's value is credited to the steps in the level its dependents need, so Record's Bare-minimum steps rise when Mix waits on Record to B. Steps above that level get no lift from Mix.
  - Sessions can plan chains across tiers: "Record to B" in Bare minimum, "Mix to B" in Goal.
  - Inherited due dates apply to the needed level, not to all of the prerequisite.
- **Guard rails.**
  - Loop checks are unchanged (the graph is the same).
  - **Started work never re-locks.** If a prerequisite falls back below its level (a step unticked), a dependent that has not started locks again; one already started (`partial`, time logged, or a step ticked) stays unlocked and shows "needs *Record* to B · fell back".
  - Unlock value and the Formula read the level only through `lib/unlock-value.ts`, so this stays one rule.
- **Tests.** A level link unlocks at the level, not before; "done" links unchanged; unlock value credits only the needed level's steps; fallback re-locks only unstarted work; old data with no level maps behaves exactly as before.

### Files and tests

`lib/unlock-value.ts`, `lib/priority.ts`, `PriorityWeights.unlocks?` in `lib/types.ts`, the Formula panel in `todo-filters.tsx`, `filterAndSortTodos` in `todo-utils.ts` (an optional all-tasks argument, so outside callers keep their behavior), `lib/next-step.ts`, the lock chip and the Dependencies tab. Tests: A → B → C fades by distance; a task waited on by three outranks an equal task waited on by none; nothing waiting means an unchanged score; the blocker sorts above its locked row; inherited due date along the longest chain, overdue when passed; a locked 40% task shows both; an open parent is never locked; `pickStartStep` unchanged without `dependsOn`; a weights blob without `unlocks` loads.

---

# Part 9. Less pressure

## Phase 15: A gentler Just Start, neutral words, a Waiting shelf, quiet points

_Last mapped: 2026-10-16._ Less pressure, more visible time, smaller first steps. Nothing here removes a verb, a key or a record: words change, and new options appear beside the old ones. Where something you can see changes by default, it says so.

### A. Just Start and the sitting (UI-2, UI-9, FN-5, FN-6)

- **Choices, not a command (FN-6).** New `rankStartSteps(task, n = 3)` in `lib/next-step.ts` returns the top of the [one brain order](#rules-that-hold-for-all-of-these); `pickStartStep` stays and returns the first. Just Start opens on **Today's choices**: two or three leaves, the first pre-highlighted. Enter or Space starts the highlighted one, so starting is still one key. A ▶ on a step still starts that exact step with no choices. Skip and Blocked by… stay. A visible change on purpose; the Just Start tests are updated to say so.
- **Pull me (FN-5).** A key on the choices screen that starts the most recently sparked open, unlocked leaf, ignoring estimate. Absent when nothing is sparked. Sparks also break ties on equal estimates (rank 4).
- **Time-box ring (UI-2).** Beside the estimate countdown, a thin ring for a time box: the estimate by default, or 10 / 25 / 50. When the ring closes, the clock stops, a lamp lights, and it says "Time's up. That counted." The minutes are logged on the step as on Done; the step stays open unless you tick it. **Keep going** restarts the ring. Finishing the step is optional. The old countdown behavior is a toggle (**Stop at the estimate**, default on, as today).
- **End of sitting (UI-9).** At Stop in the focus bar, Just Start or a session, a thin strip slides out: "Sat 52m. Left it here: *next leaf*" (from `rankStartSteps`). The next leaf is pre-written and editable; **Keep** saves it as the step's `context` note ("left it here") so the next sitting starts with it. **Skip** closes the strip. It replaces the bare Stop moment, not the Keep as steps prompt, which still comes first when free objectives exist.

### B. Neutral words and a second line (UI-3, UI-4, UI-8)

- **No "should" (UI-3).** A house rule in `DESIGN_STYLE.md`: no UI text tells you what you should do. An audit of To Do, Just Start, sessions, the focus bar and rites lists every pressure word and empty state, and replaces labels:
  - `waiting Nd` → "Waiting since Tue" (the row already uses the priority date).
  - Push counts read "Pushed ×3".
  - **Missed** stays a verb and keeps its key (M) and its record (`markMissedOpportunity`). Its well and alarm styling become neutral ink. Any rename of the word itself is listed by the audit for your yes first.
  - Overdue, red alarms and "!" marks go. Warm red is kept for estimate overruns only (Phase 7).
  - Only labels and colors change. Stored statuses, fields, keys and outside imports stay.
- **Attention given (UI-4).** Each Done well gets a second, quieter line that is not about output: "3 sittings · 2h10 of attention given" for the period, from `timeLogs` and task blocks (Phase 6 spent). Tier lamps on Done rows show as lit facts; unreached levels read `—`, never dimmed shortfalls.
- **Notice dot (UI-8).** On rows pushed 3 or more times (all periods), a small dot. It opens one line: "I'd like to understand what's going on with this one…". The answer is saved as a dated entry in the item's `noteLog` (tagged `notice`), and shows on the task card. The dot stays quiet once answered until the next push. No count, no color change.

### C. Waiting shelf (FN-8, Decision 14)

- A task pushed **5** times (total across periods; Pace-bay setting `waitingShelfAfter`, 0 = off) moves off the lens to a **Waiting** shelf under the ledger, like Done and Undone: a collapsed well with a count.
- Never moved: Required or Prioritized rows, rows on the clock or in a running session, rites.
- Computed, not stored: `pushesSince(task, shelfClearedAt) >= n`. Undone history and push counts are untouched.
- Each shelved task offers:
  - **Shrink to bare minimum:** opens its task card in the Bare-minimum view to choose a smaller version, then returns it to the lens (sets `Task.shelfClearedAt`, so the count starts over).
  - **Rest it:** `status: "deferred"` (exists; comes back from item detail).
  - **Let it go:** the normal delete, with undo.
  - **Back on the list:** returns it as is (sets `shelfClearedAt`).
- The calm line (UI-5) covers it: "Everything else is waiting, not forgotten."
- A visible change by default (Decision 14, confirmed). With the setting at 0, the ledger behaves exactly as today.

### D. Quiet points (FN-7, Decision 13)

- A **Points visible** setting (Settings → Points), default **off for step points**. Points still accrue and are stored exactly as before.
- Off: no step-point figures in the lid, card or review; the card header shows no `steps N`. Task, tier and session points show as today.
- On: the card header reads `task 10 · steps 6 · level +10`, as Phase 12 describes.
- Timebox sessions (Phase 4) pay Bare minimum for time given, shown or not by the same switch.

**Files and tests.** `lib/next-step.ts` (`rankStartSteps`), `components/Focus/` (choices, Pull me, ring, end strip), `DESIGN_STYLE.md` rule, the word audit as a checklist in this doc's PR, `DoneTodoSection.tsx` (second line), `TodoTable.tsx` (notice dot), a `WaitingTodoSection.tsx`, `todo-prefs` (`waitingShelfAfter`), Settings (Points visible). Tests: `rankStartSteps` first item equals `pickStartStep`; Enter starts the highlighted choice; Pull me picks the latest spark and respects locks; the ring logs minutes and leaves the step open; the end strip saves `context`; Done well line sums correctly; the notice dot shows at 3 pushes and writes a `noteLog` entry; the shelf never takes Required, Prioritized or running rows, and setting 0 restores today's ledger; Points visible off hides figures but the points store is unchanged.

---

## Order of work

| Slice | Contents | Phase | Depends on | Size | State |
|-------|----------|-------|------------|------|-------|
| A–D | Grid, mark carry, ink; Just Start; prerequisites; task on the clock | 0–3 | — | — | Shipped |
| G, Q, H | Sessions; tier id rename; park, resume, shelves | 4 | B, C, D | — | Built 2026-10-16 |
| J | Rites follow the sun | 8 | — | — | Built 2026-10-16 |
| H2 | Phase 4 leftovers: ways in, Flat list, break down in place, Hofstadter in fit, interstitials, Park in focus bar, templates incl. **Just 25**, vault guard counts `open`; future note, floor suggestion | 4 | H | M | Planned |
| E | Pen ↔ item link, `trackedMinutesForItem`, item detail Time, pen settings field | 5 | — | M | Built 2026-10-16 |
| F | Estimate rule everywhere, default estimate, Operations totals | 6 | E | S | Built 2026-10-16 |
| L | `stepSpentMinutes`, est · parts · spent, `lib/estimate-pace.ts`, ghost figure, padded fit gauge | 6 | D, E | M | Planned |
| K | `StepTree`, no blanks, ▶ kept, drag + multi-select, Hide locked, Show next only, calm line | 9 | C, D | L | Planned |
| N | Step tiers, weighted percent, levels, gauge, Tier filter, sparks | 10 | K | M | Planned |
| M | Step items, stacked item detail | 11 | K | M | Planned |
| O | Task card | 12 | K, L, N (M for ↗) | L | Planned |
| P | Branch drag-in, carve-outs, `sessionOnly` with Persist | 13 | H, K, N | M | Planned |
| S | Locked vs incomplete words; unlock value; formula; blocker first; inherited due date; step unlock rank | 14 A–D | C (N for level weights) | M | Planned |
| S2 | Prerequisites met at a level | 14 E | N, S | M | Later (Decision 11) |
| I | `work-log-parse`, Paste as log, live `heading:` lines, `now:` ingest phrase | — | C, D | M | Planned |
| T | Rites additions: Put the day down, weekly check-in | 8 | J (I for the parser) | S | Planned |
| U | Just Start choices, Pull me, time-box ring, end-of-sitting strip | 15 A | B, D (N for sparks) | M | Planned |
| V | No-should audit and rule, Done well line, notice dot | 15 B | — (L for the attention line) | S | Planned |
| W | Waiting shelf | 15 C | — (O for Shrink) | S | Planned |
| X | Points visible switch | 15 D | — | S | Planned |
| R | Look pass | 7 | each slice | S | Ongoing |

**Waves.**
1. **Now, in parallel (separate files):** H2 (session files), E then F (time), K (step tree), S task half (`lib/priority.ts`, `todo-utils.ts`, Formula panel), V and X (words, settings).
2. **After K:** N and M in parallel. L once E is in. U once N gives sparks (U's choices and ring can ship earlier, without Pull me).
3. **After N:** O, then P. S's step half. W once O exists (Shrink opens the card; the other three verbs can ship first).
4. **After N and S:** S2.
5. **Any time after C and D:** I, then T.
6. **R** with each slice and once at the end.

## Invariants (tests that must stay green or be added)

- Every `TodoTable` key (arrows, Enter, Esc, D / M / P / R) and the ritual-row exceptions. Tree keys only act with focus in a tree; Esc clears a step selection before it closes the lid.
- Undo of Done and Missed through `lib/action-history.ts`.
- Outside imports from `todo-utils.ts` (table in the To Do README): same names, same behavior.
- Marks are per period and carried on push. Morning-review priorities still read as prioritized.
- Auto-push of **process inbox information** still moves day to day.
- `effectiveDurationMinutes` semantics unchanged; only its callers widen. `molecular.ts` exports keep working.
- Morning and Night rows behave exactly as before with **Rites follow the sun** off. Header → Rituals never hides a rite.
- Composer keys work once a composer is open. ▶ is on every open step and on the row.
- Every reader of `task.subtasks` works on a task with no step items, tiers, sparks or moves.
- `sessionOnly` tasks and step items never appear on a lens, Open list, the Scheduler, Lists, search or the load strip.
- A task with no step tiers, `dependsOn` or sparks has the same Done, points and pick order as before. Its counts are unchanged; its percent is the weighted one (deliberate).
- An empty level is never reached and never shows 0%.
- Only prerequisites lock. An incomplete task or step is never shown as locked and never hidden by Hide locked or Available now.
- A task with nothing waiting on it has the same priority score as before Phase 14.
- `rankStartSteps(task)[0]` always equals `pickStartStep(task)`.
- The pace ghost never writes an estimate. Points visible off never changes what the points store holds.
- With `waitingShelfAfter` at 0, the ledger is exactly as before; Required and Prioritized rows never leave it.
- Old vaults, backups and session blobs load with none of the new fields set (`lib/vault-coverage.test.ts`).
- Tier labels read **Bare minimum / Goal / Exceptional** everywhere.
