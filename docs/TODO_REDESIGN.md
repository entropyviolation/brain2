# To Do redesign

Home → To Do. _Resolved: 2026-10-27._

**Status.** Nothing in this file is still to build. The working surfaces shipped. The leftovers below were declined on purpose. Live behavior stays in [`components/Home/ToDo/README.md`](../components/Home/ToDo/README.md) and the room READMEs it links. This file does not restate the CRT fascia, the task card, or sessions.

## Shipped

Phases 0–6, 8 (rites that follow the sun only), 9–12, 14 A–D, and 15 A, B, and D. Each line is a pointer, not a second spec.

| Phase | What landed | Where |
|-------|-------------|--------|
| 0–3 | One ledger grid, marks that carry on push, Just Start, a task on the clock, prerequisites | To Do README, Focus README |
| 4 | Sessions: park, resume, shelves, templates, Just 25, breaks, ways in | To Do README → Sessions |
| 5 | Pens on items, both directions | Item detail README, Tracking README |
| 6 | `est · parts · spent`, your pace, the ghost, Operations naming a task | To Do README → Time spent |
| 8 | Morning and Night rows follow the sun on today's day lens | To Do README → Rites follow the sun |
| 9 | One `StepTree` | [Phase 9](#phase-9-one-step-tree) |
| 10 | Step tiers, weighted percent, levels | [Phase 10](#phase-10-tiers-inside-a-task-and-weighted-progress) |
| 11 | Steps become items when needed; item detail stacks | `components/steps/README.md` |
| 12 | The To Do task card | [Phase 12](#phase-12-the-to-do-task-card) |
| 14 A–D | Only prerequisites lock; unlock value in the Priority sort; a blocker sorts above its locked row; inherited due date; step unlock rank in Just Start | To Do README → What waits on a row; `lib/next-step.ts` `startOrderFor` |
| 15 A, B, D | Just Start choices, the time-box ring, the end-of-sitting strip; neutral words, the notice dot, attention given; step points hidden behind **Points visible** | Focus README, To Do README, [`DESIGN_STYLE.md`](DESIGN_STYLE.md#no-should) |

Facts the old essay still got wrong. Do not put them back:

- The closed-row Done cell is σ (`splitPercent` in `lib/tree-math.ts`), not three B/G/E percents. B / G / E stay on the lid, the task card, and item detail.
- The task card's Order lane is gone. Unlock counts stay on the column. Node size by unlock value is not a feature.
- Just Start order in `startOrderFor` (`lib/next-step.ts`) is already level, then step unlock value, then estimate, then spark.
- **Padded for you** is wired in `session-planner/draft-view.tsx`, still reached through `SessionPlanner.tsx` (`sessionPadded`, `sessionPaceFactor`).
- Plan day view already offers **Session in this time** and writes a block with `source: "session"`.

## Decisions

_Last mapped: 2026-10-27._ These still bind. A change that breaks one needs allie's yes first.

| # | Question | Decided |
|---|----------|---------|
| 1 | Name for a short "right now" plan | **Session**. In prose, a **planned work session**: a name, a length set first, and tiered assignments. Working on now is an **open work session** on the same pen clock. Play inside a Session starts that open work session. The words "named" and "timed" do not separate them. See the To Do README. |
| 2 | Tier labels | **Bare minimum / Goal / Exceptional**. Stored ids stay `min`, `goal`, `exceptional` (and the older completion-tier ids). A rename needs a migration |
| 5 | Steps as items | **When needed.** A step becomes an item the first time it needs notes, files, or links |
| 6 | Name of the popup | **To Do task card** ("task card") |
| 9 | Drag steps across tasks | **No.** Moves stay inside one task. Closed 2026-10-27 |
| 11 | Can a prerequisite be met at a level? | **No.** Met means done. Closed 2026-10-27 |
| 13 | How loud are points? | Points keep accruing. **Step points** hide by default behind **Points visible**. Task, tier, and session points show as they do now |
| 14 | Waiting shelf | **No shelf.** Closed 2026-10-27. Push flags, the notice dot, and Undone stay |
| 15 | Merge item detail → Subtasks, the To do drawer, and the task card? | **No. Never merge them.** They edit the same task on purpose and have different jobs, so they keep different UI and components. See [the room README](../components/Home/ToDo/README.md#three-ways-to-edit-a-task-stay-separate) |

**Locked vs incomplete.** Only a prerequisite locks (`Task.dependencies`, `Subtask.dependsOn`). Open steps leave a task incomplete, never locked. A locked task can still show a percent. "Locked" and the padlock are for prerequisites only.

## Phase 9: One step tree

Built. `components/steps/StepTree.tsx` is the lid, item detail → Subtasks, and the task card. Drag and multi-select stay inside one task (Decision 9). Paste as log was declined (below).

## Phase 10: Tiers inside a task, and weighted progress

Built. `Subtask.tier` is `min` / `goal` / `exceptional`; a top-level step with none is Goal. The weighted percent stays in the model (`lib/step-progress.ts`). The closed row draws σ, not that percent and not three B / G / E bars.

## Phase 12: The To Do task card

Built. `components/Home/ToDo/task-card/TaskCard.tsx`. Item detail is the item. The drawer is this period's quick edits. The card is this period's plan for one task. **More…** on a session **Add new** line, **Move to task…**, and unlock-value node size were declined with the slices they belonged to.

## Declined

_Last mapped: 2026-10-27._ Chosen, not forgotten. Do not rebuild these from the old essay.

- **Phase 13.** A whole branch as one session line, one tree carved across tiers, and session-only tasks until Persist. A session line can already open its steps and time one of them.
- **Paste as log**, live `heading:` lines, the phone `now:` phrase, and the Night rite's **Put the day down**.
- **Weekly self-care check-in** (space, sleep, food, movement).
- **Waiting shelf** after N pushes (Decision 14).
- **Cross-task drag** and **Move to task…** (Decision 9).
- **Prerequisites met at a level** (Decision 11).
- A **default estimate per B/G/E tier**, and a Settings field for list-scope pace. `paceSamples` may still take `listIdsOf`. No new control.
- **Schedule a missing prerequisite onto today.** Step points paid when item detail ticks a step. A finished step painting with that step's pen.
- **Phase 7** as a restyle. The 2026-10-21 instrument is the look.

## Not this file

These notes live in the To Do README and were not part of this close. This file does not reopen them and does not cancel them: the node-detail lab, the B/G/E score on the Home day lamp and Data, `estimateLog` feeding pace, a global note kind, load and pace math drawings, and the Solarpunk garage mockup.
