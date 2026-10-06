# `components/Home/Goals/` — Objectives & Goals

The Home **Goals** sub-tab in **Brain2**, on a milled fascia (CRT title, metal keys, period lamps, recessed lists). Two distinct concepts:

- **Objectives** — your *all-time, aspirational life directions* (qualitative, no
  target or deadline; e.g. "Read a lot", "Be healthy"). An objective can be
  **prioritized** for a period (day/week/month/season/year), which carries a user-set
  **points multiplier** on contributing actions. Season is a calendar quarter
  (`YYYY-Qn`, up to 4 priorities).
- **Goals** — *quantifiable metrics* over a period that move you toward one or
  more objectives (no goal without an objective; e.g. "Read 20 books this year",
  "Surf once a week"). Tasks contribute to goals (incrementing their value) and to
  objectives (earning stacking point multipliers). The completion popup can
  **select or create** either one: **Add** writes a real objective, or a year-long
  count goal that serves the objectives selected in that popup.

**Season** on this tab is a calendar quarter (`lib/seasons.ts`): Q1 Spring,
Q2 Summer, Q3 Fall, Q4 Winter. Goals and objective priorities of kind `quarter`
use the key `YYYY-Qn` (26 Sep 2026 is `2026-Q3`, labeled Quarter 2026 Q3 (Fall)).
A Jung **life season** (a named stretch with no fixed length) is specified in
[`docs/JungBrain2.md`](../../../docs/JungBrain2.md) JG-9. That record type is not
built, and it is not this quarter.

## Public door

Other rooms may import:

- `GoalsTracker` from `goals-tracker.tsx` — Home lazy-loads the tab (`components/Home/home-dashboard.tsx`).
- `ObjectiveDetailDialog` from `ObjectiveDetailDialog.tsx` — Lists opens one objective (`components/Lists/objectives-list.tsx`).

This room writes **`lib/goals-store.ts`** (`useGoalsStore`: objectives, goals, priorities, reviews, progress). **Log** on a goal also writes a completed task (`lib/task-store.ts` `addTask`) and points (`lib/points-store.ts` `addPoints`).

Stay in this room: `ObjectivesPanel`, `GoalsContainer`, `DirectionReport`, and `goals-chrome.css`. `GoalsTracker` is the only composer of those three panels.

## Files

| File | Purpose |
|------|---------|
| `goals-tracker.tsx` | `GoalsTracker` (`data-ui-name="Goals"`): milled fascia (CRT **Objectives & Goals**) composing objectives → goals → direction report, with an engraved status line. Under the window, on the desktop, the same title jewel (`orbFor("home-goals")`, the cat in the bed) sits at photograph size (`.gol-desk-plate`). |
| `goals-chrome.css` | `.gol95` milled fascia + recessed wells + metal keys + 10-pip progress + `.gol95-dialog`. `.gol-desk-plate` is the title jewel at photograph height, centered on the desktop under the window (no frame). |
| `ObjectivesPanel.tsx` | Period keys (**Day/Week/Month/Season/Year/All**, persisted): **Prioritized** packed well, collapsible **All objectives** list with mill stars, **Add Objective** dialog (unsaved-changes guard). Rows open detail. |
| `ObjectiveDetailDialog.tsx` | Edit one objective (`data-ui-name="Objective detail"`): title/description, **prioritize per period** (with a custom multiplier, capped), linked goals + their progress, the **contributing completed actions** list, a per-period **review** (success analysis), and archive/delete. Dirty close uses the house unsaved-changes guard. |
| `GoalsContainer.tsx` | Packed goal rows, filterable by period kind (persists). 10-pip progress, linked chips, ±1 / boolean-complete, **Log**. Add/edit dialog requires ≥1 objective. Unsaved-changes guard. |
| `DirectionReport.tsx` | Direction well: CRT coverage + 10-pip channel, 30-day lamp tape (served mint / drift pewter / idle gray), mill **drift dates**, packed neglected list. Same math as before. |

## Logic (pure helpers)

`lib/objectives.ts` (+ `lib/objectives.test.ts`) holds the math:
`periodKeyFor`, `isObjectivePrioritized`/`prioritizedObjectives`,
`MAX_PRIORITIES_PER_PERIOD`, `goalProgressFraction`/`goalProgressPercent`, and the
direction-in-life coverage (`goalsNeedingAttention`, `dayCoverage`,
`directionReport`). Pure — no store access, coverage derived on read.

Multiplier math lives in `lib/goals-store.ts`: `objectiveMultiplierFor` (highest
active priority multiplier, or the `DEFAULT_OBJECTIVE_MULTIPLIER` of **1.5×**) and
`taskObjectiveMultiplier` (the product of each contributing objective's effective
multiplier — multipliers **stack**).

## Data

All objective **and** goal data persists in **`lib/goals-store.ts`**
(`cogs-goals-store` in localStorage; `objectives` + `goals` slices; persist v3).

Each `Objective` (`lib/types.ts`):
- `title`, `description?`, `icon?`, `color?`, `archived?`
- `priorities?: ObjectivePriority[]` — `{ period, periodKey, multiplier }`
- `reviews?: ObjectiveReview[]` — `{ id, period, periodKey, summary, completedAt }`

Each `Goal`:
- `title`, `description?`, `unit?`
- `type`: `count` | `boolean` | `numerical`, `target`, `current`
- `periodKind`: `day | week | month | year | custom | aspirational` (+ `periodLabel`,
  `startDate`/`endDate` for custom ranges like "while in South America")
- `objectiveIds: string[]` — **required**; the objectives this goal serves
- `points` — awarded via `lib/points-store.ts` when completed

26 default objectives (your life directions) and a few example goals are seeded on
first load. CRUD: `addObjective`/`updateObjective`/`deleteObjective`,
`setObjectivePriority`/`clearObjectivePriority`, `saveObjectiveReview`,
`addGoal`/`updateGoal`/`deleteGoal`/`setGoalProgress`.

## Points & completion

Completing a task that contributes to any objective is worth **1.5×** by default;
a prioritized objective uses its custom multiplier (default 2×, editable per
period). Multipliers **stack** across multiple contributing objectives. The
contribution is captured on every completion via the global **completion popup**
(`components/Completion/`), which records `Task.contributesToObjectiveIds` /
`contributesToGoalIds`, advances linked goals, and awards the bonus on top of the
base points. **Undo** on that popup reopens the task as still to-do.

## Prioritization caps & reviews

At most **3** objectives may be prioritized per day/week/month and **5** per year
(`MAX_PRIORITIES_PER_PERIOD`). Each objective can carry a written end-of-period
**review** (analysis of success in furthering it), authored in the detail dialog
and stored on `Objective.reviews`.

## Gaps vs. full spec

- Objective↔goal↔action links are read on demand from contribution fields; no
  penalty amounts on missed objectives yet.
- Goal progress is advanced manually or via "Log" / task contribution.
