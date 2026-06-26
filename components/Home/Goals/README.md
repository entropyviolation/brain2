# `components/Home/Goals/` — Objectives & Goals

The Home **Goals** sub-tab, redesigned around two distinct concepts:

- **Objectives** — your *all-time, aspirational life directions* (qualitative, no
  target or deadline; e.g. "Read a lot", "Be healthy"). An objective can be
  **prioritized** for a period (day/week/month/year), which carries a user-set
  **points multiplier** on contributing actions.
- **Goals** — *quantifiable metrics* over a period that move you toward one or
  more objectives (no goal without an objective; e.g. "Read 20 books this year",
  "Surf once a week"). Tasks contribute to goals (incrementing their value) and to
  objectives (earning stacking point multipliers).

## Files

| File | Purpose |
|------|---------|
| `goals-tracker.tsx` | `GoalsTracker`: thin composition of the three sections below (objectives → goals → direction report). |
| `ObjectivesPanel.tsx` | Two stacked containers driven by one period selector (**Day/Week/Month/Year/All**): a **Prioritized** card on top (objectives prioritized for the selected period; in **All** mode, every active priority across periods, with badges like "Week ×2"), and a **compact, collapsible "All objectives" list** below where a quick **star** prioritizes for the selected period (capped). Rows open the detail dialog. Plus an **Add Objective** dialog. |
| `ObjectiveDetailDialog.tsx` | Edit one objective: title/description, **prioritize per period** (with a custom multiplier, capped), linked goals + their progress, the **contributing completed actions** list, a per-period **review** (success analysis), and archive/delete. |
| `GoalsContainer.tsx` | Quantifiable goals shown together, filterable by period kind (day/week/month/year/custom range/aspirational). Per-goal progress, linked-objective chips, ±1 / boolean-complete, and **Log** (records a completed contributing action and awards the objective multiplier). Add/edit dialog requires ≥1 objective. |
| `DirectionReport.tsx` | "Direction in life" view — a coverage score (share of active days that served a goal/objective), **drift days** (worked but served nothing), and **neglected goals** (no recent contributing action). Derived on read from each task's contribution fields + typed links. |

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
base points.

## Prioritization caps & reviews

At most **3** objectives may be prioritized per day/week/month and **5** per year
(`MAX_PRIORITIES_PER_PERIOD`). Each objective can carry a written end-of-period
**review** (analysis of success in furthering it), authored in the detail dialog
and stored on `Objective.reviews`.

## Gaps vs. full spec

- Objective↔goal↔action links are read on demand from contribution fields; no
  penalty amounts on missed objectives yet.
- Goal progress is advanced manually or via "Log" / task contribution.
