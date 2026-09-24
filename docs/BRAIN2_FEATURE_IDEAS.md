# Brain2 Feature Idea Bank

> **Source:** A close, exhaustive reading of `Brain2Ideas (1).pdf` (134 pages — a
> stream-of-consciousness brain dump mixing classical management theory, task /
> planning / information / network theory, a "fleet of AI agents" architecture
> ("brain2"), a research → source → belief → concept → understanding knowledge
> system, ADHD-specific productivity notes, and assorted second-brain ideas)
> cross-referenced against what Brain2 actually is today (`README.md`,
> `docs/SPEC_MAPPING.md`, `docs/tree.md`, `lib/types.ts`, and the folder READMEs).
>
> **Purpose:** A long, deliberately wide-ranging menu of **potential** buildouts —
> data-model extensions, features, and ways-of-functioning — for Brain2 / Brain2,
> the productivity / self-tracking / planning / review / self-analysis omni-tool.
> These range from small, concrete, near-term additions to deeply "pie-in-the-sky"
> swings. Nothing here is a commitment; it is an idea bank to pull from.
>
> **How to read each entry:** *idea* — a short description, then **From the doc:**
> or **From the text:** (what inspired it) and **In Brain2:** (where it would
> live — store, type, or component). Entries are grouped by app area / theme.
> Numbered 1–464. Expansion III (281–394) is a menu mined from the map, the
> loop, and the meaning layer. Where an idea already has a slice, the entry
> names it (`CY-`, `GS-`, `JG-`). Those slices stay the work order. Expansion
> IV (395–464) is mined from [`brain2taoism.md`](brain2taoism.md). On-screen
> words stay plain. The source term stays in docs.
>
> **Status tags** on an entry (`shipped` / `partial` / `not shipped`) are a Sep 2026
> audit of the “realistic and worth doing” slice only. They are evidence against
> the running tree, not a promise to build the rest of the bank. The work order
> for the ten still-open highest-impact items is
> [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) Wave 11.
>
> **Formulations.** Idea #74 keeps its number. The committed name is
> **formulation**: a dated statement with an author, a role (`inference` or
> `belief`), and a certainty that can change. Relations that need their own
> certainty are formulations too (#77). The build order is Wave 13,
> [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md) Part 3 (GS-5, then
> GS-10). The type is not named Concept.

---

## Audit — realistic slice (Sep 2026)

Checked against the working tree (`lib/`, `components/`, `hooks/`, `electron/`).
**Shipped** means a user can do the thing. **Partial** means types, math, or a
cousin UI exist but the described gesture does not. **Not shipped** means skip
or a dead field.

| # | Idea | Status | Where it lives (or why not) |
|---|------|--------|------------------------------|
| 5 | Summary tasks auto-complete | not shipped | `Task.isSummary` is declaration-only |
| 12 | Resources as links | shipped | `resource-of` + Operations `ResourcesPanel` |
| 14 | Gantt | shipped | Scheduler Gantt view (`.sch95`) |
| 15 | CPM solver | shipped | `lib/critical-path.ts` + Gantt highlight |
| 16 | PERT three-points | partial | Field + solver; no capture UI on the item |
| 18 / 254 | Dependency DAG | shipped | Scheduler Dependencies / `DependencyGraph` (in-house, not React Flow) |
| 19 | WIP warning | shipped | To Do Filters & Sort + yellow chrome warning (`todo-prefs`) |
| 20 | Kanban | shipped (Modules only) | Workspace Kanban; **stripped from Lists** on purpose (v10) |
| 21 | Velocity | not shipped | Points exist; no throughput chart |
| 25 | Predecessor/successor chips | partial | Dependencies tab + typed links; not chips |
| 26 | Standard time from actuals | partial | Calibration uses est vs actual; no per-type “usually N min” |
| 28 / 230 | Procedure + complete-trigger | partial | `ItemTypeRule` `trigger: "complete"` exists; no sequential procedure type |
| 46 / 248 / 249 | Priority formula + live rank | shipped | `lib/priority.ts`, To Do sliders + Priority sort |
| 84 / 184 | Notes as document items | shipped | `lib/note-types.ts` + Docs tab |
| 96 | Mission / why | shipped | `Task.why` on item detail |
| 129 / 264 | Focus timer logging | partial | #129 Module timer writes `timeLogs` on complete; #264 52:17 from load stays out |
| 130 | Time-blindness hints | not shipped | History exists; not shown while doing |
| 136 | Definition of done | not shipped | `Task.definitionOfDone` field only |
| 138 | Trend / change-point | shipped | `lib/metrics.ts` + Analytics Metrics |
| 148 / 232 | Nested lists | shipped | `List.parentListId` + FolderTree |
| 149 | Formula attributes | shipped | `lib/formula.ts` + SheetGrid |
| 150 / 199 | JSON backup/restore | shipped | Settings `BackupRestore` (preview + per-store merge/replace) |
| 153 | Item history / selective restore | shipped | History UI on item detail (`item-activity.ts`); Settings per-store preview restore + `data/recovery-backups/` |
| 161 | Grey past days | shipped | Month/Week cells set `data-past` for elapsed dates (gray furniture) |
| 163 | Click day → day agenda | shipped | Month cell click switches Plan to Day view; Add Event still creates |
| 164 | Nameable periods | not shipped | Goals `periodLabel` is custom-range only |
| 165 | Human week range label | shipped | Plan week header `MMM d – MMM d, yyyy` |
| 172 | Inline add in the grid | not shipped | To Do uses `AddTodoDialog` |
| 177 | Click-to-edit cells | shipped | SheetGrid inline / formula bar |
| 178 | Trailing ghost row | not shipped | — |
| 185 / 198 | Durable store behind repository | shipped (local) | `taskRepository` → Zustand; Mongo is a later swap, not required |
| 201–209 / 276–277 | Operation phases / next rail / post-mortem | shipped | `PhasesPanel`, `ToDoNextRail`, `OperationPostMortemDialog` |
| 223 / 224 | Goal ↔ action coverage | shipped | `lib/objectives.ts` + `DirectionReport` |
| 225 | Coarse → fine scheduler | shipped | Funnel (Scheduler) then Plan times; do not add auto-place |
| 226 | Weekly carry-over | shipped | Reviews `carryOverIncomplete` |
| 227 | Event-linked must-be-done-before | shipped | `lib/event-links.ts` + event dialog checklist |
| 228 | All-day / multi-day banners | shipped | Plan agenda / week / day |
| 233 | Per-list JSON export | shipped | Lists settings → `exportCategory` |
| 234 | Per-list default values | shipped | `createListItem` + Edit List defaults |
| 238 | Burnout early-warning | shipped | `lib/overcommitment.ts` + Analytics → Overcommit |
| 239 | Neglect in Needs Attention | not shipped | Stale tasks yes; neglected *goals/ops* live on Direction / Operation heatmaps only |
| 241 | Global hotkey capture | shipped | `Cmd/Ctrl+Shift+K` + Electron `CommandOrControl+Alt+Space` |
| 242 | Smart-parse dates | shipped | `lib/smart-parse.ts` + Quick Add |
| 243 | Inbox multi-select batch | shipped | Inbox checkboxes → list / deadline / merge / delete |
| 244 | Clarify-all step-through | shipped | Walk selected + rename / discard / recent lists |
| 247 | Idea flags type | not shipped | Quick Add label “Idea” is capture copy, not a type |
| 250 | “Why is this first?” breakdown | not shipped | `priorityBreakdown()` is unused in UI |
| 251 | Manual priority override + log | not shipped | — |
| 253 | Available-now filter | shipped | `lib/available-tasks` + To Do Filters & Sort (default off) |
| 255 | Topological execution preview | partial | Kahn order inside CPM; no “preview sequence” action |
| 256 | Cycle detection on dependency edit | shipped | Item detail refuses a looping dep (`wouldCreateCycle` + Win95 confirm); Gantt still shows existing cycles |
| 258 | Zombie sweeper | shipped | `zombie` from daysPushed / weeksPushed / high entropy; kill / split / clarify on NA |
| 267 | Structured skip reasons | shipped | Reviews `blockedReasons` |
| 268 | Bayesian effort update | not shipped | — |
| 270 | Reward-realized vs anticipated | partial | Satisfaction on completion; no scatter vs `rewardValue` |
| 271 | Review-history charts | not shipped | — |
| 272 | Daily capacity metric | partial | MetricLogger is joy/suffering/alignment/satisfaction, not a capacity score |

**Already closed — do not rebuild:** Kanban-as-Lists-display (#20), collapsing `Task` onto `Item`, Just-Start → Tracking, custom Metrics chart builder, beat-the-clock as a *product story* (#27 exists in `beatTheClockMultiplier` — do not grow it).

---

## Legend of recurring source themes

The document keeps circling a handful of big ideas. They underpin almost
everything below, so they are named here once:

- **Scientific management (Taylor/Gantt/Fayol/Weber):** break work into timed
  component parts, find the "one best way", standardize it, measure against a
  standard, reward beating the standard, separate planning from doing.
- **Cynefin / task-domain classification:** *simple · complicated · complex ·
  chaotic · disorder* — each needs a different handling strategy. Repeated
  emphatically ("Task type identifier definitely need").
- **Information/signal/network theory:** maximize entropy (diverse inputs) at the
  top, drive to certainty at the bottom; minimize redundancy; reduce noise; use
  weak ties; small-world reachability.
- **"Brain2" agent corporation:** a hierarchy of specialized workers with a
  handbook (constraints), procedure (diagram), mission statement (the *why*),
  metrics, retraining, and natural selection of what works.
- **Research → Source → Belief → Concept → Understanding:** a knowledge graph
  where sources carry trust, beliefs carry strength + supporting/refuting
  sources, concepts carry interrelations + certainty, and "understanding maps"
  emerge from concepts + relations.
- **Recursive "molecular" decomposition:** split any task into the smallest
  self-contained steps; if it can't be split, it's *molecular*.
- **Conscious vs. subconscious cognition:** an automatic background process that
  surfaces relevant memories/beliefs/resources to inform the deliberate one.
- **ADHD reality:** paralysis, task-initiation friction, time-blindness, RSD,
  reward-driven behavior, need for structure and externalization.

---

## A. Task decomposition, structure & "molecular" work

1. **Molecular task breakdown.** A one-click "Split into steps" that recursively
   decomposes a task into the smallest self-contained subtasks, stopping when a
   step is atomic ("MOLECULAR"). **From the doc:** the literal "split this task up
   into as many separate steps as you possibly can… if molecular, respond
   MOLECULAR." **In Brain2:** extend `Task.subtasks` with a depth/`isMolecular`
   flag; surface in the To-Do and item-detail subtasks panel.

2. **Background context on every subtask.** When decomposing, each step is worded
   to be understandable out of context (carries its own background). **From the
   doc:** "each step should be worded such that it is understandable even if read
   outside the context of the list." **In Brain2:** a `context`/`why` field per
   subtask object, not just the parent.

3. **Task-domain (Cynefin) classifier.** Tag each task as *simple / complicated /
   complex / chaotic*, and let the domain drive UI and handling (checklists for
   simple, dependency graphs for complicated, experiment-loops for complex).
   **From the doc:** "Task type identifier definitely need: simple, complicated,
   complex, chaotic." **In Brain2:** add `domain` to `Task` + an `ItemTypeRule`
   that adapts the detail panels per domain.

4. **Strategy-per-domain presets.** "Simple → programmatic/best-practice,
   Complicated → hierarchical (low temp), Complex → encourage emergence
   (high temp/creative)." Map each domain to a default workflow template. **From
   the doc:** the explicit simple/complicated/complex mapping. **In Brain2:** a
   workflow preset attached to the domain field.

5. **Terminal vs. summary elements (Gantt vocabulary).** **Status:** not shipped — `Task.isSummary` is declaration-only. Distinguish "terminal"
   leaf tasks from "summary" rollup tasks that complete when their children do.
   **From the doc:** Gantt's terminal/summary element distinction. **In Brain2:**
   `Task.isSummary`; auto-complete summary when subtasks complete.

6. **Concurrency map ("what can/can't be done at the same time").** On any
   project, mark which steps are parallelizable vs. strictly sequential. **From
   the doc:** repeated "what can and cannot be done concurrently." **In Brain2:**
   reuse `dependencies[]` + a `parallelGroup` tag; visualize in a graph view.

7. **"Tricky step" flagging + safety pipeline.** Let the planner flag steps
   likely to go wrong and attach a helper checklist / extra guidance. **From the
   doc:** "Decide which steps might be 'tricky' and create helpful pipelines for
   them not to get messed up." **In Brain2:** `Task.riskFlag` + linked checklist
   item via `ItemLink` relation `"checklist-of"`.

8. **Plan B / contingency per task or project.** Every "area of concern" gets a
   failsafe plan. **From the doc:** "could be cool to create a 'Plan B'… a Plan B
   for every area of concern." **In Brain2:** a `contingency` rich-text attribute;
   show in the Analysis detail panel.

9. **Stages → Steps → Molecular tasks hierarchy.** A three-level project shape:
   high-level *stages* (with desired outputs/benchmarks), *steps*, and *molecular
   tasks*. **From the doc:** "Break into DEPARTMENTS! And Stages… Stages as a
   whole can have desired outputs with benchmarks." **In Brain2:** a new
   `project`/`stage` item type with `links` to child items.

10. **Per-step success metrics.** Each step records its expected output, how
    success is measured, precursors, and resources needed. **From the doc:**
    "For each step: Metrics (expected result/output, how will success be
    measured), precursors, resources needed." **In Brain2:** attributes
    `successCriteria`, `precursors`, `resourcesNeeded` on tasks.

11. **General vs. specific metric formulation.** Two-pass metrics: a loose
    success notion first, then a precise measurable one. **From the doc:** "this
    may need to be made into 2 steps: general and specific formulations of
    metrics." **In Brain2:** optional `metricDraft` + `metricFinal` fields.

12. **"Resources needed" as first-class links.** **Status:** shipped — `resource-of` + Operations Resources panel. A task can declare the
    documents, tools, or people it needs, pre-loaded into its detail view.
    **From the doc:** "Task agents… preloaded with the resources they need."
    **In Brain2:** `ItemLink` relation `"resource-of"`; render resources panel.

13. **Reusable "bits" vs. directed enterprises.** Distinguish recurring reusable
    machinery (e.g. the scheduler, a cleaning routine) from one-off goal-directed
    projects. **From the doc:** "Directed Enterprises… vs Reusable bits — things
    you can call on every day like a scheduler." **In Brain2:** a `reusable` flag on
    workspaces/templates vs. project items.

---

## B. Project visualization & scheduling math (CPM / PERT / Gantt / queueing)

14. **Gantt chart view.** **Status:** shipped — Scheduler Gantt. A real timeline view with bars, durations, start dates,
    and dependency arrows. **From the doc:** extended Gantt explanation (paint-a-
    room example). **In Brain2:** a new Scheduler sub-view driven by
    `Task.scheduledDate` + `estimatedDuration` + `dependencies`. The
    `GraphNode`/`GraphEdge` types already exist in `lib/types.ts`.

15. **Critical Path Method (CPM) highlighting.** **Status:** shipped — `lib/critical-path.ts` + Gantt highlight. Compute and highlight the longest
    dependent chain that determines project end date. **From the doc:** CPM
    section. **In Brain2:** `GraphNode.isOnCriticalPath`/`GraphEdge.isOnCriticalPath`
    already exist — add the solver + render.

16. **PERT three-point estimates.** **Status:** partial — field + solver; no item capture UI. Store optimistic / likely / pessimistic
    durations and compute expected time + variance. **From the doc:** PERT
    section. **In Brain2:** replace single `estimatedDuration` with an optional
    `{optimistic, likely, pessimistic}` estimate object.

17. **Monte Carlo completion forecast.** Simulate project finish-date
    distributions from task estimate ranges; show "70% chance done by X." **From
    the doc:** "Monte Carlo simulations… estimate the best, worst, and most likely
    completion times." **In Brain2:** a pure helper in `lib/` + an Analytics view.

18. **Dependency graph view (graph theory).** **Status:** shipped — Scheduler Dependencies graph (in-house). Tasks as nodes, dependencies as
    edges, to reason over complex relationships. **From the doc:** "graph theory…
    tasks as vertices, dependencies as edges." **In Brain2:** reuse `GraphNode/Edge`
    types; a force-directed view in Scheduler or a new tab.

19. **Queueing/WIP limits.** **Status:** shipped — To Do soft cap (default 3 `partial` tasks). Cap how many tasks can be "in progress" at once to
   reduce thrash and surface bottlenecks. **From the doc:** queueing theory
   ("flow of tasks… reducing waiting times and improving throughput"). **In
   Brain2:** Filters & Sort **In progress cap**; yellow chrome warning when
   exceeded. No hard block, no auto-reschedule.

20. **Kanban board display.** **Status:** shipped as Modules Kanban; deliberately not a Lists display. A column board (To do / Doing / Done, or custom)
    over any list. **From the doc:** "Agile methodologies like Scrum and Kanban."
    **In Brain2:** a new Lists display mode / Module view kind, grouping items by a
    status attribute.

21. **Velocity metric.** **Status:** not shipped. Track how much work (points or count) is actually
    completed per day/week to predict capacity. **From the doc:** "velocity in
    Scrum… predicts how much work an agile team can complete in a sprint." **In
    Brain2:** derive from `points-store` completions; show in Analytics.

22. **Sprint planning module.** Time-boxed batches of tasks with a commitment and
    a retro. **From the doc:** Scrum/agile. **In Brain2:** a Module/workspace
    template binding a list + a date range + a review.

23. **Linear-programming resource allocator.** Given a fixed time budget and task
    values/durations, suggest the optimal subset to do today (knapsack). **From
    the doc:** "Linear programming… find the most efficient way of using limited
    resources." **In Brain2:** a "Plan my day" helper over To-Do using
    `estimatedDuration` + `rewardValue`/`importance`.

24. **Auto-scheduler (constraint solver).** Respect `schedulingConstraints`
    (time-of-day, allowed days/dates, must-be-after/before) to auto-place tasks.
    **From the doc:** the scheduler is a repeated wish; "ML scheduler." **In
    Brain2:** §7.6 is deferred but the constraint fields already exist on `Task`.

25. **Predecessor/successor chips in task detail.** **Status:** partial — dependencies tab, not chips. Quick "comes after / comes
    before" pickers that build the dependency edges. **From the doc:** Gantt
    "predecessors to the task." **In Brain2:** dependencies panel UX upgrade.

---

## C. Estimation, standards & the "one best way" (Taylorism)

26. **Time-and-motion logging on recurring tasks.** **Status:** shipped (standard-time hint) — Calibration still charts estimate-vs-actual; `usualDurationMinutes` now shows a personal usual from observed `actualDuration` / `timeLogs` on the same title or named type. Display-only; does not rewrite `estimatedDuration`. **From the doc:** Taylor's
    time-and-motion studies; Gilbreths filming workers. **In Brain2:**
    `Task.actualDuration` + `timeLogs` already capture this; median per
    recurring title / type is the standard-time glance.

27. **"Standard time" with beat-the-clock bonus (Gantt task-and-bonus).** Award
    bonus points for finishing under the standard time. **From the doc:** Gantt's
    "task and bonus plan… a bonus of up to 20 percent more." **In Brain2:** extend
    `resolveCompletionPoints()` to add a multiplier when `actualDuration <
    estimatedDuration`.

28. **"One best way" procedure capture.** **Status:** partial — complete-trigger rules exist; no procedure type. When a task type is done well, save the
    exact steps as the canonical procedure for next time. **From the doc:** "the
    'one best way' to perform the job"; "Procedure: how things should work, with a
    diagram." **In Brain2:** a `procedure` document linked to an `ItemTypeDefinition`.

29. **Estimate-vs-actual calibration analytics.** Chart your estimation accuracy
    over time to fight time-blindness. **From the doc:** Taylor measurement +
    ADHD "time-blindness." **In Brain2:** new Analytics view over
    `estimatedDuration` vs `actualDuration`.

30. **First-class "standard / benchmark" per item type.** A type can define
    target duration, target quality, expected output. **From the doc:** Taylor's
    "first-class worker" standard. **In Brain2:** add benchmark fields to
    `ItemTypeDefinition.defaultAttributeValues`.

31. **Task templates ("optimized & simplified jobs").** Reusable task blueprints
    with pre-filled steps, resources, and metrics. **From the doc:** "productivity
    would increase if jobs were optimized and simplified… matching a worker to a
    job." **In Brain2:** extend `module-templates.ts` to also scaffold single tasks.

32. **Separate "planning" from "doing" modes.** A dedicated planning surface vs. a
    stripped-down execution surface. **From the doc:** Fayol/Taylor "management
    can plan… workers execute"; "separate planning from doing." **In Brain2:** a
    Focus/Execution mode that hides planning chrome (ties to ADHD section).

---

## D. Plan-vs-reality, control & review (Fayol's "Control")

33. **Plan-vs-reality dashboard.** Side-by-side of what was planned for a period
    vs. what actually happened. **From the doc:** Fayol's *Control* ("verify
    whether things are going according to plan"); systems-approach feedback loops.
    **In Brain2:** the long-noted missing Analytics view; data already in plan-text
    + `timeLogs` + completions. (SPEC §15 gap.)

34. **Intention→outcome variance score.** A single number per period for how
    closely reality matched the plan. **From the doc:** systems-approach feedback;
    "track how your plans actually matched reality." **In Brain2:** derived metric
    in reviews; store on `PeriodReview`.

35. **Feedback-loop prompts in reviews.** Each review surfaces "where did the plan
    diverge and why?" with structured causes. **From the doc:** "asking/analyzing
    why things went well or didn't… brainstorm how to do better." **In Brain2:**
    add structured cause tags to `PeriodReview.reflections`.

36. **Post-mortem on completed tasks.** A quick retro per finished task
    (satisfaction/resistance/focus/distraction). **From the doc:** "review small
    problems as a batch and make decisions to increase overall productivity." **In
    Brain2:** `TaskCompletionReview` type already exists — wire a UI (SPEC §13.7).

37. **Batch problem review.** Group recent failures/overdues and decide a single
    systemic fix. **From the doc:** "Review small problems as a batch and make
    decisions to increase overall productivity." **In Brain2:** a Review sub-step
    listing overdue/pushed tasks with a "root cause + fix" capture.

38. **"What padding/mechanism would prevent this next time?"** A review prompt
    that turns failures into new guardrails. **From the doc:** "what padding or
    extra mechanisms might be created in the future to improve performance." **In
    Brain2:** review answer that can spawn an `ItemTypeRule` or a checklist.

39. **Spawned items from reviews.** A review can directly create next-period
    tasks/plans. **From the doc:** continuous improvement loop. **In Brain2:**
    `PeriodReview.spawnedItems` (SPEC §13 gap) → push into Plan.

40. **Scheduled review prompting.** Proactive nudges when a period closes, beyond
    the header badge. **From the doc:** "Scheduled Reminders or updates to core
    principles." **In Brain2:** extend `lib/pending-reviews.ts` with notifications.

41. **Regret accrual.** Track the cost of not-done important tasks over time.
    **From the doc:** systems feedback + the spec's own §14.4. **In Brain2:** SPEC
    §14.4 missing item; a `regret` ledger parallel to `points-store`.

---

## E. Priority, attention & information theory

42. **Entropy-aware prioritization.** Use the existing `entropy` field as a real
    signal: high-entropy (uncertain) items bubble up for clarification; certainty
    increases as you act. **From the doc:** "Higher entropy at the top, complete
    certainty at the bottom." **In Brain2:** `Task.entropy` exists — feed it into
    To-Do sort and Inbox clarification ordering.

43. **Minimum-redundancy dedup.** Detect near-duplicate tasks/notes and offer to
    merge. **From the doc:** "Principle of Minimum Redundancy… eliminate
    unnecessary or redundant information." **In Brain2:** fuzzy match on
    titles/tags (future MongoDB text/vector search) → merge suggestions.

44. **Maximum-entropy input diversity.** When planning a goal, prompt for diverse
    sources/perspectives to reduce bias. **From the doc:** "maximize the entropy
    of information sources… reducing bias." **In Brain2:** a planning checklist that
    asks for ≥N distinct sources/angles before finalizing.

45. **Noise reduction / Focus mode.** A distraction-minimizing single-task view.
    **From the doc:** signal theory "reduce 'noise'… minimize disruptions." **In
    Brain2:** full-screen focus over one task + its molecular steps; hide all tabs.

46. **Priority formula transparency.** **Status:** shipped — To Do formula sliders + Priority sort. Show how urgency/importance/cognitiveLoad/
    entropy combine into a rank, and let the user reweight. **From the doc:**
    MCDA "weighing different factors." **In Brain2:** the To-Do tiering already
    implies a formula — expose and make it configurable.

47. **Uncertainty-reduction clarification flow.** The Inbox clarifier explicitly
    asks the questions that most reduce uncertainty about a captured item. **From
    the doc:** Uncertainty Reduction Theory; "conduct an interview… get all
    information needed to correctly route the input." **In Brain2:** upgrade
    `TaskClarificationDialog` (SPEC §4.4) with guided routing questions.

48. **Signal/priority broadcasting.** Clear visual "this is the one thing that
    matters today" surfacing. **From the doc:** signaling "priorities,
    responsibilities, expected outcomes… increase clarity." **In Brain2:** a
    pinned "today's signal" slot on the Home dashboard.

---

## F. Decision-making & multi-criteria analysis

49. **Decision matrix module.** A weighted multi-criteria scoring grid for
    choices (options × criteria × weights → ranked result). **From the doc:**
    MCDA; "decision matrices" explicitly listed as a list use-case. **In Brain2:**
    a new Module/workspace view over a list where rows = options, attributes =
    criteria, with a computed weighted score.

50. **Pros/cons + "different methods" capture.** For any decision/task, enumerate
    all known methods with advantages/disadvantages before choosing. **From the
    doc:** "ALL POTENTIAL METHODS FOR ACCOMPLISHING A TASK SHOULD BE INCLUDED!"
    **In Brain2:** a structured `methods[]` attribute (method, pros, cons, cost).

51. **Choice architecture / nudges.** Design defaults and option ordering to steer
    toward intended behavior (recommended option first, friction on bad ones).
    **From the doc:** "Choice Architecture… the way choices are presented
    impacts decisions." **In Brain2:** smart default selection in dialogs; surface
    the "recommended" next action prominently.

52. **Affordance-based environment design.** Configure the app so the
    environment itself affords good behavior (e.g. the easiest path is the planned
    one). **From the doc:** Affordance Theory ("bike lanes afford cycling"). **In
    Brain2:** make the planned next action the lowest-friction button everywhere.

53. **Cost/ease/consequence triage.** Tag options by cost, ease, and downstream
    consequence to compare quickly. **From the doc:** LLCGPT "considering ease,
    cost, and potential consequences." **In Brain2:** three numeric attributes on a
    decision item type.

54. **Game-theory "stakeholder" view.** For decisions involving other people,
    model each party's interests and look for win-win moves. **From the doc:**
    "Game theory… cooperative strategies or win-win solutions." **In Brain2:** a
    decision detail panel listing stakeholders + their interests.

---

## G. Second-brain knowledge graph: Sources

55. **Source as a first-class item type.** A `source` item with content, type
    (full / snippet / report), origin (URL/file/page/chunk), summary, hints,
    tags, trust, and related sources. **From the doc:** the detailed `Source`
    schema appears many times. **In Brain2:** new `ItemTypeDefinition` "Source"
    with those attributes; fits the unified Item model exactly.

56. **Trust score on sources.** A numeric, updatable trust level that grows with
    corroboration. **From the doc:** `trust`, `update_trust()`, `get_trust()`.
    **In Brain2:** `trust` number attribute + a recompute helper.

57. **Fact-checking elevation levels.** Each "check" escalates a source/claim to
    a higher verification tier. **From the doc:** "checked: number of times…
    each time escalating it to a higher level fact checking procedure." **In
    Brain2:** `factCheckLevel` integer; badge in the item card.

58. **Auto-summary + "hint" generation for sources.** Long + short summaries and a
    situational "how to use this" hint. **From the doc:** `get_summary()`,
    `get_hint()`; "short summary and full summary." **In Brain2:** attributes
    `summaryShort`, `summaryLong`, `usageHint` (AI-fillable later).

59. **Source ingestion pipeline (PDF / web / YouTube).** Import a URL, PDF, or
    YouTube video (transcribe), auto-tag and summarize, and save as a source.
    **From the doc:** the whisper/pytube transcription snippet; PDF indexer; "save
    the source document after browsing." **In Brain2:** an importer feeding the
    Source item type (web-only at first).

60. **Index/TOC-based auto-tagging.** Use a document's index, chapters, and
    headers to derive tags; drop tags too dissimilar from content. **From the
    doc:** "Use index to add tags… use chapters and headers… if the tag is too
    dissimilar, don't include it." **In Brain2:** a tagging step in ingestion.

61. **"Approve before ingest" gate.** User reviews and approves sources before
    they enter the knowledge base. **From the doc:** "should be able to 'approve'
    sources before they are 'ingested'." **In Brain2:** a staging area / inbox for
    sources.

62. **Source usage tracking.** Record which items/notes cited a source and how.
    **From the doc:** `uses` ("keeps track of the agents that used this source and
    what they did with it"). **In Brain2:** reverse `ItemLink` index ("cited-by").

63. **Per-source visibility / hidden flag.** Keep some sources in the store but
    hidden from normal views. **From the doc:** `hidden: bool`. **In Brain2:** an
    `archived`/`hidden` attribute already conceptually supported.

---

## H. Second-brain knowledge graph: Beliefs

64. **Belief as a first-class item type.** A `belief` item: statement,
    presuppositions, subject tags, supporting vs. refuting sources, and a dynamic
    strength. **From the doc:** the detailed `Belief` schema. **In Brain2:** new
    item type with `links` to sources via relations `"supports"`/`"refutes"`.

65. **Dynamic belief strength.** Strength computed from number + strength of
    confirming vs. opposing sources (each source also weighted by its trust).
    **From the doc:** "dynamic belief strength based on strength and number of
    confirming and opposing sources." **In Brain2:** a recompute helper in `lib/`.

66. **Support spectrum on links.** Source→belief links carry a level: strong
    support / weak support / no relation / weak refute / strong refute. **From the
    doc:** the exact five-level enum. **In Brain2:** add a `weight`/`stance` field
    to `ItemLink`.

67. **Contradiction detection + resolution.** Flag mutually inconsistent beliefs
    and walk the user through resolving (reword, synthesize, or drop the weaker).
    **From the doc:** `resolve_contradiction()`; "mark conflicts and seek more
    information to resolve." **In Brain2:** a "conflicts" view + guided resolver.

68. **Belief consolidation (dedup/merge).** Detect redundant beliefs and merge;
    keep non-redundant set. **From the doc:** `consolidate_beliefs()`; "eliminate
    redundancy and contradiction in beliefs." **In Brain2:** a maintenance action.

69. **Conclusions drawn from belief sets.** Derive new conclusions from
    combinations of beliefs. **From the doc:** `draw_conclusions()`,
    `develop_conclusions(beliefs)`. **In Brain2:** a `conclusion` item type linked
    to its premise beliefs.

70. **Lockable / "core" beliefs.** Mark certain beliefs as core (hard or
    impossible to auto-edit). **From the doc:** "core_beliefs ## cannot be edited
    (?) or harder to edit"; "lock beliefs or categories to stop them updating."
    **In Brain2:** a `locked` flag on items.

71. **Belief history / evolution trace.** Track how a belief's strength and
    supporting sources changed over time. **From the doc:** "self.history —
    specifically how belief set/strengths have changed over time"; "trace the
    creation, storage and evolution of these ideas." **In Brain2:** an append-only
    change log per item.

72. **Null/dismissed beliefs.** Remember beliefs you've judged irrelevant so they
    aren't re-created. **From the doc:** "Null beliefs: seemingly irrelevant, but
    still there so it doesn't recreate them." **In Brain2:** a "dismissed" archive
    that dedup checks against.

73. **Confidence/certainty on any statement.** Optional certainty value plus a
    short justification ("explanation for the high level of certainty"). **From
    the doc:** "all accepted 'true' statements associated with a formal proof or
    at least an explanation." **In Brain2:** `certainty` + `justification` fields.

---

## I. Second-brain knowledge graph: Formulations & understanding maps

74. **Formulation item type with interrelations.** A `formulation` carries a
    wording, a role (`inference` or `belief`), related formulations, and a
    certainty for each relation. Dated versions (wording, derived strength,
    the person's certainty) are GS-10; the type arrives in GS-5 with role
    `inference` first. **From the doc:** "concepts — as molecular as possible…
    all concepts interrelated"; "each concept should have a certainty." The
    word *concept* is retired: a formulation has an author and a date.
    **In Brain2:** new item type + typed `links`. See
    [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md).

75. **Auto concept extraction from a topic.** Generate an exhaustive
    dictionary for any topic (key formulation → short description). **From the
    doc:** the big "concept generation experiment" (returns `{concept:
    description}`). **In Brain2:** out of Wave 13 (GS-10 does not auto-extract).
    If it is ever built, it seeds `formulation` items.

76. **Understanding maps.** Visual maps where understanding = formulations + the
    relations between them; an "understanding" emerges when relations are certain
    enough. **From the doc:** "Belief → Conclusion → Concepts and Relations →
    General Understanding"; "Maps of meaning." **In Brain2:** a graph visualization
    over formulation items and their links (after GS-10).

77. **Relations as their own objects (with beliefs).** A relation between two
    formulations is itself a formulation that can hold beliefs and certainty.
    **From the doc:** "Relations and concepts both have their own sets of beliefs."
    **In Brain2:** promote significant links to first-class formulation items
    (GS-10). Do not add a second link table for this.

78. **"Express X as a combination of concepts."** Decompose a topic into its
    component concepts you already understand. **From the doc:** "express as a
    combination of the following concepts." **In Brain2:** a detail-panel tool on
    Concept items.

79. **Expand-understanding action.** "Research this more" adds new relations or
    deepens existing ones on a concept map. **From the doc:** "Expand
    understanding of topic = research it more and add more to the understanding."
    **In Brain2:** an action that creates linked sub-concepts/sources.

80. **Categories as "types of understanding."** Categories group understandings
    that share an analogous structure (analogous but different components). **From
    the doc:** "Categories are types of understanding which follow a similar
    structure… analogous but different components." **In Brain2:** richer category
    semantics for the second-brain types.

81. **Double-referencing / forced categories.** An item can belong to multiple
    concept clusters at once; deliberately surface under-represented documents.
    **From the doc:** "things can be double referenced… categories can be forced…
    find the documents not represented for any keyword." **In Brain2:** multi-membership
    is already supported via `Task.categories[]`; add a "gaps" report.

82. **Topic clustering + auto-category labeling.** Extract topics from all notes,
    cluster, and propose smartly-labeled dynamic categories. **From the doc:**
    "Topic extraction from every text… find the topics that cluster… dynamically
    generated categories with smart labels." **In Brain2:** an analytics/maintenance
    job (needs embeddings; aligns with MongoDB vector roadmap).

83. **Self-updating but lockable knowledge.** The graph re-derives itself as new
    sources arrive, except where the user has locked nodes. **From the doc:**
    "Should all be self-updating and able to be user hard-coded… lock beliefs or
    categories." **In Brain2:** background recompute respecting `locked`.

---

## J. Research workflow & document/report items

84. **Document-type items (rich text).** **Status:** shipped — note type + Docs. Notion/Docs-style rich body as an item
    type — already the stated long-term vision. **From the doc:** reports,
    outlines, abstracts everywhere. **In Brain2:** SPEC long-term "document-type
    items"; `Item.body` + an editor.

85. **Report items with attached source list + abstract.** A `report` carries
    content, the full list of sources used, an auto abstract, and "suggested
    further research." **From the doc:** `Report` schema; "create an abstract +
    suggestions for further research." **In Brain2:** report item type linking its
    sources.

86. **Guided research procedure.** A repeatable flow: gather sources → background
    reports → guiding questions → answer (pulling source snippets) → beliefs →
    outline → write. **From the doc:** the multi-page Research_Agent procedure.
    **In Brain2:** a research workspace template chaining these steps as items.

87. **Background-knowledge reports.** Before a deep dive, generate "what would I
    need to know first" sub-topics and short reports. **From the doc:**
    `get_background()`; "list any areas of background knowledge useful to
    understand {topic}." **In Brain2:** a prerequisite-topics generator.

88. **Rabbit-hole depth limit.** Bound recursion when auto-generating background
    reports. **From the doc:** `rabbit_hole_depth`, `max_rabbit_hole`. **In
    Brain2:** a depth setting on the research workspace.

89. **Guiding questions list per topic.** Maintain the open questions that, once
    answered, complete understanding; check them off as sources resolve them.
    **From the doc:** "Create a list of questions to guide your research…
    eliminate redundant questions." **In Brain2:** a `question` item type linked to
    topic + answering sources.

90. **"Is this enough?" readiness gate.** A check on whether current sources
    suffice before writing, with "blind spot" detection. **From the doc:** "does
    it appear the information will be sufficient…?"; "any blind spots in your
    sources?" **In Brain2:** a readiness checklist on the research workspace.

91. **Multi-perspective ("emotional") reports → synthesis.** Generate several
    differing-stance write-ups, then synthesize a neutral lit-review. **From the
    doc:** "Create several 'emotional research reports'… synthesized from
    multiple." **In Brain2:** linked draft items → one synthesized report.

92. **Ask-vs-search sources.** Two modes: "search sources" (returns documents) and
    "ask sources" (returns an answer). **From the doc:** "Search Sources —
    documents / Ask sources — answer." **In Brain2:** two query modes over the
    Source corpus (semantic search roadmap).

93. **Required-sources-first search.** Consult user-uploaded sources first; only
    fall back to others if results are weak. **From the doc:** "user uploaded
    sources are consulted first… others only if result too weak." **In Brain2:** a
    source-priority tier on search.

94. **LaTeX / math note interpreter.** Parse LaTeX math notes, answer questions
    about them, and categorize math concepts. **From the doc:** the "Personal
    LaTeX Math Notes Interpreter" project + "learn to understand/categorize
    math/latex." **In Brain2:** a math-note item subtype with rendering + Q&A.

---

## K. The "Brain2" agent-corporation as an automation/module layer

95. **Handbook of constraints per project.** Project-level absolute rules nothing
    may violate, plus per-item-type rules. **From the doc:** "Handbook:
    Constraints. Absolute rules… each individual employee should also have their
    own set of absolute rules." **In Brain2:** `ItemTypeRule` exists — add a
    project-scope rule set with `block`/`require` actions.

96. **Mission statement (the "why") per project.** **Status:** shipped — `Task.why` on item detail. A first-class WHY that can be
    invoked when stuck. **From the doc:** "Mission Statement: The WHY"; "keep an
    emphasis on WHY the agents are doing what they're doing." **In Brain2:**
    `Task.why` exists for tasks — elevate to projects and surface when overdue.

97. **Procedure diagrams tied to pipelines.** Document how a process works with a
    diagram that can later drive automation. **From the doc:** "Procedure: how
    things should work, with a diagram… tied to the actual pipeline code." **In
    Brain2:** a procedure item with an embedded flow diagram.

98. **Rule engine expansion (triggers/conditions/actions).** Grow the existing
    serializable rule system: more triggers, more actions (notify, spawn task,
    escalate). **From the doc:** the whole authority/accountability/metrics/
    retraining loop. **In Brain2:** extend `ItemRuleAction` /`ItemRuleTrigger` in
    `lib/types.ts` (already designed for this).

99. **Escalation / "move it up" on difficulty.** If a task stalls or exceeds a
    difficulty threshold, auto-escalate (re-prioritize, flag for help). **From the
    doc:** "have a lower level agent assess difficulty… if they can't do it
    properly, move it up." **In Brain2:** a rule that bumps tier / flags after N
    pushes (`daysPushed`).

100. **Difficulty assessment before assignment.** Estimate task difficulty up
     front and route accordingly. **From the doc:** "assess the level of
     difficulty before assigning the task." **In Brain2:** `cognitiveLoad` (1–3)
     exists — use it to route into Focus vs. quick-win lanes.

101. **"Natural selection" of methods (experiment tracking).** Try variants of a
     routine, keep what measurably works, retire what doesn't. **From the doc:**
     "Natural Selection: if an adaptation gives an advantage it should stay…
     internal experiments… to make the right decision in the future." **In
     Brain2:** an experiment log linking a method variant to outcome metrics.

102. **Preference learning ("pick the better of two").** Periodically show two of
     your past plans/outputs and ask which was better, to learn your taste. **From
     the doc:** "TRAINING IDEA: have the user pick between 2 outputs which is
     better." **In Brain2:** an A/B capture stored for later weighting.

103. **Committees / multi-angle deliberation.** For a hard decision, spin up
     several "perspectives" that argue, then converge. **From the doc:**
     "Committees for investigating… HAVE THE COMMITTEES MAKE CHARTS! REPORTS!
     symposium." **In Brain2:** a structured multi-perspective note → synthesis.

104. **Monitoring/contingency predictions.** Make explicit predictions about how
     a project will unfold and watch which branch is occurring. **From the doc:**
     "MONITORING AGENTS THAT MAKE PREDICTIONS FOR CONTINGENCIES… determine which
     projected course is being taken." **In Brain2:** a `prediction` item with
     outcome-tracking; ties to Plan-vs-reality.

105. **Sandboxed experiments + config backups.** Run risky reorganizations in an
     isolated copy; back up working configurations to roll back. **From the doc:**
     "experimental divisions that operate in containers… backup different
     configurations in case something goes wrong." **In Brain2:** snapshot/restore
     of the whole data set (aligns with JSON export/import, SPEC §3).

106. **Caching of recurring outputs.** Cache the result of repeated, identical
     operations (toggleable when you want freshness). **From the doc:** "FrugalGPT
     … a cache of commonly used responses… enable-able/disableable." **In Brain2:**
     a results cache for expensive computed views/AI calls.

107. **Tiered model/effort routing.** Route simple work to cheap/fast handling and
     hard work to heavyweight handling. **From the doc:** "LLM cascade… simple
     tasks to a cheaper model, complex tasks to a more powerful one." **In Brain2:**
     when AI lands, pick model by task `domain`/`cognitiveLoad`.

108. **Tool/resource retriever per task.** Decide which tools a task needs and
     attach usage instructions the worker can reference on error. **From the
     doc:** "query tool retriever"; "training uploaded into memory on how to use
     the tool." **In Brain2:** resource links + a how-to note per task type.

---

## L. Conscious / subconscious cognition & ambient surfacing

Needs-attention and the friend's nudges already raise a lower-level signal into
review, and each one says why. The differential (GS-7) and the extensional
check (GS-4) are the same gesture made visible: show the order, show what was
left out, let the person delay the label. The entries below stay a menu.

109. **Ambient "subconscious" surfacing.** A background process that, given what
     you're doing, quietly surfaces relevant past notes, beliefs, and resources.
     **From the doc:** "Subconscious is constantly responding and evoking relevant
     resources, memories, core beliefs… informs the conscious." **In Brain2:** a
     "related items" rail driven by tags/links/embeddings.

110. **Two-track item detail (foreground + context).** The detail view shows the
     item plus an automatically-assembled context panel (its why, related items,
     relevant beliefs). **From the doc:** "subconscious output is conscious
     input." **In Brain2:** add a context sidebar to `ItemDetailPage`.

111. **"Search your brain" universal semantic search.** One box that retrieves
     across every item type by meaning, not just keyword. **From the doc:**
     "'Search your brain'"; "Search your brain" + semantic search emphasis. **In
     Brain2:** the planned MongoDB text/vector search over all items.

112. **Semantic-reaction triggers.** Certain words/tags in an item automatically
     pull in associated resources/rules. **From the doc:** "Certain words in the
     prompt triggering certain resources? Give them semantic reactions." **In
     Brain2:** keyword→resource rules (a special `ItemTypeRule` trigger on text).

113. **Core principles / knowledge base with scheduled resurfacing.** A small set
     of core principles that periodically resurface for review. **From the doc:**
     "Scheduled Reminders or updates to core principles/core knowledge base." **In
     Brain2:** a "core" list + spaced resurfacing (ties to active recall below).

114. **The "librarian" = active recall.** A spaced-repetition mechanism that
     resurfaces knowledge items for active recall. **From the doc:** "the
     librarian is the active recall mechanism." **In Brain2:** an SRS scheduler over
     note/concept items (intervals stored as attributes).

115. **Memory tiers.** Distinguish long-term (archived), short-term (active),
     and "voluntary/error-handling" (recently-failed) item pools, each surfaced
     differently. **From the doc:** "vector memory for long term, cache memory for
     short term, voluntary memory for error handling, core beliefs continuously
     updated." **In Brain2:** a `memoryTier` attribute influencing surfacing.

---

## M. Capture, multimodal & visual ("Pinterest-y") experience

116. **Visual/gallery-first boards.** A Pinterest-style visual board over image-
     bearing items. **From the doc:** "I literally want it to have an almost
     pinterest-y feel at times." **In Brain2:** the Lists gallery + orbs exist —
     extend to a masonry image board (Module gallery view).

117. **Image-attribute mood boards.** Items with `image`/`multiimage` attributes
     arranged as a visual collection for vibes/decisions. **From the doc:**
     pinterest feel + multimodal search. **In Brain2:** `AttributeType` already
     includes `image`/`multiimage`; add a board layout.

118. **Visual/similar-image search.** Find items by image similarity. **From the
     doc:** "A visual search system takes an image and returns similar items."
     **In Brain2:** future embedding search over item images.

119. **Recommendation surfacing.** "Because you did/saved X, consider Y" across
     lists. **From the doc:** "A recommendation system… returns similar items
     optimizing for an objective." **In Brain2:** a recommendations rail from
     link/tag co-occurrence.

120. **Voice / quick multimodal capture.** Capture by voice (transcribe) or image
     straight into the Inbox. **From the doc:** whisper transcription; multimodal
     emphasis. **In Brain2:** extend Quick Add with audio/image capture.

121. **Comment-section / opinion-corpus analysis.** Paste a discussion thread and
     get a structured map of what people think (stances + frequency). **From the
     doc:** "Symposium style analysis of all comments… develop an awareness of
     what people generally think." **In Brain2:** an analysis tool producing
     belief/stance items.

---

## N. Outsourcing, delegation & the wider world

122. **Delegation / "who does this" assignment.** Assign tasks to other people (or
     a future agent) and track status of delegated work. **From the doc:** the
     whole 4-Hour-Workweek "Outsourcing Life" section; "delegation, proposal, and
     approval." **In Brain2:** an `assignee` attribute + a "delegated" view.

123. **Proposal → approval workflow.** Items can be proposed and require approval
     before becoming active (for delegated or auto-generated work). **From the
     doc:** "Emphasizing the concept of delegation, proposal, and approval";
     "challenge proposal / accept proposal." **In Brain2:** a `proposed` status +
     approve/reject actions.

124. **Service-research tasks.** A task type that researches the best provider for
     a need (e.g. "find the best X near me"), comparing options. **From the doc:**
     "research the best hair place near me"; the Craigslist personal-chef example.
     **In Brain2:** a "service quest" item linking candidate-option items.

125. **Real-world quest templates.** Templates for multi-step life admin (e.g.
     "form an LLC", "hire help") with stages, resources, and contingencies.
     **From the doc:** the recurring "LLCGPT" worked example. **In Brain2:** add to
     `module-templates.ts` alongside Itinerary/Cleaning/Budget.
     **Later (today's friend):** the header baby-animal companion turns asked
     work into **missions** and can pay **point rewards** (`rewardScale`), with
     a per-friend **personality** (Gallery Details). Shipped: species-biased
     bubble, affection/whims, dialog effects, decline-on-animal-click,
     mission sheet, Monday-stable wear, dismiss-forever gallery, personality
     editor, first rewards. Still later: clock, trinkets, listBias picker.
     [`docs/FRIEND_COMPANION.md`](FRIEND_COMPANION.md).

126. **Monitoring/watcher items.** Standing watchers that track an external metric
     over time (price, availability) and alert on change. **From the doc:** "An
     agent to monitor house prices"; "agents keep track of your money/schedule."
     **In Brain2:** a `watcher` item type with a tracked value series.

127. **Finance/money tracking surface.** A dedicated money view beyond the Budget
     template — net worth, recurring costs, runway. **From the doc:** "Agents keep
     track of your money"; "You need money to live." **In Brain2:** a finance
     workspace + transaction item type.

---

## O. ADHD-aware design (executive function support)

128. **Anti-paralysis "just start" mode.** When a task is stalled, collapse it to
     its single smallest next molecular action and a 2-minute timer. **From the
     doc:** the ADHD-paralysis concept maps (task initiation, "Task Breakdown into
     smaller steps"). **In Brain2:** a "start the tiniest piece" button on stuck
     tasks.

129. **Body-doubling / focus-session timer.** **Status:** shipped — Module `Timer` /
     `TimerView` append a `timeLogs` slice on complete (`lib/focus-timer-log.ts`)
     to Working Now’s item, or prompt which item. Stop stays one click. A co-working timer (Pomodoro +
     ambient presence) to externalize accountability. **From the doc:** ADHD
     "structured environment," reward-driven behavior; existing focus-timer view.
     **In Brain2:** session logging is on the Module **timer** view; streaks still later. #264 (52:17 from load) stays out.

130. **Time-blindness aids.** **Status:** shipped (usual-N hint) — Working Now already shows elapsed; `usualDurationMinutes` adds “usually takes you N min” from history on Working Now, Done rows, and the completion dialog. Remaining-time countdown is still later. **From the doc:** ADHD
     "Time-blindness… difficulty comprehending the passage of time." **In Brain2:**
     surface observed duration history inline while doing a task (`lib/estimated-values.ts`).

131. **Immediate-reward scheduling.** Front-load small rewards/points for task
     initiation, not just completion. **From the doc:** ADHD "Reward-Driven
     Behavior… struggle to initiate tasks without immediate rewards." **In Brain2:**
     award partial points on starting (`completedChunks` already exists).

132. **RSD-aware gentle framing.** Soft, non-punitive language for overdue/missed
     items; reframe "failure" as data. **From the doc:** ADHD "Rejection Sensitive
     Dysphoria… self-compassion." **In Brain2:** a tone setting for overdue badges
     and review prompts.

133. **Structured-environment defaults.** Strong routines/templates and
     predictable layouts as the default for users who want them. **From the doc:**
     ADHD "Structured Environment: routine, order, predictability." **In Brain2:**
     a "routine mode" with fixed daily scaffolding.

134. **Externalize-everything inbox.** Frictionless dump-it-here capture so
     nothing has to be held in working memory. **From the doc:** ADHD "Working
     Memory… impaired"; the app's own "capture-first" philosophy. **In Brain2:**
     Quick Add/Bulk Add exist — add a global hotkey + always-on capture bar.

135. **Hyperfocus harnessing.** Detect a long unbroken focus session and offer to
     queue the next related task automatically. **From the doc:** ADHD energy
     patterns + reward-driven behavior. **In Brain2:** chain next task from
     `timeLogs` session length.

136. **Perfectionism guardrails.** **Status:** not shipped — field only. "Good enough" definitions of done to prevent
     endless polishing. **From the doc:** ADHD "Perfectionism… unrealistically
     high standards interfere with completion." **In Brain2:** a `definitionOfDone`
     attribute that caps a task.

---

## P. Self-tracking, metrics & analytics depth

137. **Arbitrary user-defined metrics.** Track any numeric/qualitative metric on
     any schedule (mood, energy, symptom, custom). **From the doc:** "Track
     yourself on any number of metrics at any time, then analyze." **In Brain2:**
     the TimeGrid scopes + habit types are a start; generalize to a `metric` item
     type with a value series.

138. **Trend detection over your data.** **Status:** shipped — Analytics Metrics trends + change-points. Surface emerging upward/downward trends
     and change-points in any tracked series. **From the doc:** "OKAY ABSOLUTELY
     THE ML SCHEDULER WILL USE TREND DETECTION (REALLY EXCITING!!)"; "change-point
     detection." **In Brain2:** a trend-analysis helper feeding Analytics.

139. **Predictive scheduling from patterns.** Suggest when to do a task based on
     when you historically do similar things well. **From the doc:** "ML
     scheduler… trend detection"; metalearning "adapt to new tasks quickly." **In
     Brain2:** SPEC §15.3 deferred predictive analytics; derive from `timeLogs`.

140. **Correlation explorer.** "Does my mood correlate with sleep / exercise /
     task completion?" cross-metric analysis. **From the doc:** self-analysis +
     "analyze that data to understand patterns and trends." **In Brain2:** a new
     Analytics view correlating any two tracked series.

141. **Where-I've-been map.** Map view of logged locations over time. **From the
     doc:** the doc's geo/location interest + the README's own "Where I've been on
     a map" note. **In Brain2:** TimeGrid has a Location scope + `TimeLogEntry.location`;
     add a map (SPEC §15 idea).

142. **Cognitive-state trends.** Chart entropy/cognitiveLoad/mood over time to see
     how your mental state moves. **From the doc:** the "cognitive state"
     framing + information theory. **In Brain2:** `cognitive-state.tsx` exists;
     add a trend chart (SPEC §15 gap).

143. **Category/area performance view.** Which life areas (lists) are thriving vs.
     neglected, by completion + points. **From the doc:** "evaluate performance in
     various areas… why things went well or not." **In Brain2:** SPEC §15
     category-performance view over `task-store` + `points-store`.

144. **Streaks everywhere.** Compute and display streaks for habits, reviews, and
     focus sessions. **From the doc:** reward/consistency emphasis. **In Brain2:**
     SPEC §9.5 streaks gap; a streak widget across habits.

145. **Embedding-stream / semantic shape visualization.** Visualize the "shape" of
     your notes/thoughts in semantic space over time. **From the doc:** "Is there
     a way to graph the embeddings of the sources or the thoughts of an agent
     visually?… semantic isomorphs." **In Brain2:** a 2D projection (UMAP/t-SNE) of
     item embeddings — far-future, vector-search dependent.

---

## Q. Data model & platform foundations (enablers for the above)

146. **Generic typed links graph.** Lean fully into `ItemLink` so any item can
     relate to any item with a typed relation, and visualize the whole graph.
     **From the doc:** knowledge graphs, neurosymbolic "ontologies," "everything
     interrelated." **In Brain2:** `ItemLink` exists in `lib/types.ts`; build the
     graph view + a relation-type registry (SPEC §5 + long-term vision).

147. **Tags as a real dimension (distinct from categories).** Free-form tags
     (e.g. "to schedule") usable for routing, filtering, and semantic reactions.
     **From the doc:** double-referencing, dynamic categories, "to schedule" tag.
     **In Brain2:** `Item.tags` exists; SPEC §6.5 wants "to schedule" as a tag — add
     tag UI + filters.

148. **Nested categories (`parentCategoryId`).** **Status:** shipped — `parentListId` + FolderTree. Hierarchical lists/folders for
     deeper structure. **From the doc:** Weber's hierarchy; knowledge-tree
     framing. **In Brain2:** SPEC §6.2 gap; folders nest but categories don't yet.

149. **Computed / formula attributes.** **Status:** shipped — formula attributes + SheetGrid. Spreadsheet-style formulas and cross-item
     rollups in the grid. **From the doc:** charts/rollups; "in-grid formulas."
     **In Brain2:** SPEC long-term + `spreadsheet-utils.ts` rollups exist; add
     per-cell formulas.

150. **JSON export/import + snapshots + migrations.** **Status:** shipped — full JSON backup/restore. One-click backup/restore of
     everything, with versioned migrations. **From the doc:** "backup different
     configurations in case something goes wrong"; database/logging emphasis.
     **In Brain2:** SPEC §3 highest-leverage gap; `lib/migrations.ts` exists, add
     export/import (a `BackupRestore.tsx` is already stubbed).

151. **MongoDB + semantic/fuzzy/vector search backend.** The durable store that
     unlocks "search your brain," dedup, clustering, and recommendations. **From
     the doc:** vector DBs (Pinecone/Weaviate/Elastic), embeddings, semantic
     search throughout. **In Brain2:** SPEC §3 planned MongoDB layer via Electron
     IPC.

152. **Per-item provenance/origin metadata.** Every item records where/when/how it
     came to exist (captured, imported, spawned-by-review, derived). **From the
     doc:** the `origin` field on sources/beliefs ("URL/filepath/page/chunk OR the
     belief set that gave rise to it"). **In Brain2:** an `origin` attribute on
     `Item`.

153. **Append-only activity log / "inherent logging."** **Status:** shipped — item-detail History (`lib/item-activity.ts`) plus Settings per-store selective restore. Log significant item
     changes for transparency and undo, "so you can see what they're thinking."
     **From the doc:** "Database… creates inherent logging for increased user
     interactability or intervention." **In Brain2:** a lightweight change log
     across stores.

154. **Portable, serializable rules/types (cross-app).** Keep item types, rules,
     and templates exportable so setups can be shared. **From the doc:** "Designed
     to be flexible and portable across applications (fully serializable)." **In
     Brain2:** `ItemTypeDefinition`/`ItemTypeRule` are already serializable — add a
     share/import format.

---

## R. Bigger swings (pie-in-the-sky)

155. **AI "council of advisors" / persona panel.** Consult configurable expert
     personas (and let them debate) over your own data and decisions. **From the
     doc:** "Eventually a website where you can generate collections of text from
     various experts… consult that expert directly, or have those experts
     argue/discuss." **In Brain2:** persona items + a debate view over your sources.

156. **Devil's-advocate / second-thought reviewer.** An automatic challenger that
     pokes holes in your plans and beliefs. **From the doc:** "Lex bot + Second
     Thought bot"; "Challenge proposal." **In Brain2:** a review mode that surfaces
     counter-evidence (refuting links) for your active beliefs/plans.

157. **Goal-reasoning agent.** A system that not only pursues goals but reasons
     about *which* goals to pursue, detecting discrepancies and reprioritizing.
     **From the doc:** the Goal-Driven Autonomy / goal-reasoning Q&A. **In Brain2:**
     a goal-review assistant over the Goals/Objectives model (SPEC §10).

158. **Neurosymbolic "explainable" suggestions.** Any AI suggestion comes with the
     symbolic reasons (which beliefs/sources/rules led to it). **From the doc:**
     extensive neurosymbolic / explainability section. **In Brain2:** attach a
     "why this suggestion" trace (linked items) to every recommendation.

159. **Self-improving system that proposes its own changes.** The app notices
     friction patterns and proposes new rules/templates/automations, run by you
     for approval. **From the doc:** "agents to assess how things are going…
     brainstorm how to do better… Run changes by user." **In Brain2:** a
     "suggested improvements" inbox generated from analytics + review data.

160. **Models develop a shorthand / your personal ontology.** Over time the system
     learns your personal vocabulary for recurring concepts and uses it. **From
     the doc:** "save on token cost by having the models 'speak their own
     language'… develop relevant words for common concepts." **In Brain2:** a
     learned synonym/alias map feeding search + tagging.

---

# Expansion II — 120 additional ideas (June 2026)

> Ideas **161–280** are a second mining pass over a fresh batch of source
> documents (two **Brain2** prototype docs, six **Brain2**-titled docs, and the long
> **"to-do list theory app"** doc), generated by three parallel readings and
> grounded the same way (a passage from the source + a concrete place in the Brain2
> data model / component tree). They are grouped by source batch below; section
> letters restart within each batch.
>
> **AI / cost constraint (applies throughout):** pluggable AI models are kept in
> mind across the whole lifecycle but implemented **absolutely last**, and then
> **self-hosted models only**, for **simple tasks**. The priority is to avoid
> paying for tokens unless critically unavoidable. **Fast-tracked instead:**
> self-hosted **semantic / vector search** (Haystack-style) over ideas, resources,
> and documents — usable inside user-built widgets/plugins — plus classical
> **data-science / ML** (trend detection, clustering, correlation, change-point
> detection, Bayesian estimation, predictive scheduling).

## Batch A · Brain2 prototype docs (161–200)

### S. Calendar & period-view polish (from the planning prototype)

161. **Grey out past days in every calendar.** **Status:** shipped — month and week elapsed cells set `data-past` (gray Win95 furniture, not dark slate). Dim already-elapsed dates across the
     Month/Week views so the eye lands on what is still actionable. **From the doc:**
     the prototype change-list opens with "Calendar — Grey out past days." **In Brain2:**
     compute "is past" against `lib/use-current-date.ts` inside
     `components/Home/Plan/month-view.tsx` / `week-view.tsx`; render a `.fm98`-friendly
     muted cell state (no data-model change needed).

162. **Aligned, clickable week-label rail.** A left rail of week labels that lines up
     pixel-perfect with the calendar rows and, on click, jumps the Plan/Scheduler to
     that week. **From the doc:** "Line up week labels / Make week labels clickable."
     **In Brain2:** add a week gutter to `components/Home/Plan/month-view.tsx` that calls
     into `plan-panel.tsx` state and persists focus via `lib/app-navigation.ts`; week
     keys come from `lib/date-utils.ts` `getWeekString`.

163. **Click any day cell to drill into it.** **Status:** shipped — month click opens Day view via `plan-panel` + `useCurrentDate`; Add Event stays the create control. Clicking a date opens that day's
     agenda/plan rather than only selecting it. **From the doc:** "Make days clickable."
     **In Brain2:** wire `onSelect` in `month-view.tsx` to switch `plan-panel.tsx` to the
     Day view (`day-view.tsx` + `agenda-grid.tsx`) and set the shared selected day used
     by `lib/use-current-date.ts`.

164. **Nameable periods (custom week/month titles).** **Status:** not shipped. Let a user title a week or month
     ("Move week", "Launch sprint") so periods become memorable anchors, not just date
     ranges. **From the doc:** the "week of August 29th… (possibility to name week
     eventually??)" note. **In Brain2:** add an optional `label` to `PeriodReview` and a
     small `periodKey → label` map persisted alongside plan text in `lib/plan-text.ts`;
     surface in Plan headers and the Reviews ritual.

165. **Explicit human date-range label on each week.** **Status:** shipped — Plan week header shows the date range. Show "Week of Aug 29 – Sep 4"
     as the week header, derived live and responsive to the rollover. **From the doc:**
     'Add week label — "week of August 29th - August 30th".' **In Brain2:** a formatter in
     `lib/date-utils.ts` consumed by `week-view.tsx`; reuses the canonical week string so
     it stays consistent with the Scheduler funnel.

166. **Per-day completion progress bar on calendar cells.** Each day cell carries a thin
     bar showing that day's habit + to-do completion ratio. **From the doc:** "Checklist —
     Add progress bar to days." **In Brain2:** derive the ratio from `habits-store` +
     `task-store` completions for that date and render it in `month-view.tsx` /
     `week-view.tsx`; pure math can live beside `lib/calculations.ts`.

167. **Live, responsive "today" header that updates itself.** A date display that
     re-renders at midnight and reflects the currently-selected day everywhere. **From
     the doc:** 'Add date (eventually clickable, updating, responsive).' **In Brain2:**
     already seeded by `lib/use-current-date.ts` (midnight rollover) — extend it to a
     shared, clickable header component reused by Home, Plan, and Tracking.

### T. Weekly composite layout, checklists & agenda

168. **Three-zone weekly composite (checklist · goals/priorities · to-do).** A single
     weekly screen with the habit checklist center, goals/priorities to the right, and
     the to-do list beneath — the prototype's signature layout. **From the doc:** "Goals
     and priorities to the right, to do list below" and "Add goals/priorities (beside
     checklist) / Add to do (beneath checklist)." **In Brain2:** a layout preset in
     `components/Home/home-dashboard.tsx` composing `habit-tracker.tsx`,
     `goals-tracker.tsx`, and `ToDo/todo-panel.tsx` into one bound weekly view.

169. **Inline note / event / reminder on a checklist day.** Drop a quick note, event, or
     reminder directly onto a day without leaving the weekly grid. **From the doc:** "Add
     note/event/reminder." **In Brain2:** reuse `CalendarEvent` (`event-store.ts`) and
     `MonthlyItem` (`type: "deadline" | "reminder"`) from `lib/types.ts`, surfaced via an
     inline affordance in `agenda-grid.tsx` / `week-view.tsx`.

170. **"Practices" — lightweight recurring micro-habits beside the checklist.** A column
     of small daily practices distinct from heavyweight habits, tracked with a tap. **From
     the doc:** "Add practices." **In Brain2:** model as `WeeklyTask` with
     `frequency: "daily"` and `TaskType.BOOLEAN` in `habits-store`, rendered in a compact
     "practices" strip within `habit-tracker.tsx`.

171. **Embedded day plan / agenda inside the week.** Each day expands to a mini agenda
     (free-text plan + timed slots) without navigating away. **From the doc:** "Add day
     plan/agenda." **In Brain2:** embed `Home/Plan/agenda-grid.tsx` (already shared with
     Tracking) plus the `dayPlan-*` free text from `lib/plan-text.ts` into the weekly
     composite.

172. **"Add more tasks" quick-append in the grid.** **Status:** not shipped — To Do add is a dialog. A persistent affordance to keep
     appending tasks to a day/week without opening a dialog. **From the doc:** "Add more
     tasks." **In Brain2:** an inline add-row in `ToDo/TodoTable.tsx` / `AddTodoDialog.tsx`
     that creates `Task`s in `task-store` pre-scoped to the focused date.

173. **Goals/priorities sidebar bound to the active period.** A right-hand rail that
     always shows the current week's top goals and priorities, editable in place. **From
     the doc:** "Add goals/priorities (beside checklist)." **In Brain2:** extend
     `components/Home/Plan/planned-tasks-sidebar.tsx` to surface period-scoped `Goal`s
     (`goals-store`) alongside high-tier to-dos.

174. **Checklist-view day progress, not just list progress.** The Lists checklist display
     gains the same per-day progress bar so any list used as a routine shows momentum.
     **From the doc:** "Checklist — Add progress bar to days." **In Brain2:** add a progress
     header to `components/Lists/list-content/ListContentChecklist.tsx`, computed over the
     list's completed vs. total items.

175. **Staged onboarding that reveals tabs progressively.** Introduce Lists, Points, and
     advanced surfaces only once the basics are in use — the prototype explicitly deferred
     them to "Eventually." **From the doc:** the "Eventually: Add lists tab / Add 'points'
     concept" section. **In Brain2:** a first-run flag in `lib/app-navigation.ts` gating tab
     visibility in `app/page.tsx`, easing new users into the full omni-tool.

### U. Goal typing, inline editing & grids

176. **First-class x/x goal list type.** A list whose items are progress goals rendered as
     "current / target" with a bar, distinct from plain task lists. **From the doc:**
     "Create a specific goal list type for x/x progress per goal." **In Brain2:** the
     `AttributeType` `"goal"` + `GoalValue {current, target}` already exist in
     `lib/types.ts`; ship a built-in `ItemTypeDefinition` "Goal List" whose default
     attribute is a `goal` value, displayed via `attributes/AttributeValueField.tsx`.

177. **Click-to-edit cells, type-to-create rows.** **Status:** shipped — SheetGrid click-to-edit. Editing text by clicking it and adding
     items just by typing at the bottom — frictionless list authoring. **From the doc:**
     "Change tasklist type to allow proper adding & editing (text on click, add by
     typing)." **In Brain2:** strengthen inline editing in
     `components/Lists/list-content/ListContentSpreadsheet.tsx` and
     `components/spreadsheet/SheetGrid.tsx`, plus a persistent "type to add" trailing row.

178. **Trailing "ghost row" on every list display.** **Status:** not shipped. A blank affordance row at the end of
     any list/grid that materializes into a real item on first keystroke. **From the doc:**
     "add by typing." **In Brain2:** add to `Lists/list-content/ListContentPanel.tsx` and
     `SheetGrid.tsx`; creation routes through `createListItem` in `lib/item-utils.ts`.

179. **Goal-progress rollups across a list.** Sum/average `current` vs `target` across all
     goal-typed items to show aggregate progress for a goal list. **From the doc:** the
     x/x-progress goal-list idea. **In Brain2:** extend `lib/spreadsheet-utils.ts` rollups to
     understand `GoalValue`, feeding Module **summary** views and the Lists footer totals.

180. **Editable data grid with an arbitrary number of variables.** Any list can grow new
     typed columns on the fly, mirroring the prototype's variable-count grid. **From the
     doc:** "an interesting way to create table/lists with any number of variables." **In
     Brain2:** the add-column path in `SheetGrid.tsx` extends `TaskCategory.itemAttributes`
     via `attributes/AttributeSchemaEditor.tsx` — generalize column types to the full
     `AttributeType` union.

181. **Goal/priority quick-edit without a dialog.** Edit a goal's target or a priority's
     rank inline, matching the "text on click" ergonomic. **From the doc:** "proper adding
     & editing (text on click)." **In Brain2:** inline `AttributeValueField` editors in
     `goals-tracker.tsx` and the priorities rail, writing straight to `goals-store` /
     `task-store`.

182. **Spreadsheet-as-default for any list flagged "data-heavy."** Lists with many
     attributes auto-open in the grid display so variable-rich data stays legible. **From
     the doc:** the editable data-grid emphasis ("Editable data grid list"). **In Brain2:** a
     per-list `displayMode` preference in `lib/lists-ui-store.ts` defaulting to
     `ListContentSpreadsheet.tsx` when `itemAttributes.length` is large.

### V. The "databrain" prototype — capture, notes & command surfaces

183. **Global command palette for everything.** A keyboard-summoned palette to jump to any
     list/item, run actions, or capture — the prototype's most promising unfinished piece.
     **From the doc:** "Command palette currently needs work but cool idea." **In Brain2:**
     this seam already exists as `components/Search/GlobalSearch.tsx` +
     `components/Search/useGlobalSearchHotkey.ts`; back it with `lib/search.ts` and add an
     actions registry (navigate, create, toggle) over the Zustand stores.

184. **Rich note-taking as a real item type.** **Status:** shipped — note type + Docs. A document-style note with a body editor,
     captured fast and linked to other items — the prototype centered on "React elements
     for note taking." **From the doc:** "React elements for note taking and many other
     things"; "creating/saving notes." **In Brain2:** add a built-in `note`
     `ItemTypeDefinition` with an `Item.body` rich-text field (the README's long-term
     document-type item), edited in `ItemDetail/ItemDetailPage.tsx`.

185. **Bulletproof note autosave + a real repository layer.** **Status:** shipped locally — `taskRepository` over Zustand; Atlas not required. Notes must never silently
     fail to save — the prototype's notes "not really working… maybe issue with database
     access." **From the doc:** "creating/saving notes not really working it seems / Maybe
     issue with database access?" **In Brain2:** route writes through the stubbed
     `lib/data/task-repository.ts` + `lib/data/schemas.ts` with optimistic local persistence
     and `lib/data/backup.ts` snapshots, ahead of the MongoDB cutover.

186. **Self-hosted semantic search over notes & sources (FAST-TRACK).** Search notes,
     resources, and documents by meaning using a local embedding index — no paid tokens —
     and expose it inside user-built widgets. **From the doc:** the databrain's note/search
     ambitions and "many other things." **In Brain2:** build `lib/search.ts` on a self-hosted
     vector index (e.g. Haystack-style, local model), queryable from `GlobalSearch.tsx` and
     bindable as a Module view source — the prioritized semantic-search track.

187. **Command palette as a capture surface, not just navigation.** Typing a sentence and
     hitting enter drops it into the Inbox, so capture is always one keystroke away. **From
     the doc:** the command-palette concept + databrain's capture focus. **In Brain2:** fold
     `components/quick-add.tsx` capture logic into `GlobalSearch.tsx` so the palette routes
     free text to `inbox.tsx`.

188. **"More interactivity per page" — progressive in-place actions.** Surface contextual
     actions (complete, schedule, link, tag) directly on items wherever they appear, rather
     than only in detail views. **From the doc:** "code for a lot more interactivity on
     pages which could be awesome." **In Brain2:** add hover/inline action affordances in
     `Lists/views/*` and `SchedulerTaskItem.tsx`, reusing the mutators in
     `ItemDetail/useItemDetailDraft.ts`.

189. **Login / profile gate for the desktop shell.** A working sign-in so data and (future)
     sync are scoped to a user — the one piece the prototype shipped solidly. **From the
     doc:** "Login system works." **In Brain2:** a local profile gate in `electron/main.js` +
     `preload.js`, scoping localStorage/MongoDB keys per profile (deferred until the
     storage layer lands).

### W. State architecture, links & theming lessons

190. **Atom-style fine-grained cell reactivity.** Editing one grid cell should re-render
     only that cell, learned from the prototype's jotai-atom table. **From the doc:** "Most
     of the action takes place in the atoms and the components"; "jotai table system from
     scratch??" **In Brain2:** use narrow Zustand selectors (and `useShallow`) per cell in
     `components/spreadsheet/SheetGrid.tsx` so large lists stay responsive.

191. **Fix the "weird link structure" with clean typed links.** A coherent, typed
     relationship layer instead of the prototype's confusing linking. **From the doc:**
     "Link structure is kinda weird." **In Brain2:** lean on `ItemLink {relation, targetId}`
     in `lib/types.ts` with pure helpers in `lib/links.ts`, surfaced through
     `ItemDetail/LinkPicker.tsx` and `RelatedItemsPanel.tsx`.

192. **Theme system beyond "ugly rainbow buttons."** A coherent, tasteful palette and
     control styling rather than ad-hoc loud buttons. **From the doc:** "Lol but the ugly
     rainbow buttons." **In Brain2:** centralize palette decisions in `lib/theme-store.ts`
     and the Win95 chrome in `app/win95.css`, with a small set of curated themes.

193. **Drag-to-paint as a reusable interaction primitive.** The prototype's "drag your
     finger" dashboard gesture generalizes to painting state across cells/days. **From the
     doc:** "Maybe like if you drag your finger it does that." **In Brain2:** the 15-minute
     paint pens in `components/Home/Tracking/time-grid.tsx` already do this — extract the
     drag-paint handler for reuse in calendar selection and grid multi-edit.

194. **No third-party grid lock-in (the syncfusion lesson).** Keep the data grid in-house
     so no community-license expiry can break core functionality. **From the doc:** "Has
     syncfusion community license check if still active… to see how much to rely on it."
     **In Brain2:** `components/spreadsheet/SheetGrid.tsx` is already a from-scratch grid —
     keep grids dependency-light and document the deliberate choice.

195. **Separate pure logic from components (atoms/components split).** Keep computation in
     testable pure modules and UI thin — the prototype's "action takes place in the atoms
     and the components." **From the doc:** "Most of the action takes place in the atoms
     and the components." **In Brain2:** this is already the house pattern (`lib/*-utils.ts`
     vs. `components/*`); codify it as a rule so new features (e.g. `scheduler-utils.ts`,
     `todo-utils.ts`) keep math out of JSX.

### X. Onboarding, animation, shell & database

196. **Memorable animated splash / boot screen.** A distinctive opening animation that
     sets the app's identity, in the spirit of the prototype's standout homepage. **From
     the doc:** "INCREDIBLE homepage. Awesome 3js animation"; "the cool homepage
     animation?" **In Brain2:** a lightweight, dependency-free Win95-style boot/splash in
     `app/layout.tsx` (CSS/canvas, no heavy 3D libs) honoring the retro skin.

197. **Mobile / responsive web target alongside desktop.** Design core surfaces to degrade
     gracefully to small screens even if the desktop shell stays primary. **From the doc:**
     "Would be cool transferred to mobile. Still cool if it can't be transferred"; "wouldn't
     transfer to mobile but still awesome." **In Brain2:** use `hooks/use-mobile.tsx`
     (`useIsMobile()`) to drive responsive layouts in `home-dashboard.tsx` and Lists, since
     the build already runs as a plain web app.

198. **Connect to a real database (durable source of truth).** **Status:** shipped locally — same repository seam; Mongo is optional later. Move off fragile
     localStorage to a proper document store, as both prototypes wished. **From the doc:**
     "Connect to a database" (planning prototype) + the databrain's "issue with database
     access?" **In Brain2:** realize the planned MongoDB layer via Electron IPC behind
     `lib/data/task-repository.ts` + `lib/data/schemas.ts`, with `lib/migrations.ts` running
     versioned migrations (SPEC §3).

199. **One-click backup/restore before the DB cutover.** **Status:** shipped — same as #150. Make data portable and safe with
     JSON export/import and snapshots, de-risking the storage migration. **From the doc:**
     the repeated database-access pain in the databrain notes. **In Brain2:** finish the
     stubbed `components/Settings/BackupRestore.tsx` over `lib/data/backup.ts`, exporting all
     ten Zustand stores plus `plan-text` keys (SPEC §3, highest-leverage gap).

200. **Sustained "font & appearance" polish pass.** Treat visual refinement as an explicit,
     recurring workstream, not an afterthought — the prototype literally listed it. **From
     the doc:** "Improve UI (font, appearance)." **In Brain2:** consolidate pixel-font and
     bevel styling across `app/win95.css`, `app/globals.css`, and
     `components/Lists/filemanager98.css`, and add a typography/spacing audit checklist to
     the Reviews ritual for the app itself.

## Batch B · Brain2 docs (201–240)

### Y. Operations — projects as first-class "directed enterprises"

201. **Operation as a first-class item type.** **Status:** shipped — operation type + workspace. Promote the recurring "Operation"
     concept to its own `ItemTypeDefinition` ("operation") — a directed,
     finite-lifespan enterprise that owns goals, objectives, a timeline, a plan,
     tasks, resources, progress, and a completion flag. **From the doc:**
     "OPERATION BASED PLANNING AND TASK MANAGEMENT FOR DAILY LIFE… operation has:
     goals, Objectives, timeline, plan, tasks, Completion (bool), Progress,
     Phases? … Notes, Resources" (`cogs_operations.pdf`). **In Brain2:** register an
     `operation` type in `lib/item-type-store.ts`; it composes with the existing
     `Item`/`ItemLink`/`attributes` primitives in `lib/types.ts` (cross-ref idea
     #9's stages/steps hierarchy).

202. **"Upgrade task → operation" action.** **Status:** shipped — upgrade path lives with operation actions. A one-click promotion that turns a
     stuck or sprawling Next-Actions task into a full Operation, carrying its
     existing subtasks/notes across. **From the doc:** "Operation can be included
     on a next action list => a task can get upgraded to an operation"; "Tasks
     should be able to be upgraded to" (`cogs_operations.pdf`). **In Brain2:** an
     action in `components/ItemDetail/ItemDetailPage.tsx` that re-types the `Item`
     and seeds an operation workspace via `lib/module-templates.ts`.

203. **Operation Home tab with a notes pad + work/neglect heatmap.** **Status:** shipped — Operation Home notes + neglect heatmap. Each
     operation opens to a landing page with a free-text notes area and a calendar
     heatmap of how much you've worked on vs. neglected it. **From the doc:**
     "Home: the home page for the operation, with a text area for the user to
     input and save notes… there is also a heatmap showing the user how much they
     work on/neglect the project" (`cogs_operations.pdf`). **In Brain2:** a
     workspace **notes** view + a per-operation heatmap built from `Task.timeLogs`
     / `points-store` completions (reuse the Analytics habit-heatmap renderer in
     `components/Analytics/enhanced-analytics.tsx`).

204. **Phases as checkpoints with explicit completion criteria.** **Status:** shipped — PhasesPanel / `phase-of`. An operation
     can define ordered "phases"; phase N is complete when its criteria/goals are
     met, which is literally how you know you've entered phase N+1. **From the
     doc:** "Phases??? Like checkpoints. Phase 1- completed when? that's how u
     know ur in phase 2"; "create 'phases' with specific goals or tasks
     associated in order for it to be considered completed" (`cogs_operations.pdf`).
     **In Brain2:** a `phase` sub-entity linked via `ItemLink` relation
     `"phase-of"`, each with a completion `ItemRuleCondition` in `lib/types.ts`.

205. **Operation timeline by "project week #".** **Status:** partial — timeline fields exist; project-week offsets may be thin. Plan deadlines relative to the
     operation's own start ("by project week 3") instead of only absolute dates,
     plus a final project deadline. **From the doc:** "timeline: add deadlines to
     a phase, add final deadline to project, plan when to get everything done by
     project week #" (`cogs_operations.pdf`). **In Brain2:** a relative-offset
     scheduling helper in `lib/scheduling.ts` that resolves project-week offsets
     into concrete `Task.deadline` dates.

206. **Log-while-working stream per operation.** **Status:** shipped — OperationLogFeed from `timeLogs`. A running, timestamped work log
     you append to in the moment, distinct from the static notes pad. **From the
     doc:** "Log while working on!!! Notes !!! for sure" (`cogs_operations.pdf`).
     **In Brain2:** append entries to `Task.timeLogs` (`TimeLogEntry` already carries
     `notes`/`date`) surfaced as a chronological feed in the operation workspace.

207. **"To do next" immediate-next-steps rail.** **Status:** shipped — ToDoNextRail. Every operation keeps a short,
     always-visible queue of the immediate next physical actions, separate from
     the full task backlog. **From the doc:** "To do next. (immediate next steps
     list)"; "Resources / To do next." (`cogs_operations.pdf`). **In Brain2:** a
     filtered view over the operation's child tasks (tag `next` or top-N by tier)
     rendered as a workspace **checklist** view (cross-ref idea #48 "today's
     signal").

208. **Operation post-mortem on completion.** **Status:** shipped — operation post-mortem dialog. When an operation finishes, prompt
     a structured retro: what you did, what to do differently next time, and notes
     — saved as a reusable lesson. **From the doc:** "Review upon completion -
     what you did, what there is to do next time, any notes" (`cogs_operations.pdf`).
     **In Brain2:** extend `PeriodReview`/`TaskCompletionReview` patterns in
     `lib/reviews-store.ts` with an operation-scoped review (cross-ref idea #36
     task post-mortems).

209. **Operation resources panel.** **Status:** shipped — ResourcesPanel. First-class "Resources" section listing the
     documents, tools, links, and references an operation depends on, preloaded
     into its workspace. **From the doc:** "Resources" listed twice in the
     operation shape (`cogs_operations.pdf`). **In Brain2:** `ItemLink` relation
     `"resource-of"` rendered in `components/ItemDetail/RelatedItemsPanel.tsx`
     (cross-ref idea #12).

210. **Systems-view operation dashboard (inputs → process → outputs).** A view
     mode that renders an operation as a self-contained system with inputs
     (resources/dependencies), a process flow with current bottlenecks, and
     outputs (goals/metrics/deadlines), topped by health indicators. **From the
     doc:** "Outcome-Oriented Systems View… Inputs… Process Flow… Outputs… Visual
     dashboard with health indicators (entropy, time overrun)" (`cogs_operations.pdf`).
     **In Brain2:** a new Module **summary/stat** composite that reads
     `Task.entropy` and estimated-vs-actual duration for the overrun gauge.

211. **OKR view mode for operations.** Map an operation to an Objective plus
     measurable Key Results, each with its own progress bar and linked tasks/effort.
     **From the doc:** "Goal-Driven OKR Tracker… Operation = Objective… Attach Key
     Results… Progress bar per KR, task linkage, effort spent per goal"
     (`cogs_operations.pdf`). **In Brain2:** bind the operation to `Objective`
     entities (see idea #214) and render per-KR `goal`-type attributes
     (`AttributeType: "goal"` already exists in `lib/types.ts`).

212. **HTN hierarchical workflow view (expandable tree).** Render an operation as
     a composite task decomposed Plan → Design → Develop → Deploy, with expandable
     tree/collapsible cards and %-complete + blockers per node. **From the doc:**
     "Projects-as-Process (Hierarchical Workflows)… Theory: HTN Planning… Tasks
     nested hierarchically… Visualization: expandable tree or collapsible cards"
     (`cogs_operations.pdf`). **In Brain2:** a tree view over `Task.subtasks` /
     `dependencies`, reusing `GraphNode`/`GraphEdge` in `lib/types.ts`
     (cross-ref ideas #14–18).

213. **Selectable operation paradigm (flow / goal / load).** Let each operation
     switch between the hierarchical, systems, and OKR lenses as a view mode or
     dynamic layered filter, depending on context. **From the doc:** "Each
     approach could be selectable as a view mode or filter, or layered
     dynamically via metadata, allowing users to shift between flow-based,
     goal-based, and load-based views" (`cogs_operations.pdf`). **In Brain2:** a
     `viewMode` setting on the operation `ModuleInstance` in `lib/modules-store.ts`.

### Z. Goals, objectives, actions & "direction in life"

214. **Objective entity (numerical goal over a time period).** Add a first-class
     `Objective` distinct from `Goal`: a concrete, measurable target scoped to a
     period (year/month/custom) with a completion fraction and a separate "track"
     pace fraction. **From the doc:** "objective: id:1 period: year… name: go
     surfing 3 times per month, completed: false, completion: 13/36, track: 12/18"
     (`Brain2 REVIEW_RUNDOWN.pdf`). **In Brain2:** new `Objective` interface in
     `lib/types.ts` + a `goals-store.ts` slice (closes SPEC §10 gap; cross-ref
     idea #157).

215. **Goal ↔ Objective ↔ Action link graph.** Wire the three layers: goals hold
     the "why", objectives quantify them per period, and daily actions roll up to
     both. **From the doc:** "objective… goals: [1,2], actions: [1]"; "action: id:1
     name: go surfing, goals: [1,2], objectives: [1]"; "Daily task actions can
     also be associated with goals" (`Brain2 REVIEW_RUNDOWN.pdf`). **In Brain2:** typed
     `ItemLink` relations `"objective-of"`/`"action-of"` between `Goal`,
     `Objective`, and `Task` items (cross-ref idea #146).

216. **Multi-horizon objective nesting.** A yearly objective contains the monthly
     objectives that ladder up to it ("go surfing 3×/month" under a year target),
     and progress aggregates upward. **From the doc:** the year objective "go
     surfing 3 times per month" alongside "objective: period: month, month: may,
     name: go surfing 3 times" (`Brain2 REVIEW_RUNDOWN.pdf`); "be healthy extends
     across all time periods and has different objectives depending on the time
     period" (`Brain2 REVIEW_RUNDOWN.pdf`). **In Brain2:** `Objective.parentObjectiveId`
     + rollup helper in `lib/calculations.ts`.

217. **"Before I turn 26" custom-range milestone objectives.** Support objectives
     bound to an arbitrary life milestone window rather than a calendar period
     (e.g. "surf 26 times, read 26 books, 1300 chess rating before 26"). **From
     the doc:** "Before I turn 26: 1M followers… surf 26 times… read 26 books…
     1300 chess rating" (`Brain2 REVIEW_RUNDOWN.pdf`). **In Brain2:** add a
     `custom-range` value to `Objective.period` with explicit start/end (closes
     the SPEC §10 milestone gap).

218. **Goal "why" reason-stack surfaced when stuck.** A goal carries a stack of
     ranked reasons (not one line); when a linked task is overdue or pushed,
     resurface the why. **From the doc:** "goal: id:2 name: be good at surfing,
     why: helps you be healthy, the ocean is fun, it's a cool hobby, great
     exercise, meditative…" (`Brain2 REVIEW_RUNDOWN.pdf`). **In Brain2:** a
     `multistring` "why" attribute on the `goal` type; surface it in
     `components/Home/NeedsAttention.tsx` for flagged items (cross-ref idea #96).

219. **Daily goal/priority re-ordering ritual.** A lightweight daily step where
     you reorder your goals/priorities as they pertain to *that* day, captured in
     the day review. **From the doc:** "EACH DAY ORDER YOUR PRIORITIES/GOALS AS
     THEY PERTAIN TO THAT DAY (reviews) also at the beginning/end of each week,
     month, quarter (Season), year" (`Brain2 REVIEW_RUNDOWN.pdf`). **In Brain2:** a
     per-day ordering persisted on the day `PeriodReview` in `lib/reviews-store.ts`
     (note: "Season" = the existing `quarter` review period).

220. **Stakes / self-imposed penalty on unmet objectives.** Let an objective
     declare a consequence (e.g. a money penalty, or auto-purchasing what wasn't
     achieved) that the review surfaces when the period closes unmet. **From the
     doc:** "purchase whatever isn't achieved. (so $25 penalty this month for goal
     not reached)" (`Brain2 REVIEW_RUNDOWN.pdf`). **In Brain2:** a `stake` attribute
     on `Objective`; tie into the Regret ledger (SPEC §14.4, cross-ref idea #41).

221. **Sub-goals with their own measurable targets.** A goal can spawn sub-goals
     that are themselves trackable (e.g. "double account size each month" under
     "optimize social media"). **From the doc:** "sub-goal: double account size
     each month"; "Goal: optimize social media accounts" (`Brain2 REVIEW_RUNDOWN.pdf`).
     **In Brain2:** `Goal.parentGoalId` + `ItemLink` `"subgoal-of"`.

222. **"Entropy-violation" tactic field on goals.** Capture the deliberate,
     diversity-injecting moves that break out of a stale pattern toward a goal
     (mass-unfollow, post longer captions, broaden inputs). **From the doc:**
     "entropyviolation: mass unfollow, post more cool/interesting stuff with
     longer captions… art and soul, good songs" (`Brain2 REVIEW_RUNDOWN.pdf`). **In
     Brain2:** a free-text `entropyViolation` attribute on the `goal` type
     (cross-ref idea #44 max-entropy input diversity).

223. **Action-to-goal alignment tagging on daily tasks.** **Status:** shipped — goal/objective contribution links. Every daily task/habit
     can declare which goal(s) and objective(s) it serves, so completing it
     advances measurable progress automatically. **From the doc:** "Daily task
     actions can also be associated with goals"; "action… goals: [1,2],
     objectives: [1]" (`Brain2 REVIEW_RUNDOWN.pdf`). **In Brain2:** add goal/objective
     link options to the daily-task form (`components/Home/Habits/daily-task-form-dialog.tsx`)
     that increment objective `completion` on completion.

224. **"Direction in life" goal-coverage report.** **Status:** shipped — DirectionReport. A dashboard answering "are my
     daily actions actually serving my expressed goals?" — flag goals with no
     recent linked actions, and days whose tasks served no goal. **From the doc:**
     "ensure I'm on path with all my expressed goals and that I know what they
     are… it's DIRECTION IN LIFE essentially" (`Brain2 REVIEW_RUNDOWN.pdf`). **In
     Brain2:** an Analytics view joining goal/objective links to completions
     (cross-ref ideas #81 "gaps report" and #143 category performance).

### AA. Scheduling refinement, carry-over & calendar planning

225. **Two-step coarse → fine scheduling.** **Status:** shipped — Scheduler funnel then Plan times. Keep the Scheduler as the coarse pass
     (drop a long backlog into a month/week bucket) and Home/Plan as the fine pass
     (assign a specific time or reassign), making the funnel an explicit
     refinement pipeline. **From the doc:** "SCHEDULER: Take long list of general
     tasks… quickly assign them to a given month/week (1st step…), gets refined in
     home/plan where you actually schedule a specific time" (`Brain2 REVIEW_RUNDOWN.pdf`).
     **In Brain2:** formalize the handoff between
     `components/Scheduler/enhanced-scheduler.tsx` (week/month fields) and
     `components/Home/Plan/plan-panel.tsx` (`scheduledDate`/`scheduledTime`).

226. **Default-on weekly carry-over of undone tasks.** **Status:** shipped — review carry-over. At week rollover, all
     undone tasks shift into the new week automatically unless the user opts a
     task out; hardcoded/review-entered items are pinned "must be on". **From the
     doc:** "All undone from prior week, shifted to new week unless otherwise
     specified"; "Must be on: all user hardcoded (or entered from review)"
     (`Brain2 REVIEW_RUNDOWN.pdf`). **In Brain2:** an automatic carry-over pass in
     `lib/scheduling.ts` using `Task.weeksPushed` (closes SPEC §7.7; cross-ref
     existing carry-over prompt in Reviews).

227. **Event-linked to-do checklist (must-be-done-before).** **Status:** shipped — event checklist + `mustBeDoneBefore`. Associate a
     prerequisite to-do list with a calendar event so its items inherit a
     "must be done before <event date>" deadline. **From the doc:** "associate a
     to-do list with an event, like Elijah Anniversary, must be done before: get
     elijah present" (`cogs_home_plan.pdf`). **In Brain2:** `ItemLink` relation
     `"checklist-of"` from tasks to a `CalendarEvent`, deriving
     `schedulingConstraints.mustBeDoneBefore` from `CalendarEvent.date`
     (closes SPEC §7.5; cross-ref idea #7).

228. **Full-day & multi-day banner events.** **Status:** shipped — Plan all-day / multi-day banners. Render reminder-style all-day events
     ("leave for Australia") and multi-day spans ("vacation to Tokyo") as banners
     at the top of the day column, not on the draggable hour grid. **From the
     doc:** "allow full day… or multi day events which should be displayed at the
     top of the day column rather than on the draggable grid" (`cogs_home_plan.pdf`).
     **In Brain2:** use `CalendarEvent.isAllDay`/`endDate` (already in `lib/types.ts`)
     with a banner row in `components/Home/Plan/agenda-grid.tsx`.

229. **Scheduling conflict detection + automatic buffer time.** Warn when
     drag-scheduled tasks overlap, and auto-insert configurable buffer gaps
     between consecutive blocks. **From the doc:** "Conflict Detection: Automatic
     detection of scheduling conflicts… Buffer Time: Automatic buffer time between
     tasks" (`Brain2 REVIEW_RUNDOWN.pdf`). **In Brain2:** an overlap/buffer check in
     `components/Scheduler/scheduler-utils.ts` over `scheduledTime` +
     `estimatedDuration` (cross-ref idea #24 auto-scheduler).

230. **Procedure items: if-then sequential steps that trigger reminders.** **Status:** partial — complete-trigger on rules; no if-then procedure chain. A
     procedure is an ordered chain where completing step N can fire the reminder
     for step N+1, encoding "how this gets done" as runnable structure. **From the
     doc:** "Add something about procedure; if-then sequential steps triggers
     reminders etc." (`Brain2 REVIEW_RUNDOWN.pdf`). **In Brain2:** an `ItemTypeRule`
     with `trigger: "complete"` whose action schedules/surfaces the next linked
     step (cross-ref ideas #28 and #97; rule engine in `lib/item-types.ts`).

231. **Cognitive-state quick-log with user-defined scopes.** Extend the header
     Tracking quick-log to capture activity, feelings, and arbitrary user scopes
     (e.g. "nic cravings"), as a fast "for right now" entry distinct from detailed
     tracking. **From the doc:** "Quick log state (activity, feelings, nic cravings
     if applicable, whatever you want. Quick log for rn)" (`Brain2 REVIEW_RUNDOWN.pdf`).
     **In Brain2:** add configurable scopes to `lib/time-tracking-store.ts` surfaced
     in `components/cognitive-state.tsx` (cross-ref idea #137 arbitrary metrics).

### AB. Lists, attributes, types & capture ergonomics

232. **Sublists nested inside a category.** **Status:** shipped — nested lists (same as #148). Let a list contain named sub-lists
     ("Stuff to learn" → "Frameworks to explore") for one more level of structure
     without a separate folder. **From the doc:** "Add sublists to categories like
     stuff to learn => frameworks to explore or something" (`cogs_Next Actions.pdf`).
     **In Brain2:** `TaskCategory.parentCategoryId` (the missing SPEC §6.2 field) +
     nesting in `components/Lists/navigation/FolderTree.tsx` (cross-ref idea #148).

233. **Per-category JSON export/import (granular, dev-friendly).** **Status:** shipped — per-list JSON export/import. Beyond a global
     backup, allow exporting/importing a single category's lists + tasks as JSON
     from its settings, so individual structures survive iteration. **From the
     doc:** "Add ability to import/export all category/task data as json in Next
     Action/category settings… so [it doesn't] feel like it's dust in the wind…
     (LEARN FROM MISTAKES)" (`cogs_Next Actions.pdf`). **In Brain2:** a per-category
     serializer in `lib/data/backup.ts` wired into
     `components/Lists/settings-dialog.tsx` (cross-ref idea #150 global JSON).

234. **Per-category default values for new items.** **Status:** shipped — list defaultAttributeValues applied on create. When a list defines defaults,
     new items added to it pre-fill those attribute/field values (duration, tier,
     reward). **From the doc:** "Eventually: add ability to add default values to
     created tasks in a category" (`cogs_Next Actions.pdf`). **In Brain2:** surface
     `TaskCategory.defaultAttributeValues` (already in `lib/types.ts`) in the
     attribute editor and apply it in `lib/item-utils.ts` `createListItem`.

235. **Daily habits as a formal subtype of task.** Unify the parallel
     `WeeklyTask`/`Task` worlds so a daily habit *is* a task-subtype that
     participates in points, scheduling, and the grand to-do, instead of a
     separate structure. **From the doc:** "these daily tasks should be considered
     a subtype of task" (`Brain2 MVP.pdf`); "Daily Tasks… Needs to better correspond
     with point value and task structure" (`Brain2 MVP.pdf`). **In Brain2:** model a
     `habit` `ItemTypeDefinition` (capabilities `completable`+`recurring`) bridging
     `lib/habits-store.ts` and `task-store` (cross-ref SPEC §9.4 gap).

236. **"Fully custom attributes" as the default mindset.** Lean into letting users
     attach *any* attribute (urgency, cost, custom) to any item/list, treating the
     built-in fields as just pre-seeded attributes — the "leveled-up spreadsheet"
     ethos. **From the doc:** "Other attributes- urgency, cost, etc. any custom
     ideally" (`Brain2 MVP.pdf`); "Literally just a leveled up version of Allieprime
     in google sheets" (`Brain2 MVP.pdf`). **In Brain2:** expose a richer attribute
     palette in `components/Lists/attributes/AttributeSchemaEditor.tsx`
     (cross-ref ideas #149 formulas and the spreadsheet display).

### AC. Tracking, alignment & predictive analytics (classical/self-hosted)

237. **Intention-vs-alignment tracking score.** Make tracking dual-purpose: log
     what you actually did *and* the intention you set, then compute an alignment
     score between planned and actual time use. **From the doc:** "Dual purp- a.
     log status metrics and track. B. Set specific intentions and track alignment"
     (`Brain2 REVIEW_RUNDOWN.pdf`). **In Brain2:** compare planned `CalendarEvent`s /
     plan-text against `TimeLogEntry` actuals in
     `components/Home/Tracking/actual-day-view.tsx` (classical diff, no LLM;
     cross-ref idea #33 plan-vs-reality).

238. **Burnout / overcommitment early-warning.** **Status:** shipped. Detect upward trends and
     change-points in workload, pushed-task counts, and resistance that precede
     overcommitment, and warn before it happens — using classical change-point
     detection, not an LLM. **From the doc:** "Burnout Prevention: Early warning
     signs of overcommitment" (`Brain2 REVIEW_RUNDOWN.pdf`). **In Brain2:**
     `lib/overcommitment.ts` over `Task.daysPushed` + `timeLogs` (shared Analytics
     range), feeding Analytics → Behavior → **Overcommit** (cross-ref idea #138
     trend detection; honors the self-hosted/classical-first constraint). Does
     not reschedule (#273).

239. **Neglect detector wired into Needs Attention.** **Status:** not shipped in Needs Attention (cousin: Direction + operation heatmap). Surface goals, operations,
     and lists that have gone untouched too long (no recent linked actions or
     logs), extending the existing stale-task queue to higher-level structures.
     **From the doc:** the operation "heatmap showing… how much they work
     on/neglect the project" (`cogs_operations.pdf`) generalized across all areas.
     **In Brain2:** add `neglected` reasons to `lib/needs-attention.ts` (which today
     handles overdue/unclarified/blocked/stale) and render them in
     `components/Home/NeedsAttention.tsx` (cross-ref idea #143).

240. **Semantic search over operation notes, logs & resources.** A fast-tracked
     local/self-hosted vector search (Haystack-style) across every operation's
     notes, work logs, and linked resources, usable from a global box and inside
     user-built widgets. **From the doc:** "Resources… Notes… Log while working"
     accumulate per operation (`cogs_operations.pdf`), and Analytics should
     "eventually analyze patterns" (`Brain2 REVIEW_RUNDOWN.pdf`). **In Brain2:** index
     operation text in the planned local vector layer behind `lib/search.ts` and
     expose it via `components/Search/GlobalSearch.tsx` and a Module search view
     (fast-track per the semantic-search constraint; cross-ref ideas #111 & #151).

## Batch C · "To-do list theory" doc (241–280)

### AD. Capture & clarify (zero-friction inbox, entropy reduction)

241. **Global hotkey "lightbulb" quick-capture overlay.** **Status:** shipped — Quick Add hotkey + Electron global shortcut. A system-wide shortcut
     (e.g. `Cmd+Shift+I`) opens a minimal, blurred-background modal that accepts a
     single line and presses Enter to file it to the Inbox — never forcing
     structure up front. **From the doc:** "global keyboard shortcut (Cmd+Shift+I)…
     opens a minimal modal overlay… Instant capture: press Enter, done"; "hot key
     for quicknote would be cool… maybe lightbulb since it's all ideas." **In
     Brain2:** wrap `components/quick-add.tsx` in a global hotkey handler registered
     in `app/page.tsx` (and an Electron `globalShortcut` in `electron/main.js`);
     extends #134.

242. **Local "smart parse" of dates, times & categories on capture.** **Status:** shipped — `lib/smart-parse.ts`. As you type
     a capture line, classically (regex/`date-fns`, no LLM) highlight detected
     dates/times and `Category:` hints and offer to auto-extract them — structure
     optional. **From the doc:** "'Smart parse' highlights dates, times, and
     categories, offers to auto-extract structure, but never forces structure up
     front." **In Brain2:** a pure `lib/smart-parse.ts` helper feeding
     `components/enhanced-bulk-add.tsx` (which already does `Category:` syntax) and
     Quick Add; self-hosted/classical, honoring the AI-last constraint.

243. **Inbox multi-select batch clarify / merge / move.** **Status:** shipped. Select many inbox atoms
     and apply list or deadline in one action, merge captures, or delete the
     selection after an Are you sure? warning. Select all / Deselect all. Cognitive load /
     context batch is still out. **From the doc:** "Multi-select for batch edit,
     merge, or move to clarify." **In Brain2:** selection + batch toolbar in
     `components/inbox.tsx`; patches in `lib/inbox-batch.ts`; merge reuses
     `lib/item-merge.ts` + Lists `MergeItemsDialog` / confirm (undo via
     `rememberWorld`).

244. **"Clarify all" keyboard-centric step-through mode.** **Status:** shipped. **Walk selected**
     (W) opens `TaskClarificationDialog` for the current checkbox selection
     (Select all to walk every idea): rename, Discard idea, Save & next /
     Skip / End walk, recent lists at the top. Replaces bulk “Clarify All Ideas” staging. **From the doc:**
     "'Clarify all' mode: step through each, fill missing metadata in a 1-click,
     keyboard-centric flow (think Superhuman/Linear UX)." **In Brain2:** walk
     queue in `lib/inbox-batch.ts` over the existing dialog in
     `components/inbox.tsx` (SPEC §4.4); extends #47.

245. **Drag-to-nest inbox items into subtasks.** In the inbox, drag one captured
     atom onto another to make it a subtask, building hierarchy before clarifying.
     **From the doc:** "Drag and drop to reorder or nest ('subtask')." **In Brain2:**
     write to `Task.parentTaskId`/`Task.subtasks` (`lib/types.ts`) from a
     drag-drop handler in `components/inbox.tsx`.

246. **Outcome ("why this matters") as a clarify-time first field.** Distinguish a
     task's *outcome/purpose* from its description and prompt for it during
     clarification, separate from `why`/`consequences`. **From the doc:** atomic
     unit fields "Outcome (purpose)"; "Outcome — Why this matters (e.g., 'Move
     closer to project launch')." **In Brain2:** surface `Task.why` (and a new
     `outcome` attribute) prominently in the `details` panel of
     `components/ItemDetail/ItemDetailPage.tsx`.

247. **Lightbulb "Idea" capture type with light flags.** **Status:** not shipped. Captures can be tagged at
     entry with quick flags (cost, this-weekend, prerequisites) so later sorting is
     cheaper, and pure ideas route to an Idea pool rather than the task lane.
     **From the doc:** "easy simple basic flag/additional info options to make
     sorting job easier later"; the raw dump "Elijah website ($900)… Reading room…
     read, sleep prior, pick outfit." **In Brain2:** an `idea` `ItemTypeDefinition`
     (`lib/item-type-store.ts`) with a `flags` multistring attribute.

### AE. The transparent, editable priority engine

248. **First-class editable priority formula store.** **Status:** shipped — persisted `priorityFormula` weights. Persist the weighted formula
     `Priority = (Importance × Urgency) / (Effort + CognitiveLoadWeight)` with
     user-tunable weights, recomputed live as factors change. **From the doc:** the
     literal `priorityFormula: { urgencyWeight, importanceWeight, effortWeight,
     cognitiveLoadWeight }` in `TaskState`, and "Priority = (Importance × Urgency)
     / (Effort + Cognitive Load Weight)." **In Brain2:** add a `priorityFormula`
     slice to `lib/task-store.ts` and a pure scorer in `lib/scheduling.ts`;
     concretizes #46.

249. **Live priority queue with instant re-rank.** **Status:** shipped — To Do Priority sort. A To-Do view that auto-sorts by
     priority score and re-orders the instant any factor is edited. **From the
     doc:** "dynamic list with live updating scores (if you edit a factor,
     scores/ordering update instantly)." **In Brain2:** a sort mode in
     `components/Home/ToDo/todo-panel.tsx` backed by `todo-utils.ts`, driven by the
     #248 scorer.

250. **"Why is this first?" score breakdown.** **Status:** not shipped — `priorityBreakdown` unused in UI. Hovering a task's rank shows the
     arithmetic (`5 × 4 / (2 + 1) = 6.7`) plus the dependency/critical-path reasons
     it's surfaced. **From the doc:** "Hover on a score: see the breakdown… 'Why is
     this first?' — shows dependency graph, urgency, and critical path
     highlights." **In Brain2:** a tooltip/popover in the `analysis` panel of
     `components/ItemDetail/ItemDetailPage.tsx`; the explainable-trace cousin of
     #158.

251. **Manual score override with an audit log.** **Status:** not shipped. Let the user pin/override a
     computed priority, recording each override so the system can later learn from
     them. **From the doc:** "Option to manually adjust ('override' score, with log
     of overrides)." **In Brain2:** an `overrideScore` field + append-only override
     entries on `Task` (`lib/types.ts`), feeding the change log in #153.

252. **Expected-utility / cost-of-delay triage.** A quick decision aid that
     computes value-of-doing-now vs. later and surfaces the cost of delay and
     opportunity cost to kill or defer low-value items. **From the doc:** "Use
     Decision Theory to Triage Tasks… expected value of doing this now vs later?…
     cost of delay?… opportunity cost?" **In Brain2:** a pure
     `lib/services/triage-service.ts` deriving a delay-cost from `deadline` +
     `importance`; extends #53.

253. **"Available now" dependency-aware filter.** **Status:** shipped — `lib/available-tasks` + To Do Filters & Sort (default off). A filter that hides any task with
     unmet dependencies so the queue only shows what's actually actionable. **From
     the doc:** "Filter by: available tasks (no unmet dependencies)…"; "tasks with
     no unmet dependencies." **In Brain2:** the same unmet-dep predicate in
     `lib/available-tasks.ts` (Scheduler `getAvailableTasks` + To Do Available now).

### AF. Task graph, topological sort & critical path

254. **Atomic-task DAG view (React-Flow-style).** **Status:** shipped — same as #18. Render tasks as nodes and
     dependencies as edges in an interactive directed-acyclic graph for reasoning
     over a project. **From the doc:** "Directed Acyclic Graph… Nodes = tasks,
     Edges = dependencies"; "Interactive DAG visualization using React Flow or D3."
     **In Brain2:** the `GraphNode`/`GraphEdge` types already exist in `lib/types.ts`
     — build the view as a Scheduler sub-view or Module kind; extends #18.

255. **Topological-sort execution preview (Kahn's algorithm).** **Status:** partial — Kahn order inside CPM; no preview action. One button computes
     a valid ordering of tasks respecting all dependencies and flags bottlenecks
     ("You cannot start X until Y is finished"). **From the doc:** "Topological
     Sorting: Generates valid execution sequences (Kahn, 1962)." **In Brain2:** a
     pure `topologicalSort()` in `lib/scheduling.ts` over `Task.dependencies`,
     surfaced in the Scheduler.

256. **Cycle detection with guided fix on dependency edit.** **Status:** shipped — refused on item-detail add; Gantt/graph still show existing cycles. When adding a
     dependency would create a loop, detect it and prompt the user to resolve.
     **From the doc:** "Drag nodes to connect… auto-detect cycles and prompt to
     fix." **In Brain2:** validate in the dependencies mutator of
     `useItemDetailDraft` (`components/ItemDetail/useItemDetailDraft.ts`) before
     writing `Task.dependencies`.

257. **"What if I complete X?" simulation.** Mark a task hypothetically done and
     instantly see which tasks unblock and how the priority queue/schedule shifts.
     **From the doc:** "Option to simulate 'What if I complete X?' and instantly
     see schedule/priority shifts." **In Brain2:** a read-only recompute path in
     `lib/scheduling.ts` that takes an overridden completed-set; pairs with #255.

258. **Zombie-task detector & sweeper.** **Status:** shipped. Auto-flag tasks repeatedly rescheduled /
     long-resident with high entropy, and offer kill / split / clarify actions in
     the weekly review. **From the doc:** "Identify recurring 'zombie' tasks";
     "'Zombie task' sweeper (auto-flag and suggest kill/split/clarify actions)";
     "'Zombie' score: flag if it's been here > X days (entropy)." **In Brain2:**
     `zombie` from `Task.daysPushed`/`weeksPushed` + high `entropy` after
     `zombieResidentDays`, with kill / split / clarify on the Home Needs
     Attention queue (`lib/needs-attention.ts`, `NeedsAttention.tsx`).

### AG. Minute-grid & cognitive-load-aware scheduling

259. **10-minute auto-fill scheduling grid.** A finer scheduling grid that
     auto-fills top-priority tasks into open slots, respecting dependencies and
     personal high-energy windows. **From the doc:** "Grid Planner (10-Minute
     Increments, 6am–10pm)… click 'Auto-Schedule,' and the system fits top-priority
     tasks into optimal windows, respecting dependencies, cognitive load,
     user-defined high-energy times." **In Brain2:** a scheduling pass in
     `lib/services/scheduling-service.ts` feeding `components/Scheduler/DayAgenda.tsx`
     (the TimeGrid is 15-min for *tracking*; this is the *planning* analogue);
     realizes the deferred §7.6 and extends #24.

260. **Alternate-load day template + high-load cap.** A daily scaffold that
     alternates high/low cognitive-load tasks and refuses to schedule more than N
     high-load tasks. **From the doc:** "Alternate high and low cognitive load";
     "No more than 3 'High Load' tasks per day." **In Brain2:** constraints in the
     #259 scheduler keyed off `Task.cognitiveLoad` (1–3); a setting in the
     Scheduler.

261. **Buffer / "drift" blocks after intense work.** Automatically suggest buffer
     and unstructured "drift" blocks after high-entropy tasks or long focus
     sprints, plus one drift block per hour. **From the doc:** "Buffer/Drift blocks
     are suggested after high-entropy tasks or long focus sprints"; "Leave 1 block
     per hour as 'drift time' for flexibility." **In Brain2:** insert synthetic
     buffer `CalendarEvent`s (`lib/event-store.ts`) in `DayAgenda.tsx`.

262. **Cognitive-load & reward color encoding in the grid.** Encode load as
     saturation, reward as warm/cool hue, category as border, completed as dim
     strike-through, so the schedule reads at a glance. **From the doc:** "Color
     coding for: Cognitive load (saturation), Reward (warm/cool hues), Category (tag
     border), Completed (fade/dim with strike-through)." **In Brain2:** a style
     helper in `components/Scheduler/SchedulerTaskItem.tsx` reading
     `cognitiveLoad`/`rewardValue`/`categories`/`completed`.

263. **Scheduling conflict detection + auto buffer.** Detect overlapping
     placements and automatically insert spacing between tasks. **From the doc:**
     "Conflict Detection: Automatic detection of scheduling conflicts"; "Buffer
     Time: Automatic buffer time between tasks." **In Brain2:** an overlap check in
     `components/Scheduler/scheduler-utils.ts` / `Home/Plan/agenda-grid.tsx`,
     warning on drop.

264. **Intensity-based sprint timer (25:5 vs 52:17).** **Status:** not shipped — timer ratio is not load-based. Session logging is #129. The focus timer picks a
     work/break ratio based on task intensity and logs the session. **From the
     doc:** "Apply Pomodoro (25:5) or 52:17 sprinting based on task intensity."
     **In Brain2:** extend the Modules **timer** view
     (`components/Modules/workspace/module-view-bodies.tsx`) to choose a ratio from
     `cognitiveLoad`; extends #129. Do not ship this with Wave 11 item 8.

### AH. Bayesian review, adaptive learning & richer status

265. **Morning review ritual (separate from end-of-day).** A start-of-day flow:
     log dream + wake time, decide which overdue/planned tasks to postpone, set
     intentions, and record affirmations. **From the doc:** "Morning review: Dream,
     Wake time, Decide which overdue/planned tasks to postpone, Set intentions for
     day, Affirmations." **In Brain2:** a `morning` variant in
     `components/Reviews/reviews.tsx` / `lib/reviews-store.ts`, writing wake time
     into the day plan (`lib/plan-text.ts`).

266. **Richer completion status: done / partial / deferred / cancelled.** Replace
     the binary `completed` with a status so reviews and analytics can tell apart
     deferral from abandonment. **From the doc:** "Completion status
     (done/partial/deferred/cancelled)." **In Brain2:** model as a per-type status
     attribute (the intentional non-core field noted in `lib/types.ts`), defaulting
     `Task.completed` semantics; `allowPartialCompletion`/`completedChunks` already
     exist for "partial."

267. **Structured "why blocked/skipped" reasons.** **Status:** shipped — review `blockedReasons`. When a planned task isn't done,
     log a reason from a small taxonomy (ran out of energy, missing input,
     procrastination) for later pattern analysis. **From the doc:** "Prompts to log
     why tasks were blocked/skipped ('ran out of energy,' 'missing input,'
     'procrastination')." **In Brain2:** a `blockedReason` selection attribute
     captured in the carry-over step of `components/Reviews/reviews.tsx`; extends
     #35.

268. **Bayesian effort-prior auto-learning.** **Status:** not shipped. Update each task's (or task type's)
     effort estimate from logged actuals via simple Bayesian updating, so estimates
     self-correct. **From the doc:** "System evolves via Bayesian inference:
     P(new estimate | data) ∝ P(data | estimate) × P(prior estimate)"; effort
     slider "with 'auto-learn' from past logs." **In Brain2:** a classical estimator
     in `lib/services/completion-service.ts` over `estimatedDuration` vs
     `actualDuration`; extends #26 (a self-hosted, non-LLM ML win to fast-track).

269. **Weekly weight-retuning suggestions.** The weekly review evaluates how
     predictive the priority score was and suggests new formula weights. **From the
     doc:** "Tune the weights in your prioritization formula"; "Suggestions to
     retune priority weights based on observed performance." **In Brain2:** a
     `lib/services/review-service.ts` routine comparing predicted rank vs. actual
     completion order, proposing edits to the #248 `priorityFormula`.

270. **Reward-realized vs. anticipated tracking.** **Status:** partial — satisfaction captured; no vs-reward scatter. Capture post-completion
     satisfaction and chart it against the anticipated `rewardValue` to learn what
     actually feels good. **From the doc:** "Reward Value (anticipated
     satisfaction, 1–10)"; "Updated entropy/confusion, reward satisfaction." **In
     Brain2:** `TaskCompletionReview.satisfaction` already exists in `lib/types.ts` —
     wire its capture (SPEC §13.7) and an Analytics scatter.

271. **Self-graphed review history (draw-your-own-conclusions).** **Status:** not shipped. Plot the results
     of every past review and analysis so the user can spot their own patterns,
     not just receive verdicts. **From the doc:** "ALSO!!!! Display graphically
     results of prior reviews and analyses so the user can draw their own
     conclusions, the UI must also support this." **In Brain2:** a reviews-history
     chart in `components/Analytics/enhanced-analytics.tsx` over
     `lib/reviews-store.ts`.

### AI. Cognitive state, capacity & live day-tracking

272. **Daily capacity self-assessment.** **Status:** partial — wellbeing MetricLogger, not a capacity score. A start-of-day modal records sleep, mood,
     and energy and computes a cognitive-capacity score for the day. **From the
     doc:** "Daily Self-Assessment Modal… asks for sleep (hrs), mood (emoji
     slider), energy (1–5)"; "Adjust cognitive load tolerance for the day." **In
     Brain2:** extend `components/cognitive-state.tsx` to store a daily capacity
     record (a `metric`-style series, cf. #137) alongside the TimeGrid.

273. **Capacity-gated scheduling.** When energy is low, the scheduler blocks/defers
     high-load tasks, suggests breaks, or lowers the WIP limit for the day. **From
     the doc:** "Block out high-load tasks when depleted"; "If energy is low,
     prompts to auto-reschedule high-load tasks, suggest breaks, or reduce WIP
     limit." **In Brain2:** feed the #272 capacity score into
     `lib/services/scheduling-service.ts` as a per-day high-load budget; pairs with
     #260 and the WIP idea (#19).

274. **Live "resistance log" during the day.** A minute-by-minute capture of what
     you're doing now, how badly you don't want to do the thing you should, why,
     and what you did instead. **From the doc:** "Input: what you're doing rn, how
     bad you don't want to do what u have to do, why you're not doing what you
     should be… what you did instead." **In Brain2:** add resistance/avoidance fields
     to `TimeLogEntry` (`lib/types.ts`) captured in
     `components/Home/Tracking/actual-day-view.tsx`.

275. **Context-switch heatmap.** Count and visualize how often you jump categories/
     contexts through the day to expose fragmentation. **From the doc:** "context
     switch heatmap"; "Logs and graphs:… context switches." **In Brain2:** derive
     from ordered `timeLogs` + `Task.categories`/`context` in a new Analytics view;
     a companion to the doc's "week view shows 'effort heatmap'" idea.

### AJ. Operations, onboarding & data portability

276. **"Operation" item type (multi-step process with logged hours).** **Status:** shipped — operation type. A first-class
     Operation that lives on a category list, bundles several tasks + goals + a
     status, and rolls up total hours logged. **From the doc:** "Task vs Operation:
     operation is an involved multistep process that involves several tasks… lives
     on category lists with tasks. Operation: … Total hours logged: X. Tasks: …
     Goals: … Status: …" **In Brain2:** an `operation` `ItemTypeDefinition`
     (`lib/item-type-store.ts`) linking child tasks via `ItemLink`, with an hours
     rollup over `timeLogs`; closely related to projects (#9) and the §10
     objectives gap (cross-ref Batch B #201).

277. **Per-operation status review.** **Status:** shipped — operation post-mortem. After working on an operation, run a review
     of its status (hours, progress, blockers) distinct from period reviews. **From
     the doc:** "after working on an operation review the status"; "Review after
     completing tasks." **In Brain2:** an operation-scoped review type in
     `lib/reviews-store.ts` linked from the operation's detail view.

278. **Onboarding setup wizard / goal survey.** A first-run wizard that interviews
     the user about goals and scaffolds starter lists, categories, and a priority
     formula. **From the doc:** "Start: entry setup wizard ai survey to determine
     goals and get started"; "Interactive Tutorial: Walks user through: capture,
     clarify, graph, schedule, execute, review." **In Brain2:** a `components/Onboarding/`
     flow seeding `task-store` categories + the #248 formula; survey logic stays
     local/classical (AI optional, last).

279. **Starter scenario templates (Academic Week / Product Launch / Creative
     Sprint).** One-click sample setups that scaffold lists, attributes, seed
     items, and a schedule for common life patterns. **From the doc:** "Sample Data
     & Templates: 'Academic Week,' 'Product Launch,' 'Creative Sprint,' etc." **In
     Brain2:** add these to `lib/module-templates.ts` next to Itinerary / Cleaning /
     Budget; extends #125.

280. **Multi-format export: JSON + CSV + iCal.** Beyond JSON backup, export tabular
     list data as CSV and scheduled items as a standard calendar file. **From the
     doc:** "Export to CSV, PDF, or connect to Google Calendar"; "JSON Format…
     CSV Export… Calendar Integration: Export to standard calendar formats." **In
     Brain2:** extend `lib/data/backup.ts` / `components/Settings/BackupRestore.tsx`
     with CSV (reuse `lib/csv.ts`) and an iCal serializer over `event-store` +
     scheduled `Task`s; builds on #150.

---

# Expansion III — map, loop, and meaning (Sep 2026)

> Ideas **281–394** mine three readings against the house as it stands:
> Wiener’s *Cybernetics* (the loop), Korzybski’s *Science and Sanity* (the
> map), and Jung’s *Synchronicity* plus a paraphrase of *The Stages of Life*
> (the meaning layer — that PDF is corrupted and was not read page by page).
> The ten Wiener proposals already specified in
> [`cyberneticsbrain2.md`](cyberneticsbrain2.md) Parts 2a and 2b are entered
> here so the bank is complete, each pointed at its slice. The same for the
> general-semantics slices in
> [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md) and the meaning
> slices in [`JungBrain2.md`](JungBrain2.md). Everything after those is a
> further direction. The product never names the books. A coincidence is
> shown and never written as a cause. A derived number stays labeled.
> Nothing here re-sequences Waves 13–15.

## Batch D · The loop (Wiener)

### AK. Closes already drawn (281–290)

281. **The homeostat.** Bands, not targets, for a few slow variables (sleep,
     screen, inbox size, deep work, a mood floor). A 7-day needle. Inside the
     band, silence. Outside it, one correction a day, and the message stops
     when the needle returns. **From the text:** life holds only inside narrow
     bands; the governors are slower than voluntary action (pp. 114–115); a
     sharp thermostat hunts (pp. 96–97). **In Brain2:** `lib/homeostat.ts`,
     bands on metric definitions, a Home widget, one Analytics view.
     **Slice:** CY-2.

282. **Telltales on every planned block.** A lamp goes green, amber, or red
     when the block ends. Red means nothing came back, and BIM asks one
     tap: done, partial, didn’t, moved. The answer is observed. **From the
     text:** don’t assume the order was carried out; snow bends the signal
     arm (p. 96); action without a report is ataxia (pp. 95–96). **In
     Brain2:** `lib/telltale.ts` over plan text and tracked time; readback
     beside the other BIM apply handlers. **Slice:** CY-3.

283. **The re-weighting pass.** Once a week the house replays its own games
     and proposes new priority weights, a per-type estimate multiplier, and
     habit point values. Old, proposed, and *n* sit on one card. Accept or
     reject. Nothing moves in silence. **From the text:** the checker machine
     stops, refits its weights, and plays as a new machine (pp. 172–173).
     **In Brain2:** `lib/reweight.ts` into the weekly review, then the To Do
     formula panel. **Slice:** CY-6.

284. **Maxwell’s demon: credit for order made.** A third ledger beside points
     and regret. Clarifying, merging, splitting, and answering a question
     earn the entropy they removed. Each capture channel shows its signal
     share against its noise. **From the text:** information is negative
     entropy; the demon sorts only by acting on information (pp. 57–58, 61).
     **In Brain2:** `lib/negentropy.ts` on the mutation service; Analytics →
     Channels. **Slice:** CY-7.

285. **The rhythm lab.** Autocorrelation and a spectrum over sleep midpoint,
     first tracked minute, mood, habits, screen. Name the periods, the
     clumps, the gaps, how far bedtime slides when cues weaken, and the
     hours when work actually lands so Plan can sit in the open gate. **From
     the text:** hidden periods in a wave; rhythms pull each other into step
     (pp. 183–200). **In Brain2:** extend `lib/metrics.ts` and
     `components/Analytics/SpectrumView.tsx`. **Slice:** CY-8. The naive
     periodogram is already there; this is the naming, the drift, and the
     gate.

286. **Damp a task that keeps getting pushed.** The fifth push to tomorrow is
     as easy as the first. After two pushes the default becomes a smaller
     step, a wider date, or Someday. Three swings and Overcommit marks it
     hunting. **From the text:** too much feedback is purpose tremor; lower
     the gain (pp. 7–8, 95–97, 110). **In Brain2:** `pushTaskOnePeriod`, the
     push menus, Needs Attention. **Slice:** CY-4. The zombie flag already
     counts the swings; this changes the next offer.

287. **Aim where the day will be.** While the plan is being built, show the
     compensated total: planned hours beside likely hours at the person’s
     usual ratio, with *n*, and a faint tail on each block. The raw estimate
     stays. The tail is derived. **From the text:** a lagging effector needs
     a predictor; aim at where the target will be (pp. 112–113). **In
     Brain2:** per-type median on `lib/calibration.ts`, drawn in the Plan
     agenda. **Slice:** CY-5.

288. **Minority report when sources split.** Sleep log against the painted
     grid, completion evidence, location, screen. The winner still wins. The
     loser stays as a chip: both values, both sources. The week lists the
     chips so a dead Shortcut can be seen drifting. **From the text:**
     checking machines take the majority and signal where the minority
     differed (p. 145). **In Brain2:** `lib/collate.ts` from sleep inference,
     completion window, and screen sync. **Slice:** CY-9.

289. **Words that stop the broom.** A workflow cannot be saved without an
     intent sentence, a dry run over the last 30 days, a rate limit that
     pauses it, and an append-only run log with undo. Workflows that write
     habits, points, or Tracking cannot trigger each other. **From the
     text:** the sorcerer’s apprentice; a learning machine does exactly what
     you ask (pp. 175–177). **In Brain2:** `WorkflowBuilder.tsx`, the runner,
     a sixth law in `docs/MODULE_PLATFORM.md`. **Slice:** CY-10.

290. **One affective tone.** Points and regret become one signed series over
     a few days. Falling tone raises quick wins. Rising tone lets heavier
     work through. The friend reads the same signal. One lamp. The formula
     shows the tone as its own line. **From the text:** affective tone is one
     scale, totaled and broadcast “to whom it may concern” (pp. 127–129).
     **In Brain2:** `lib/affective-tone.ts` into `lib/priority.ts` and
     `lib/friend-suggestion.ts`. **Slice:** CY-11.

### AL. Seven gaps with no slice yet (291–297)

291. **A weather map, not a pair of series.** Correlation Explorer compares
     two columns. Offer a joint forecast the person can accept as derived:
     sleep, screen, and load together name tomorrow’s likely completion,
     with the sample floor and a band. **From the text:** useful prediction
     reads several series at once, like a daily weather map (p. 88). **In
     Brain2:** a pure function beside `lib/metrics.ts`; one Analytics card;
     never a cause sentence.

292. **The chain’s chance, not only its path.** Scheduler and Operations show
     the critical path. Also show the chance the whole chain finishes if
     each step is uncertain: a chain of *n* steps fails sharply once each
     step’s odds fall below *p*^(1/*n*). Name the step whose small drop
     would collapse the rest. **From the text:** long chains of unreliable
     relays (pp. 150–151). **In Brain2:** extend `lib/critical-path.ts` with
     a survival figure from completion history per type; a watermark under
     the sample floor.

293. **Nudges that fade, and light up on a change.** The same friend line,
     lamp, or reminder loses force the way the eye stops seeing a constant
     light. Dim a nudge by how often it has fired unchanged. Relight it only
     when the underlying fact changes (a new push, a band exit, a broken
     streak). **From the text:** organisms respond to edges and differences,
     not to steady states (pp. 135–136). **In Brain2:** a small firing ledger
     on friend lines and home lamps; the steady state stays in the data and
     leaves the chrome.

294. **Mark when a metric began, and allow a lighter baseline.** Studying a
     market changes the market. Let the person mark a baseline span of
     lighter tracking, and stamp the day a new metric started, so a later
     trend can be read against the era it belongs to. **From the text:**
     observation disturbs the thing observed (pp. 163–164). **In Brain2:** an
     epoch record on metric definitions; Analytics charts draw a vertical
     line at the epoch and can hide the baseline from the fit.

295. **How far a module’s decisions travel.** A room is part of the house only
     as far as its messages reach. Score each module by writes that other
     rooms actually read, against writes that die inside it. A low score is
     a guest. **From the text:** a community extends exactly as far as its
     communication; autonomy is decisions made inside versus orders from
     outside (pp. 157–158). **In Brain2:** a pure count over the activity
     ledger and module grants; a line on the module’s own settings, not a
     new noun.

296. **The person only at the start and at the end.** Many BIM and review
     flows still ask in the middle. Where an item’s type or list already has
     a rule, run the middle and confirm once at the end. **From the text:**
     the ideal machine needs a person to set the goal and to receive the
     result (p. 118). **In Brain2:** a “finish unattended” flag on
     `ItemTypeRule`, with the run log from #289 so the middle can be undone.

297. **Learn what matters by watching attention.** The friend and Needs
     Attention read explicit fields. Also read what is opened, dwelt on, and
     acted on, as observed behavior, and let that raise or lower a
     suggestion. Never store it as a trait. **From the text:** a companion’s
     concerns are learned where their attention spikes (p. 157). **In
     Brain2:** a dwell ledger beside item activity; `lib/friend-suggestion.ts`
     and `lib/needs-attention.ts` take it as one more input, labeled derived.

### AM. Further mechanisms (298–316)

298. **Draw the tremor.** A task whose date or list has swung three times
     shows a slight jitter in the calendar until the push is damped (#286).
     The picture is the diagnosis. **From the text:** purpose tremor
     (pp. 95–97). **In Brain2:** a class on the Plan chip driven by the same
     swing count Overcommit already wants.

299. **The white box next to the black box.** Every friend suggestion can be
     opened to the small model that produced it: which fields, which tone,
     which dwell. Edit the model, not only dismiss the line. **From the
     text:** learning is building a white box that behaves like the black
     one (preface; the white-box parallel). **In Brain2:** a disclosure on
     the friend card; the model stays the existing suggestion inputs.

300. **Quiet near overload.** As open loops approach a jam, new captures
     still land, and the house stops speaking: no friend line, no extra
     lamp, inbox held as a queue. Speech returns when the count falls.
     **From the text:** traffic jams near the edge of channel capacity
     (pp. 94–95 in the overload parallel). **In Brain2:** a gate in the home
     lamp and friend scheduler, reading inbox size plus open regrets.

301. **The miss, on the skin you still have.** The red telltale (#282) can
     also be one phone tap and nothing else — a prosthesis reporting through
     intact skin, not another panel. **From the text:** a prosthetic sense
     should arrive on skin that still feels (p. 26). **In Brain2:** BIM
     readback only; no new screen.

302. **Bring the day to a standard position.** Before two days are compared,
     shift each so waking is zero. A jet-lagged Thursday can then lie on a
     Monday. **From the text:** gestalt recognition brings the figure to a
     standard position before matching (pp. 30–33 region; the gestalt
     parallel). **In Brain2:** an overlay mode on the day density calendar,
     computed at read time.

303. **Repetition lowers the threshold.** A habit done often should start
     with fewer gestures: the timer already armed, the list already open.
     Memory here is a changed threshold, not a badge. **From the text:**
     memory is stored as altered thresholds of synapses (the threshold
     parallel). **In Brain2:** per-habit start friction in the habit row,
     derived from recent completions, reversible.

304. **Many keys for one memory.** Recall a moment from a place, a mood, a
     tag, or an hour, not only from its title. Any partial cue opens the
     same item. **From the text:** memory is not a lock with a single key.
     **In Brain2:** the existing search plus a “cues” chip row on item
     detail (time, place, company, symbol) that all query the same graph.

305. **Two oscillators on one card.** Sleep midpoint and the work gate (#285)
     drawn as two cycles that lock or drift apart. Entrainment you can see.
     **From the text:** parallel generators govern each other (pp. 183–200).
     **In Brain2:** one Analytics figure reusing the spectrum’s series; no
     new store.

306. **Diameter of the house.** Besides the guest score (#295), show the
     longest path a fact must travel between rooms. A fact that takes four
     hops to reach Tracking is a far province. **From the text:** a community
     reaches only as far as its messages (pp. 157–158). **In Brain2:** a
     graph over module grants and typed links; a number on the Observatory.

307. **Copy the function, not the shell.** Export a module as the behavior
     (rules, views, pens, point weights) without the personal items, and let
     the copy keep the function if the template’s rules are revised.
     **From the text:** self-reproduction copies the function, not only the
     shape. **In Brain2:** a structure-only bundle beside
     `lib/module-templates.ts`; personal stores stripped by the same rules
     as #356.

308. **Probe mode.** A new habit’s first three days ask only “did it move?”,
     with the 2-minute timer, and do not grade the day. The icy road is
     tested with a small step before the week grade exists. **From the
     text:** small probes before you commit the car (p. 113). **In Brain2:**
     a status on the habit beside Just Start; week grade ignores probe days
     and says so.

309. **A hormone bus.** Tone (#290) is posted once, and any widget may
     subscribe. No widget reaches into the points store itself. **From the
     text:** the totalizer broadcasts to whom it may concern (pp. 127–129).
     **In Brain2:** one derived value in the home store; widgets read it.

310. **A day the weights do not learn.** One weekday, chosen by the person,
     records everything and refits nothing. The machine takes time off so a
     bad week cannot become policy. **From the text:** the checker stops
     playing in order to replay (pp. 172–173), and learning should not run
     in the same breath as acting. **In Brain2:** a flag on the re-weight
     pass (#283); the ledger still appends.

311. **Tomorrow as a ghost day.** The spectrum (#285) can draw tomorrow’s
     likely shape in the Plan week as a ghost: faint blocks where completions
     usually cluster. Ghosts are not events. **From the text:** prediction is
     an operator on the past. **In Brain2:** Plan week, derived layer, same
     separation as plan ghosts versus tracked time.

312. **Static before the gate.** Captures under a clarity floor wait in a
     tray and do not enter the Inbox count the homeostat watches. The demon
     is not fed noise. **From the text:** noise drives the information in a
     message toward zero (p. 64). **In Brain2:** a holding stage before
     Inbox clarify; promoting a note is the decision that counts as signal
     in #284.

313. **Order decays unless kept.** Open tasks gain a small daily disorder
     unless touched. The curve is visible. Sorting is how the house stays
     alive. **From the text:** the stable state of a living demon is death;
     it must keep sorting (p. 58). **In Brain2:** a derived drift on
     `Task.entropy`, shown, never written back as if the person had edited
     it.

314. **Patch cords that expire.** A one-off link between two items (a trip
     and a list, a guest and a week) can be tied for *n* days and then
     dissolve, leaving the history of the tie. Frequent jobs stay standard
     parts. Rare jobs stay temporary wiring. **From the text:** standard
     parts for frequent jobs, a switchboard for the rest (pp. 131–132).
     **In Brain2:** an expiry on `ItemLink`; the activity ledger keeps the
     fact that the cord existed.

315. **Show the lag the predictor must lead.** For each type, the median
     minutes between “I’ll do this” and the first tracked minute. The
     compensator (#287) leads by that lag, and the person can see the lag
     itself. **From the text:** compensation exists because effectors lag
     (pp. 111–113). **In Brain2:** a line on Calibration, derived from
     schedule stamps and `timeLogs`.

316. **Three clocks, one fact.** Phone activity, desktop activity, and the
     stated log vote on “was this hour worked?”. Agreement is quiet.
     A single dissent files the minority report (#288) and names the clock.
     **From the text:** redundancy is how a machine checks itself
     (pp. 145–146). **In Brain2:** the collator, with ActivityWatch and
     Shortcuts as two receptors and the day note as the third.

## Batch E · The meaning layer (Jung)

### AN. Directions named in the reading (317–327)

317. **A coincidence is its own object.** One inner record (mood, dream,
     thought) paired with one outer record (event or item), each dated. The
     pairing is the item. The house lists both members and never writes a
     cause. **From the text:** the unit is the inner state and the outer
     event together (definition, p. 34). **In Brain2:** a `coincidence` link
     between existing items. **Slice:** JG-1, JG-2. This entry is the link
     type those slices already specify.

318. **A hunch that returns.** A dated item with a question and a return
     date: “Did this happen?” Hits and misses score like Calibration, against
     a chance baseline, with *n*. **From the text:** some coincidences are
     seen at once; some are confirmed later, at a distance or in the future
     (categories 2 and 3, p. 121). **In Brain2:** an item flag plus a BIM or
     review prompt; the score is derived and watermarked when thin.

319. **One live question.** A period can set a question the person is
     carrying. Every view may show a thin strip of items tagged to it, so
     the vault answers one question at a time. **From the text:** an answer
     from nature is shaped by the question asked (p. 15). **In Brain2:** a
     field on the review record; a shared strip component. The next period
     can keep or retire the question (#348).

320. **Flag a run only when it beats its own baseline.** “Fish on Friday” is
     a schedule. A run is interesting when it exceeds the rate that tag or
     word already has. **From the text:** Kammerer’s clusters versus a run
     that beats chance (pp. 17–19). **In Brain2:** expected count beside
     observed count on the coincidence log. **Slice:** the chance line in
     JG-2. The baseline per tag is the part still unnamed there.

321. **Weight a chart by charge.** An affect-weighted toggle on Cross-section
     and Habits so one intense day can outweigh ten flat ones. The unweighted
     chart remains the default. The toggle is labeled derived. **From the
     text:** the charged event is the one that matters (p. 29). **In
     Brain2:** a view option reading the affect captured in JG-5; it does not
     change points.

322. **A symbol that is not a type.** The person may hang an image, glyph, or
     color on any item — the friend animal, a gem, a scarab — and Analytics
     can trace where that symbol recurs, as a lens, not a category. **From
     the text:** recurring images carry the pattern (pp. 29, 110). **In
     Brain2:** optional symbol on the item, indexed for search. **Slice:**
     JG-6 for dreams; this extends the same glyph to any room.

323. **The review changes with the season of life.** The person sets a stage.
     Morning-of-life prompts, missions, and points favor output. Afternoon
     prompts favor reflection and pairs held together. The calendar periods
     stay. The questions change. **From the text:** *Stages* (paraphrased;
     the PDF could not be read): youth narrows toward achievement; the
     afternoon turns inward. **In Brain2:** a setting consumed by review
     copy, the friend, and the points formula. **Slice:** JG-9, JG-10 cover
     seasons and the yearly afternoon questions; points weighting is the
     further piece.

324. **Polarity objectives.** Beside objectives that only increase, a pair to
     be held: work and rest, order and play. The picture is a balance beam.
     Drift toward either end is the neglect. **From the text:** the
     conjunction holds opposites; midlife reverses a one-sided aim
     (pp. 67–68; *Stages*, paraphrased). **In Brain2:** an objective mode in
     `lib/objectives.ts` and a beam on Direction. Neither pole is a failure
     by itself.

325. **A closing ritual.** Archive and delete can stay quiet. Lists, goals,
     and operations may also close with three lines: what it meant, what it
     gave, what carries forward. The ending stays in the ledger as a chapter.
     **From the text:** *Stages* treats an ending as a goal with meaning,
     not only a stop (paraphrased). **In Brain2:** an optional step on the
     existing archive path; the text is a note linked to the archived item.

326. **Keep the whole hour around a draw.** When an affirmation, a randomizer,
     or the friend shuffles a pick, save a snapshot beside the draw: mood,
     open regrets, today’s priorities, the last dream. Months later the draw
     and the hour are still one object. **From the text:** the I Ching reads
     the figure against the questioner’s whole situation (pp. 43–45). **In
     Brain2:** a snapshot record linked from the drawn item; stores already
     holding those facts are read, not copied into a second life.

327. **Equivalences, offered and not interpreted.** A quiet pass looks for
     structural rhymes: two lists with the same shape, two operations with
     the same arc. It offers them as equivalences. The person decides whether
     they mean anything. The house does not. **From the text:** equivalence
     is order that does not depend on the psyche (p. 95, note 71). **In
     Brain2:** a background comparison over list and operation shape; a tray
     the person can dismiss; no automatic link.

### AO. Further meaning (328–343)

328. **The scarab protocol.** When an item that has been stalled suddenly
     completes, save the surrounding hour the way #326 saves a draw. Stuck
     plus a sudden end is the moment worth keeping whole. **From the text:**
     the scarab arrives in the impossible situation (pp. 32–34). **In
     Brain2:** a hook on completion when `daysPushed` is high; the snapshot
     is the same record as #326.

329. **Charge that stays bright.** Affect (#321) decays slowly unless the
     person touches the item again. Old intensity remains findable and does
     not shout. **From the text:** numinous events keep a charge ordinary
     repetitions lack (p. 29). **In Brain2:** a derived brightness on the
     symbol and the coincidence, separate from points.

330. **A meaning radius.** The person sets how wide a “same moment” is, in
     hours. Pairing (#317) only offers members inside that radius, plus the
     explicit hunch that is allowed to point at the future (#318). **From
     the text:** simultaneity is the first category; later confirmation is
     a different one (p. 121). **In Brain2:** one setting on the coincidence
     scanner (JG-1).

331. **Amplify a symbol.** Choosing a glyph lists every earlier item that
     carried it, with dates, as parallels — not as evidence for a theory.
     **From the text:** amplification reads an image by its echoes. **In
     Brain2:** a panel on the symbol (#322); read-only.

332. **Ask the compensation.** If a week is almost entirely output, the review
     offers the neglected pole (#324) as its first question. If a week is
     almost entirely inward, it offers one outward act. **From the text:**
     the psyche compensates a one-sided attitude. **In Brain2:** a single
     prompt in the weekly review, chosen from the polarity beam and the
     week’s counts.

333. **A mandala of the day.** Four arcs — work, body, people, meaning — drawn
     from tags the person assigns to those arcs. The day is a circle. A
     missing arc is a flat side, not a lecture. **From the text:** the whole
     situation, and the self as a figure that holds the four (pp. 43–45;
     the mandala as a picture of wholeness). **In Brain2:** a Home or review
     figure; the arcs are tag groups, computed at read time.

334. **A lint on causal language inside a coincidence.** The two members of a
     pairing cannot be joined by a sentence the house treats as a reason.
     The note can hold “and” and cannot be stored as a dependency. **From
     the text:** synchronicity is not causation (p. 34). **In Brain2:** the
     coincidence editor refuses `depends-on` between its members and warns
     on “because” in that note only.

335. **The day that broke the pattern, named.** Once a month, one card: the
     date whose completion, mood, or sleep sat furthest from the month’s
     shape, with the person’s sentence about it. **From the text:** the
     exception is as real as the average; the single case is where meaning
     starts (pp. 56, 71 in the Wiener reading; Jung’s single cases). **In
     Brain2:** **Slice:** JG-3, JG-4. This is the monthly cadence of those
     slices, kept here so the bank names it.

336. **The golden shadow.** Besides regret, mark a day or an item where
     something went unusually well without being planned. Amplify it (#331)
     rather than turning it into a quota. **From the text:** the unlived
     excellent side is as charged as the rejected one (*Stages* /
     compensation, paraphrased). **In Brain2:** a mark on the day note;
     Direction can list them beside neglected objectives.

337. **Enantiodromia, early.** When one pole of #324 has been maxed for
     several weeks, say so before the opposite arrives as a collapse: offer
     a small scheduled dose of the other pole. **From the text:** a one-sided
     tendency turns into its opposite. **In Brain2:** a slow message from the
     homeostat pattern — one line, easy to dismiss, never a new objective
     created in secret.

338. **The night-sea phase.** An operation phase can be marked “middle,” where
     visible progress is not expected. Reviews do not grade that phase as
     stall. **From the text:** the descent in the middle of a life or a work
     is part of the arc (*Stages*, paraphrased; the night sea). **In
     Brain2:** a flag on operation phases; the post-mortem distinguishes it
     from a zombie task.

339. **Two inboxes that meet at review.** An optional practical inbox and an
     imaginal one (dreams, hunches, symbols). Both are ordinary items. They
     are shown apart during the day and in one strip at review. **From the
     text:** the day’s attitude and the night’s attitude are a pair to be
     held, not merged on sight. **In Brain2:** a list role; Inbox filters;
     no second item type.

340. **Active imagination as a paired note.** On any item, a two-voice note:
     the person and the figure (a project, a fear, the friend). Both voices
     are dated text. Neither is a plan. **From the text:** active imagination
     gives the image a voice and writes both sides. **In Brain2:** a note
     mode in Docs, linked to the item; excluded from priority.

341. **Retire a premise that belonged to an earlier self.** The afternoon
     review already asks which rules were right for an earlier year. Extend
     that to affirmations and list rules, with keep, revise, or retire.
     Retire archives. **From the text:** *Stages*, the second half of life
     revises the morning’s certainties (paraphrased). **In Brain2:**
     **Slice:** JG-10 already has this question. The bank records it so the
     affirmations and list rules are explicitly in scope.

342. **A constellation, not a feed.** The coincidence log can be drawn as a
     sky: items as stars, pairings as thin lines, charge as brightness
     (#329). Chance pairings stay dim. Marked ones stay ink. **From the
     text:** the moment is a figure in a field (pp. 43–45). **In Brain2:**
     one view on the meaning group (JG-2); positions from dates, not a
     physics simulation.

343. **Interest as a condition for the score.** A hunch’s hit rate (#318) can
     be split by whether the person marked interest at the time of writing.
     Bored predictions and interested ones are different series. **From the
     text:** Rhine’s results followed interest and died of boredom (Wiener
     pp. 27, 33, 74, discussing those experiments; Jung’s use of them). **In
     Brain2:** one optional mark on the hunch; Calibration-style split.

## Batch F · The map (Korzybski)

### AP. Devices already sliced, plus the ones still loose (344–357)

344. **Index every sentence the house writes.** “You typically underestimate
     by X%” carries the tasks, the dates, and an etc.: *n*, and how many had
     no estimate. **From the text:** extensional devices — indexes, dates,
     etc. — keep a statement from pretending to be all. **In Brain2:**
     Analytics sentence helper. **Slice:** GS-2.

345. **One mark on every derived value.** Time estimates already show est.
     Belief strength, habit grades, points, rollups, tone, and compensated
     hours get the same family: observed, recorded, derived, or inferred.
     **From the text:** consciousness of abstracting; a guess must not wear
     the clothes of a fact (p. 317 and the orders of abstraction). **In
     Brain2:** the est. chip family. **Slice:** GS-1.

346. **Counts-as for every label.** Pens already nest. Types, tags, folders,
     and goals can sit on ladders, with one Show as control. A rollup never
     overwrites the lower rung. **From the text:** labels hung in a series;
     the Structural Differential (pp. 399–404). **In Brain2:** the pen-tree
     rule applied beside it. **Slice:** GS-8.

347. **Describe, then infer.** A review shows what was recorded — blocks,
     completions, texts, sleep — before it asks for a conclusion. Each
     conclusion is saved as a formulation linked to the evidence, and it
     weakens if that evidence changes. **From the text:** description first,
     inference next (p. 317). **In Brain2:** review steps and formulation
     items. **Slice:** GS-5.

348. **The ‘is’ of identity, offered a rewrite.** Docs, journal pages, and BIM
     may, when asked, notice “I’m lazy” or “I always forget” and offer an
     indexed, dated sentence plus the vault’s count. The original text stays
     until the person accepts the rewrite. **From the text:** Smith₁ is not
     Smith₂; the is-of-identity (p. lxi). **In Brain2:**
     `lib/extensional-check.ts`. **Slice:** GS-4.

349. **Copy that describes the event.** “Pushed 9× since Jul 3” in place of
     a trait-name. A lint on new UI strings flags “always,” “never,” and
     “you are” plus a trait. **From the text:** the label is not the person
     (non-identity; the wording of judgment). **In Brain2:** string lint plus
     the existing judgment surfaces. **Slice:** GS-3.

350. **Partial work counts by default.** A graded completion — bare, goal,
     exceptional, or a percent — on every task, not only on types that opt
     in. The checkbox remains a shortcut to “goal.” **From the text:**
     infinite-valued evaluation, not either-or (p. 93). **In Brain2:**
     completion tiers. **Slice:** GS-9.

351. **Show what the record leaves out.** On an item or a block, list the
     missing characteristics: no mood, no company, empty attributes,
     unconfirmed estimates. Choosing one starts a capture. **From the text:**
     non-allness; events have more characteristics than any label holds
     (p. 375); the Differential shows the levels left behind (pp. 399–404).
     **In Brain2:** an inspector tab. **Slice:** GS-7.

352. **Beliefs with dates.** A formulation keeps a strength history as sources
     arrive, rather than one current number with the past erased. **From the
     text:** dating (p. lx); formulations, not timeless concepts (p. lxii).
     **In Brain2:** formulation type plus the activity ledger. **Slice:**
     GS-10. The rename from Concept to formulation is already the committed
     name in this bank (#74).

353. **The period hands the next one a note.** Close with what was learned,
     which premises changed, and where the next self starts. The next period
     opens on that note. **From the text:** time-binding; logical fate —
     change the premises to change the behavior (p. 539 and the fate
     passage). **In Brain2:** a record on the review. **Slice:** GS-6.

354. **Share the structure, not the life.** Types, pens, rules, and views
     export without items, notes, or tracking. Another person starts where
     this structure left off. **From the text:** time-binding between people,
     not only between one’s own days (the module parallel; p. 539). **In
     Brain2:** a bundle format. This is the portability piece beyond GS-10;
     no slice owns it yet. See also #307.

355. **Forecasts the map has to survive.** Before Thursday, the house may say,
     as derived, “from your map, Thursday holds about 3 h of real work,” and
     later score that sentence. Plan-versus-reality remains the after picture.
     This is the before picture, dated. **From the text:** similar structure
     is what makes prediction possible; a bad map is felt as anxiety
     (p. 269). **In Brain2:** a forecast record scored by Calibration; the
     compensator (#287) can be the source of the sentence.

356. **Say which floor a word is on.** “Review,” “done,” “habit,” and “plan”
     mean different things at day, week, and year. The period is visible on
     the screen that uses the word. **From the text:** multiordinal terms
     (the term changes its character at each order). **In Brain2:** the
     period cursor already exists; this is a label on chrome that uses those
     words. No slice yet.

357. **Sit with it.** Dropping a goal, marking a regret, or retiring a habit
     can wait a few hours in a hold. Capture stays instant. This delay is
     only for the loaded decision. **From the text:** delayed reaction
     (p. lviii); do not identify the feeling with the act. **In Brain2:** an
     optional hold on those three actions; the item shows the hold and can
     be released early.

### AQ. Further map (358–371)

358. **An etc. chip.** Every item offers a control that means “and more,”
     opening the inspector (#351). The chip is the non-allness made
     touchable. **From the text:** the extensional “etc.” **In Brain2:** the
     est. chip family, on item detail.

359. **Date the self who is planning.** Priorities can be saved as belonging
     to a named, dated self (this season, this year). An older self’s list
     can sit beside the current one without either being wrong. **From the
     text:** Smith₁₉₂₀ is not Smith₁₉₃₃ (p. lx). **In Brain2:** the handoff
     note (#353) plus a read-only prior priority set on Direction.

360. **Quotes on a word that has changed floors.** At year scale the title
     can show ‘priority’ in a distinct style from the day’s priority, so the
     multiordinal shift (#356) is visible without a manual. **From the
     text:** multiordinal terms should be marked as such. **In Brain2:**
     typography on period chrome only.

361. **A silence capture.** Two minutes in which the note has no type, no
     list, and no title — sensation lines only — and only afterward may be
     labeled. **From the text:** delayed reaction, and description before the
     higher label (p. lviii, p. 317). **In Brain2:** a capture mode that
     parks in Phone Notes / Inbox with labeling disabled until the timer
     ends.

362. **A premise ledger.** Explicit operating sentences (“mornings hold the
     real work”), each dated, each linked to the forecasts and habits that
     depend on it. Retiring a premise (#341, #353) shows what was standing
     on it. **From the text:** logical fate. **In Brain2:** formulation role
     `premise`; Direction lists them.

363. **Undefined words, collected.** Words used often in notes that have no
     formulation (“rest,” “enough,” “ready”) gather in a drawer and can be
     given a dated definition. Until then they stay undefined on purpose.
     **From the text:** undefined terms are allowed; pretending they are
     defined is not. **In Brain2:** a count over note tokens against
     formulation titles; a list in the second brain.

364. **A stuck spiral.** If three reviews in a row conclude with nearly the
     same sentence, show the three and ask whether the premise underneath
     has changed. Repetition of the conclusion is the failure of the spiral.
     **From the text:** the spiral of knowledge, and the stall when
     abstractions are reused without new description. **In Brain2:** compare
     inference formulations (#347) across reviews; one card.

365. **The differential as an object.** A small physical control — levels you
     turn with a finger — from event, to what was written, to the label, to
     the label of the label. Training the whole organism: seeing and
     handling. **From the text:** the Differential was built as an object
     because a method sticks when the senses are in it (p. 427;
     pp. 399–404). **In Brain2:** the inspector (#351) as a handled stack,
     not only a list. Design follows `docs/DESIGN_STYLE.md`.

366. **Security you can see.** When recent forecasts (#355) have been landing,
     a quiet indicator. When they have been missing, the same indicator
     dims. It is the map’s fit, not a streak of virtue. **From the text:**
     similar structure lowers the anxiety of a bad map (p. 269). **In
     Brain2:** one derived mark on Plan, from Calibration’s recent scores.

367. **Frames for what was left out.** A weekly strip of empty frames, one per
     day, filled only if that day has no mood, no company, or no note. The
     beauty is the empty frame. Choosing it captures. **From the text:**
     non-allness (p. 375). **In Brain2:** the inspector’s gaps (#351) drawn
     on the week.

368. **BIM answers “always” with a count.** A text that says “I always” or “I
     never” gets back two dated examples and the count, then asks whether
     the indexed sentence should be stored. **From the text:** indexing as
     the extensional cure for the is-of-identity (p. lxi). **In Brain2:**
     the extensional check (#348) on the ingest reply path.

369. **The friend speaks at the order it has.** If the evidence is a single
     week, the friend does not say “you are.” It says the week. Higher
     floors wait for higher *n*. **From the text:** orders of abstraction
     must not be confused. **In Brain2:** a guard on `lib/friend-suggestion.ts`
     using the same sentence helper as #344.

370. **A map of the maps.** Which rooms are opened, which are avoided, which
     views are never switched. A picture of how the person uses the house,
     dated by month, so a change of use is visible. **From the text:**
     self-reflexiveness; maps of maps. **In Brain2:** the dwell ledger
     (#297) aggregated; one Observatory view; labeled derived.

371. **Elementalism glow.** A module or a list whose items never meet a time,
     a tag, or another item glows faintly until one join exists. Isolation
     is drawn, not only stated. **From the text:** non-elementalism; do not
     split what cannot be split (p. lxii). **In Brain2:** the guest score
     (#295) as a visible treatment on the module card.

## Batch G · The join (372–394)

These use at least two of the three instruments. The map says what the record
is. The loop says what to do with the miss. The meaning layer says what the
loop must not flatten.

372. **One card, three readings.** On a marked moment: what was recorded, what
     was predicted versus what returned, and what it rhymed with. Three
     strips. No strip may rewrite another. **In Brain2:** item detail, reusing
     plan-versus-reality, the coincidence log, and the estimate mark.

373. **A repeated miss can become a rhyme.** The same weekday failing the same
     kind of block stays a calibration fact. It may also be offered as a
     coincidence candidate. The person marks it. The house does not upgrade
     it. **In Brain2:** Calibration’s recurring gap feeds JG-1’s scanner as
     a candidate only.

374. **The handoff carries three things.** Premises changed (#353), the live
     question (#319), and the gain the person is willing to be steered with
     (#286). The next period opens with all three. **In Brain2:** one review
     close record with three fields.

375. **The quiet house.** When tone is falling, a polarity is maxed, and the
     day’s records are thin, chrome recedes and one question remains. No
     points, no lamps. **In Brain2:** a home state derived from #290, #324,
     and the inspector’s gaps; dismissed with a tap.

376. **A coincidence is always inferred.** The pairing is never shown as an
     observation. The members may be observed. The join is a guess the person
     can confirm. **In Brain2:** GS-1’s mark on the coincidence object (JG-2).

377. **Dampen a symbol you keep pushing away.** A glyph the person repeatedly
     dismisses is offered less often, then only as a smaller question. The
     gain falls, as with a hunted task. **In Brain2:** the friend symbol
     mission (JG-8) reads dismissals the way CY-4 reads pushes.

378. **Both readings of the night stay up.** If the dream said rest and the
     day said work, the minority report keeps both. Sleep’s winner is for
     the record. The dream remains for the meaning strip. **In Brain2:**
     #288’s chip plus the dream item (JG-6) on the same day card.

379. **Score a rhyme as a forecast.** When two operations share an arc (#327),
     the finished one may propose a derived forecast for the unfinished one.
     Later, score it (#355). A resemblance that cannot predict stays a
     resemblance. **In Brain2:** equivalence tray gains an optional forecast
     the person must accept.

380. **Living mirrors.** Opening an item shows the small reflections of the
     same item in every room that holds it: list, plan, tracking, module,
     review. One object, many senses. **From the text:** Leibniz’s living
     mirrors, via the Wiener reading (pp. 84, 93). **In Brain2:** a strip on
     item detail from existing links and backlinks.

381. **The demon changes jobs with the season.** Early stage (#323): the
     negentropy ledger (#284) is the score worth showing. Later stage: the
     equivalences found (#327) and the premises retired (#362) are the score.
     Order made, then meaning reconciled. **In Brain2:** which ledger the
     Home lamp prefers follows the stage setting.

382. **A band on meaning itself.** Too many flagged coincidences is its own
     disorder. Hold “marked meaningful per month” inside a wide band. Inside
     it, silence. Outside it, one question: is the radius (#330) too wide?
     **In Brain2:** the homeostat pattern applied to JG-2’s marks; the band
     never deletes a mark.

383. **Hold a polarity flip.** Changing life stage, or retiring a habit that
     has lasted a year, uses the sit-with-it delay (#357). The morning’s
     tools do not vanish in one tap. **In Brain2:** #357’s hold on JG-9’s
     stage control and on habit retire.

384. **A mark with no words.** Capture can be a single point in time: no
     title, no type. Labels may be hung later, at a higher order, without
     the point changing. **From the text:** the event exceeds any
     characteristic list (p. 375). **In Brain2:** a one-gesture capture into
     the silence mode (#361), stored as an item with only a timestamp.

385. **Two inks on one graph.** Dependencies and the critical path in one
     color. Tags, typed links, and coincidences in another. Cause and rhyme
     are both visible and cannot be drawn as the same edge. **In Brain2:**
     the item graph and Scheduler graph share a legend.

386. **One word that stops every broom.** A single BIM phrase pauses all
     workflows and module writes, and says what it paused. The words of
     power (#289) include a master word. **In Brain2:** one ingest command;
     the run logs record the pause.

387. **The third time it becomes ink.** A finding, a symbol echo, or a
     recurring miss stays pencil until the third occurrence, then ink. A
     pattern earns its body by repeating. **From the text:** a single bird
     is not an omen; a series can be (Wiener p. 35; the fish series, p. 19).
     **In Brain2:** the sample floor drawn as pencil versus ink on Analytics
     and on the coincidence log.

388. **Attention is a receptor, not a portrait.** Dwell (#297) writes an
     observed event. It never writes “you care about X.” The friend may use
     the event. The sentence stays extensional (#349). **In Brain2:** the
     dwell ledger’s display copy.

389. **A chance line under every oracle.** Hunches (#318) show a hit rate.
     Draws (#326) show how often the hour’s context later looked related, by
     the person’s own mark. Both use the honesty rules of Calibration: *n*,
     dates, derived. **In Brain2:** one scoring helper shared by both.

390. **A body chart of the house.** Rooms that write a lot and hear little are
     drawn as strong limbs with no position sense — the house’s own ataxia.
     **From the text:** strong muscles, no proprioception (pp. 95–96). **In
     Brain2:** #295’s scores as a single figure in Observatory.

391. **Someday is a garden.** Damped tasks (#286) move to a garden with a
     season, not a graveyard. The seasonal review walks the garden. What
     still matters returns as a small step. **In Brain2:** Someday list plus
     the stage review (JG-10); return uses Just Start.

392. **Mood as weather, not as a star.** Mood is painted across the day like
     a cloud (a wash), while items stay countable stars. Statistics for the
     wash; identities for the stars. **From the text:** stars versus clouds
     (pp. 30–33). **In Brain2:** mood on the day as a continuous mark in
     Tracking’s visual language; the discrete mood metric can remain as a
     summary.

393. **Absence as a choice.** The person can record “I am not tracking X this
     week.” The gap is then information, a decision, not a hole pretending
     to be a zero. **From the text:** only a real choice carries information
     (pp. 10, 61); non-allness. **In Brain2:** an epoch (#294) created on
     purpose, excluded from averages, visible on the chart.

394. **Done at three floors.** Done today, done for the week, and done for
     the life of the objective are three marks. Checking one does not check
     the others. The word says its floor (#356). **From the text:**
     multiordinal “done”; infinite-valued completion (p. 93). **In Brain2:**
     the completion control (GS-9) shows the period it is completing.

---

# Expansion IV — the way (Sep 2026)

> Ideas **395–464** mine Eva Wong’s *Taoism: An Essential Guide* (Shambhala,
> 2011) as read in [`brain2taoism.md`](brain2taoism.md): 60 parallels, five
> practices, and five changes to rooms that already exist, plus further
> mechanisms from the same chapters. One nameless thing underneath, many
> forms, a record kept by watchers, cycles, and health shown as light.
> Screen copy stays plain. Chapter numbers stay in this bank. Nothing here
> re-sequences Waves 13–15, and the markers on a calendar stay dates.

## Batch H · Practices and changes named in the reading (395–404)

395. **Reserves.** Three glass tubes — Body, Heart, Mind — derived from
     records the house already keeps. Body from sleep duration, sleep
     regularity, and minutes tagged as exercise. Heart from mood swings and
     company time. Mind from screen-time switching and context switches.
     A tube dims as its 14-day reading falls. Hover names the largest drain
     in one dated sentence with an *n*. **From the text:** three energies
     drain through desire, mood, and a busy mind; health is read from how
     bright a guardian looks (ch. 4, 10). **In Brain2:** a pure
     `lib/reserves.ts`, a tube on the Habits rail, a breakdown in Analytics →
     Time. Derived, sample floors, a thin window stays dark, and nothing
     writes back.

396. **Almanac.** An overlay of the 24 solar markers (every 15° of solar
     longitude), new and full moons, and feast days the person already has:
     birthdays on person items, objective anniversaries, and any date they
     mark. Each feast has a rank — Great, Gathering, or Day — and a lead of
     3 days, 1 day, or none. When the lead opens, a prep item appears on the
     Plan rail. Beginning, middle, and end of year link to the quarterly and
     yearly reviews. **From the text:** nested cycles, a feast in every
     month, purification lead times, the three officers (ch. 8, 9, 14). **In
     Brain2:** a pure `lib/almanac.ts` with no network, beside sunrise and
     sunset; Scheduler Month/Year and the Plan rail. An overlay, not a new
     review period. The markers are dates.

397. **Gates.** For an objective, a list, or an operation, show how many items
     wait at Start, Middle, and Finish, and how long they have waited. Open
     a gate and the stuck items are dated cards: pushes, age, last touch,
     blockers. **From the text:** three gates; a shut gate stops the
     gathering; what shuts it looks harmless until seen as it is (ch. 4, 10).
     **In Brain2:** Analytics → Accuracy beside Overcommit, and a panel on
     Operations. Events only. Sample floors. The remedies live in #401 and
     #450.

398. **Hearth ledger.** Deeds toward other people, drawn from call and text
     logs, company blocks, and items tagged with a person. Beside them,
     repairs: a promise (what, and by when) tied to a missed or regretted
     item, closing when it is kept. A report at mid-year and year-end lists
     deeds per person, promises kept, and repairs still open, counted and
     dated. **From the text:** every action gets a response; a thought weighs
     as a deed; the household is reported twice a year and at year’s end
     (ch. 9, 11). **In Brain2:** an Analytics view and one step in the yearly
     review. Counts, never a character grade. Points for deeds stay off
     unless the person turns them on (#457).

399. **Foundations.** Stages the person writes for a habit or a goal (a short
     walk, then a longer walk, then a run). A stage holds for N weeks at or
     above a grade before the next one unlocks. When a stage holds, its
     reminders, friend nudges, and estimate prompts go quiet, and the Plan
     rail notes the day they stopped. **From the text:** each stage is the
     foundation of the next; a beginner’s count should retire once it has
     done its work (ch. 10, 13). **In Brain2:** Habits climb types and Goals.
     The person writes the stages. The hold check is deterministic. Silencing
     a scaffold can be undone.

400. **Lights that dim before they go out.** Habit tubes and gems take their
     brightness from a rolling 14-day hold, so a practice fades before the
     streak breaks. The friend jewel uses the same treatment for the house
     as a whole. **From the text:** a dull guardian warns before illness; a
     birth star dims with health (ch. 4, 9). **In Brain2:** Home → Habits
     instrument rail and the header jewel. Phosphor stays. The dimmest
     reserve (#395) may drive the jewel (#444).

401. **A 49-day recovery queue.** Anything left untouched for 49 days — a
     missed item, an inbox line, a phone note — enters one queue. Each card
     offers four actions: push to a later date (the push is counted), park
     on Someday, bind to an objective or a dependency, or release. Release
     stays in History and earns no points. The default offer is a rewrite as
     a smaller step. **From the text:** what is lost past 49 days turns
     troublesome; the lower world teaches; four ways to handle a spirit;
     educate and calm before dissolving (ch. 7, 9). **In Brain2:** Missed
     Opportunities, Inbox, and Phone Notes share the queue. Copy describes
     the item and the wait.

402. **Points return when a promise is kept.** A missed item can carry a
     repair: what, and by when, at most 7 days. Kept, it earns back part of
     its points (half, unless the person sets another fraction) and History
     gains a dated repaired line. A broken promise expires. There is no
     extra penalty. The repair also appears in the hearth ledger (#398).
     **From the text:** repentance redresses a wrong when the promise is
     kept (ch. 11). **In Brain2:** `points-store` and the completion path.
     Undo of a completion stays what it is.

403. **The friend keeps a calendar and a set of animals.** Unprompted speech
     only on the 1st and the 15th, on the person’s birthday, and at the
     mid-year and year-end hearth reports. The other days it waits to be
     opened. Mission picks follow five animals: strength habits, quick tasks,
     long projects, flexibility, and rest. Each species preset maps to the
     nearest of the five. **From the text:** star lords report on the 1st,
     the 15th, and the birthday (ch. 9, 11); five animal exercises (ch. 13).
     **In Brain2:** the friend clock in `docs/FRIEND_COMPANION.md`, which is
     still later, and `lib/baby-animal-personality.ts`.

404. **Two heats, then step back.** Slow heat is the default: inside a band,
     silence. Fast heat, a nudge, only after a gap has widened two periods
     in a row, and never harder than that gap. An objective that is fully
     served leaves Home on its own and keeps its record. **From the text:**
     fast fire and slow fire; help without crowding, then retire when the
     work is done (ch. 2, 5, 10). **In Brain2:** Overcommit, friend pushes,
     and the loop’s effectors. This tunes those effectors. Silence inside a
     band stays the success test.

## Batch I · Further from the same chapters (405–464)

405. **A vessel with no name.** Capture may land with a timestamp and no
     title. Clarifying is what gives it a name. Until then the Inbox shows a
     blank vessel, equal to any named item. **From the text:** the nameless
     sits under every named thing; stillness precedes the split (ch. 2, 8).
     **In Brain2:** Quick Add and BIM may omit a title; Inbox Walk asks for
     one. The item already has an id.

406. **What it was, and what happened.** The type, list, and title at creation
     stay frozen on the item. History remains the story of change. A
     two-column reading shows the two side by side. **From the text:** one
     arrangement describes what things are; another describes how they change
     (ch. 8). **In Brain2:** creation snapshot in `lib/item-activity.ts`; a
     pair of columns on the History tab.

407. **A day of equals.** An optional day on which sort-by-priority is put
     away. A book, a friend, and a chore are one list in the order they were
     captured. **From the text:** no being ranks above another (ch. 2). **In
     Brain2:** a Plan-day mode. The priority formula is untouched on every
     other day.

408. **Find the jot that lives in one cupboard.** Notes that exist under only
     one storage key are listed, and the person may bring them into the
     vault. **From the text:** texts split among custodians were hoarded and
     lost; a canon gathers what was scattered (ch. 3, 4). **In Brain2:** a
     Settings check over the day-note keys and Phone Notes. Union reads stay
     as they are.

409. **A sealed day.** The person may seal a day. New captures still arrive,
     and they wait outside the day’s tracked body until the seal opens.
     Nothing already logged is overwritten. **From the text:** while the work
     is refining, the vessel stays sealed (ch. 10). **In Brain2:** a flag on
     the day; Inbox holds the arrivals; the 24-hour tracked ceiling stays.

410. **Four postures.** The person maps pens to sit, stand, walk, and sleep.
     The day shows a ring of the four. An empty arc is a posture with no
     minutes. **From the text:** the practice is built into sitting, standing,
     walking, and sleeping (ch. 13). **In Brain2:** a Tracking summary from
     existing pens and the sleep log. No new scope required.

411. **The gentle hours.** The sunrise and sunset lines already on the grid
     gain a soft band. The Plan rail may offer that band for the one hard
     block, or for stopping. **From the text:** the essence of sun and moon
     is taken when the light is gentle (ch. 4, 13). **In Brain2:** the
     existing per-day solar lines; an offer, not a placement.

412. **Seven lamps for a chosen week.** The person names seven habits or
     objectives for one week. Each is a lamp. Brightness follows #400, so a
     lamp can dim while it is still lit. **From the text:** seven lamps must
     stay burning through the rite (ch. 7). **In Brain2:** a week overlay on
     Habits. The ordinary streaks remain.

413. **The true form of a pleasant sink.** Hours in a tag or list that serves
     no objective, shown as dated cards: duration, last touch, and the
     objective it did not meet. **From the text:** what feeds on attention
     looks attractive until it is seen as it is (ch. 4). **In Brain2:**
     Analytics beside Gates (#397). The sentence names the hours and the
     dates.

414. **The day’s circuit, and its outer reach.** The Day Log can draw one
     circuit: capture, plan, act, record. A second, wider ring marks the
     farthest write that left the desk — a text, a grocery line, a place.
     **From the text:** the small orbit in the body, and the orbit that
     reaches the feet (ch. 10). **In Brain2:** Day Log, from stores that
     already exist. BIM and location supply the outer ring.

415. **Thoughts in the yearly report.** Stamped intentions with no matching
     done row appear in the year report as their own count, beside deeds.
     They are listed. They are not punished and they are not completed.
     **From the text:** a thought weighs as much as a deed (ch. 11). **In
     Brain2:** plan text joined to Done at review time. The plan log stays
     append-only.

416. **The miss and the repair both remain.** A kept promise adds a line. It
     does not replace the missed line. Anyone reading History can see both
     dates. **From the text:** repentance redresses; it does not pretend the
     deed was otherwise (ch. 11). **In Brain2:** `lib/item-activity.ts` on
     the repair path (#402).

417. **A light on the fortieth day.** An item untouched for 40 days gets one
     quiet lamp, before the 49-day queue (#401). One lamp, then silence
     until the queue. **From the text:** the danger is the day past 49; a
     warning belongs earlier (ch. 7, 9). **In Brain2:** Needs Attention,
     reading last-touch. Copy states the count of days.

418. **A habit that belongs to a season.** A habit may be active only between
     two solar markers (#396). Outside that span it rests, and its streak
     does not break for the rest. **From the text:** the year has seasonal
     markers, and rites have their months (ch. 8, 9). **In Brain2:** a span
     on the habit, computed from `lib/almanac.ts`.

419. **A rank on any date.** Any dated item, not only a feast, may be Great,
     Gathering, or Day, and so gain a lead of three days, one day, or none.
     **From the text:** purification lead times differ by the rank of the
     rite (ch. 14). **In Brain2:** an optional rank on events and objectives;
     the Plan rail already receives prep items in #396.

420. **Three prompts for three parts of the year.** Year-open asks what to
     set. Mid-year asks what to hold. Year-end asks what to keep, revise, or
     retire. **From the text:** three officers preside over the beginning,
     the middle, and the end (ch. 9). **In Brain2:** the quarterly and yearly
     review copy. The periods stay the periods.

421. **Twelve houses.** Optional folders for health, work, home, money, and
     the rest of a dozen the person names. Cross-section can split by them.
     **From the text:** a destiny chart maps many factors of a life (ch. 8).
     **In Brain2:** life-area folders that already exist, completed to a
     named set of twelve if the person wants the set. A folder is a lens.

422. **A room used otherwise.** When minutes painted at a place disagree with
     the purpose written on that place, the place card says so, with the
     dates. **From the text:** the land is alive, and each room’s use matters
     (ch. 8). **In Brain2:** Location scope against the place’s note. Derived.

423. **The day’s river.** The sequence of places in a day, drawn as a line.
     A stay longer than that place’s usual is an eddy, labeled with minutes.
     **From the text:** energy flows along roads (ch. 8). **In Brain2:** the
     Trip map and `gps:` samples. Usual stay is a median with an *n*.

424. **Scripts you write.** The person names a short phrase and what it
     writes. After a dry run (#435) it is accepted from the phone like the
     built-in phrases. **From the text:** short scripts of command that act
     at a distance (ch. 3, 14). **In Brain2:** a user table beside the BIM
     parser. The phrase is theirs. The write goes through the same door as
     every other ingest.

425. **A rule on the door.** A list may carry a standing rule that runs when
     the list is opened: a template, a sort, a single prep item. The rule is
     marked as running without the person staying. **From the text:** some
     objects keep working once set; others are useless unless the person is
     there (ch. 7). **In Brain2:** list rules, fired on open, with the run
     log from the workflow words of power (#289).

426. **Runs alone, or needs you.** Every workflow and every view wears one of
     those two marks. A view that needs the person is not expected to fire
     overnight. A workflow that runs alone must already have its stop words
     (#289). **From the text:** the talisman on the door and the rite that
     needs the practitioner (ch. 7). **In Brain2:** a field on the workflow
     and a caption on module views.

427. **Three seats.** A capture session can be marked as the one who receives,
     the one who interprets, or the one who records. The day can show which
     seat the minutes belonged to. **From the text:** in sandwriting, one
     writes, another reads, and helpers record (ch. 7). **In Brain2:** a
     session mark on Quick Add, Inbox Walk, and the History tab. The roles
     stay separate: receiving does not clarify.

428. **A cabinet of procedures.** Personal procedures — steps you can apply —
     live on an item, distinct from spreadsheet formulas. Applying one copies
     steps onto a target item and leaves the procedure where it is. **From
     the text:** the masters of the formulae kept recipes, ethics, and
     exercises in one encyclopedia (ch. 3, 5). **In Brain2:** a note kind
     beside `lib/formula.ts`. Formulas stay formulas.

429. **A letter the friend carries.** The person writes a note to a later
     self and a delivery day. The friend holds it and speaks it only on a
     day it is already allowed to speak (#403), or on the date named.
     **From the text:** the great ones have messengers; reports arrive on
     known days (ch. 9). **In Brain2:** a dated note linked to the friend.
     It is a record, delivered, not a new personality.

430. **The tally goes quiet.** Any self-count — a streak number, a point
     total on a habit — can be set to hide once a stage holds (#399). The
     light (#400) remains. The number is still in the data. **From the
     text:** drop the breath count once it has become a crutch (ch. 13).
     **In Brain2:** a display flag on the habit. Analytics can still read
     the count.

431. **A mark before the usual switch.** When the hour of a repeated context
     switch is approaching, one quiet mark appears, early enough to pause.
     **From the text:** internal observation learns the pattern of thoughts,
     then meets them before they start (ch. 12). **In Brain2:** Analytics
     heatmaps already see the hour; this is one lamp on the Plan rail.
     Sample floor applies.

432. **A sit that stores a count.** A timed session records how many notices
     the person marked, and nothing they said. The series of counts can be
     read later for a pattern. **From the text:** watch thoughts rise and
     fall (ch. 12). **In Brain2:** a timer mode beside Just Start, writing
     one number per session onto the day. The words, if any, stay in a note
     the person chooses to keep.

433. **A fast you define.** For the lead before a Great date (#396), the
     person may name a small fast: a screen cap, an early stop, a sealed
     evening (#409). The fast is a checklist they wrote. **From the text:**
     purification precedes the rite, and the lead depends on the rank
     (ch. 14). **In Brain2:** a template on the prep item. Skipping the fast
     leaves the feast date as it is.

434. **Sand before ink.** A new script (#424) or door rule (#425) replays
     over recent days and shows what it would have written. Only then may it
     write. **From the text:** sandwriting is smoothed and read before it is
     trusted; a script that acts at a distance should be seen first (ch. 7,
     14). **In Brain2:** the workflow dry run, reused for user phrases.

435. **One animal for a whole project.** The friend wears one of the five
     (#403) for the life of an operation. Missions in that span stay attached
     to the operation, and the form returns to the usual rotation when the
     operation closes. **From the text:** the shaman took an animal form and
     received what that form knew (ch. 1); each animal trains a different
     tissue (ch. 13). **In Brain2:** a field on the operation pointing at a
     species preset.

436. **Regalia that can dim and return.** A gem, an orb, or a catalog type’s
     badge dulls when the thing it marks goes unused, and brightens again
     when it is used. Rank follows recent trust. **From the text:** the
     pantheon was ordered by signs of office; deities are promoted and
     demoted by what they accomplish and how far they are trusted (ch. 4, 9).
     **In Brain2:** the existing Recent sort for pens, extended to type
     badges and gems. Nothing is deleted by going dim.

437. **Seven shelves.** The person names up to seven shelves and drags
     scattered notes onto them. A shelf is a gathering, and the notes remain
     the same items. **From the text:** the first canon gathered scattered
     scriptures into seven sections (ch. 3). **In Brain2:** lists or folders
     with a shelf role. Seven is a suggestion the person can stop short of.

438. **A check against flattering the past.** A workflow, a module, or a
     repair path that rewrites a completed record so the past looks healthier
     is refused. Repair adds a line (#416). It does not edit the miss.
     **From the text:** fast-acting elixirs poisoned the people who demanded
     them; the slower internal methods lasted (ch. 5). **In Brain2:** a note
     in the module laws beside deterministic-after-install. Reviewers can
     see it when a write targets History.

439. **A short journey, then a long one, then one that runs alone.** An
     operation’s stages can be marked local, then phone, then unattended.
     The unattended stage is a workflow that already has stop words. The
     record of the earlier stages stays. **From the text:** each stage
     founds the next; the spirit practices short journeys, then longer ones,
     then leaves the shell (ch. 10). **In Brain2:** operation phases. The
     module ladder’s later rungs are the long journey, not a different item.

440. **Birthday as a personal new year.** On the person’s birthday the friend
     may speak (#403), and a short report opens: the year’s deeds in the
     hearth sense, promises kept, and one line the person writes. It is not
     the January review. **From the text:** the star lords also report on
     the birthday (ch. 9, 11). **In Brain2:** a review variant keyed off the
     birthday on the person item. Dated, optional.

441. **What the recovered item taught.** Leaving the 49-day queue (#401) can
     ask for one optional line: what it taught. The line is a note. The item
     does not need the line in order to leave. **From the text:** the lower
     world is a school (ch. 7, 9). **In Brain2:** one field on the queue
     card, stored as a note linked to the item.

442. **A wild skin is welcome.** Reviewing a module asks whether its writes
     reach other rooms. The look of the room is the module’s own. **From the
     text:** there are sects, and the sects respect each other (ch. 4, 6).
     **In Brain2:** the guest score (#295) as the module check. Feral skins
     stay feral.

443. **Formula, ethic, exercise, and story on one item.** An item may hold
     those four attachments as equals: a procedure (#428), a premise, a
     body note, and a journal page. No one of them outranks the item.
     **From the text:** one encyclopedia held formulas, ethics, calisthenics,
     and stories together (ch. 5). **In Brain2:** existing notes and links.
     A sectioned panel on item detail.

444. **The house light follows the dimmest reserve.** The header lamp and the
     friend jewel take their brightness from the lowest of the three tubes
     (#395), so one leak is visible in the person-light. Hover names which
     tube. **From the text:** one birth star shines or dims with the whole
     health (ch. 9). **In Brain2:** the POWER lamp reads `lib/reserves.ts`.
     It stays derived.

445. **The small universe of one item.** Opening an item shows the rooms that
     currently hold it — list, plan, tracking, habit, module, review — as a
     small body. **From the text:** the body is a small universe mirroring
     the large one (ch. 4, 8). **In Brain2:** the living-mirrors strip
     (#380), drawn as a body of rooms. Same links.

446. **An equality stroll.** A command surfaces one item of any type, each
     type with equal chance, and opens it. **From the text:** equality of
     all things (ch. 2). **In Brain2:** a command-palette action over the
     vault. It is a walk, not a recommendation.

447. **The project shows its heat.** An operation displays slow or fast,
     from the rule in #404: fast only after two widening periods. The person
     can see the heat without receiving the nudge. **From the text:** the
     firing process is visible to the one tending the fire (ch. 5, 10). **In
     Brain2:** a caption on the operation. The nudge rules do not change.

448. **Served work leaves the rail.** When an objective is fully covered, it
     steps off Home and remains in Direction and History. The person can pin
     it back. **From the text:** step back when the work is done (ch. 2).
     **In Brain2:** Home’s objective strip. Coverage comes from
     `lib/objectives.ts`.

449. **The messenger carries what you handed it.** On the days the friend may
     speak unprompted (#403), it speaks letters (#429), hearth lines, and
     missions. It does not invent a speech on the quiet days. **From the
     text:** messengers carry the deity’s message; they are not a second
     deity (ch. 9). **In Brain2:** the friend clock. Click-to-open stays
     available every day.

450. **Knock on a stuck gate.** From a gate card (#397), one action runs the
     smallest step on that item and starts the short timer. Pushing the date
     remains available and remains counted. **From the text:** massage and
     knocking open a stuck gate (ch. 13). **In Brain2:** Just Start, invoked
     from the Gates panel.

451. **The seal shows what would have spilled.** When a log would pass 24
     tracked hours, the day shows the minutes that did not fit, named by
     scope, and leaves the earlier minutes as they were. **From the text:**
     a sealed vessel does not let later energy overwrite what is already
     refined (ch. 10). **In Brain2:** the existing day ceiling. The overflow
     becomes a visible remainder instead of a silent drop.

452. **A broken promise expires.** The date passes, the repair closes as
     unmet, the missed item stays missed, and points do not go negative.
     **From the text:** the redress is the kept promise; a failed repentance
     is not a second punishment (ch. 11). **In Brain2:** the repair record
     (#402). History gains an expired line.

453. **Use promotes, neglect demotes.** Pens, types, and modules rise in their
     picker when they are opened and used, and sink when they are passed
     over. The order is Recent trust. The catalog itself stays whole. **From
     the text:** heaven promotes and demotes by accomplishment and trust
     (ch. 9). **In Brain2:** the Recent sort, applied in the type library and
     the module list as well as pens.

454. **For seeing how things depend.** Almanac markers, forecasts, and draws
     carry one shared caption: they are for noticing what coincides and what
     follows, and the day is still chosen by the person. **From the text:**
     divination is for seeing dependence, not for living under predictions
     (ch. 8). **In Brain2:** one caption component used by the almanac, by
     Calibration’s forecast, and by the meaning layer’s draws.

455. **The old name remains an incarnation.** A renamed item, list, or store
     key keeps the previous name as a searchable alias. Both names open the
     same being. **From the text:** figures entered under new names and
     remained the same beings (ch. 6, 9). **In Brain2:** the pattern already
     used for `cogs` aliases, extended to item renames in the search index.

456. **Two custodians, both visible.** When the same day note exists under two
     keys and the texts differ, the day shows both, with their keys. The
     person chooses which stands. Until then both remain. **From the text:**
     texts split among custodians diverged and were lost when one cupboard
     was trusted blindly (ch. 4). **In Brain2:** the day-note union read
     gains a split view on disagreement. This is a minority report for notes.

457. **Deeds stay off the score unless asked.** The hearth ledger (#398)
     never adds points by default. A setting can turn a deed-point on, at a
     value the person writes, dated from the day they turned it on. **From
     the text:** the tally of deeds is a register; reward is a separate
     office (ch. 11). **In Brain2:** `points-store` stays untouched until
     that setting. The epoch (#294) marks the day it starts.

458. **The first stage is a short crossing.** The foundations template (#399)
     offers a first stage measured in minutes, a single sitting or a single
     walk. Later stages are the person’s to lengthen. **From the text:** the
     early journeys are short; length comes after a foundation (ch. 10). **In
     Brain2:** the stage editor’s suggested first row. The person can rewrite
     it before saving.

459. **A feast that is only a date.** The person may mark a day with a rank
     and no external reason. It still receives its lead time and its prep
     item. **From the text:** a household has its own feasts beside the
     twelve-month calendar (ch. 9). **In Brain2:** the almanac’s “any date
     you mark” (#396), with rank and with no required type.

460. **Mid-year names people, and counts.** The hearth report addresses each
     person with deeds, company minutes, and open repairs. No summary adjective.
     **From the text:** the kitchen lord reports each member of the household
     (ch. 9, 11). **In Brain2:** the hearth view grouped by person item.
     Extensional sentences (#344) supply the shape.

461. **A gate is local.** Gates (#397) report per objective, list, or
     operation. They do not sum into one number for a life. **From the text:**
     a blockage is at a gate; the whole body is not given a single fault
     (ch. 10). **In Brain2:** the Gates view has no total score. Reserves
     (#395) remain a different instrument.

462. **Hide the number, keep the light.** A global display choice: streak
     counts and point totals can be hidden across Habits while tubes, gems,
     and dimming (#400) stay. **From the text:** once the count has focused
     the mind, keeping it up front turns it into the practice (ch. 13). **In
     Brain2:** a Habits display setting. Data and Analytics keep the numbers.

463. **The last stage retires the scaffolding.** When the final stage of a
     foundation holds, reminders, nudges, timers, and estimate prompts for
     that habit all stop. The habit remains as a record and can still be
     done. **From the text:** the count is dropped when the mind is focused;
     the work continues without the prop (ch. 13). **In Brain2:** #399’s
     retire rule, applied to the whole habit at the last stage. Undo restores
     the scaffolding.

464. **Five walks.** A plain map of the house in five walks: scripts (BIM,
     workflows, door rules), seeing (almanac, Analytics, gates), devotion
     (the friend, the hearth, letters), transformation (reserves, foundations,
     the circuit), and right action (the ledger, repairs). Each walk is a
     list of rooms. **From the text:** five ways — power, seeing, devotion,
     transformation, and right action (ch. 7–11) — and a guide that is a map
     of a territory (Introduction). **In Brain2:** one help or Observatory
     page. The words on it are the plain ones. It links to rooms that exist
     and to nothing that pretends to.

---

## Quick index by Brain2 area (where these would land)

- **Inbox / Capture:** 47, 61, 116, 120, 121, 134, 152
- **Lists (data model):** 80–83, 146–149, 152–154
- **Scheduler:** 6, 14–25, 139
- **Home / To-Do:** 1–13, 24, 42, 46, 99, 100, 128–136
- **Modules / Workspaces:** 9, 22, 31, 49, 86, 95–98, 101, 105, 124–127, 155
- **Reviews:** 33–41, 102, 156, 159
- **Analytics / Tracking:** 26, 29, 33, 137–145
- **Second brain (new types):** 55–94, 109–115, 146, 155–158, 160
- **Platform / storage:** 105, 106, 150, 151, 153, 154, 185, 198, 199, 233, 280

### Expansion II additions (161–280) by area

- **Capture / Inbox:** 183, 187, 241–247
- **Calendar / Plan:** 161–174, 227, 228, 261, 263
- **To-Do / priority engine:** 172, 248–253, 266, 267
- **Scheduler / task graph:** 225, 226, 229, 254–264, 273
- **Operations (new type):** 201–213, 239, 240, 276, 277
- **Goals / Objectives / direction:** 176, 179, 181, 214–224
- **Lists / attributes / types:** 177, 178, 180, 182, 232, 234–236
- **Reviews:** 208, 219, 265, 267–271, 277
- **Analytics / Tracking:** 203, 224, 231, 237, 238, 270, 271, 274, 275
- **Cognitive state / capacity:** 231, 272–274
- **Semantic search / classical ML (fast-track):** 186, 238, 240, 268
- **Platform / storage / shell:** 185, 189, 190, 194, 198, 199, 233, 278, 280
- **UI / onboarding / polish:** 175, 188, 192, 193, 196, 197, 200, 278, 279

### Expansion III additions (281–394) by area

The loop, the map, and the meaning layer. Slices already queued stay the work
order (`CY-` Wave 15, `GS-` Wave 13, `JG-` Wave 14). The rest are further
directions.

- **Loop — close and steer:** 281–290 (the ten slices CY-2 … CY-11), 291–297
  (joint forecast, chain survival, fading nudges, metric epochs, module
  reach, unattended middles, attention), 298–316 (tremor, white box, quiet
  at overload, probe mode, ghost day, decaying order, patch cords, three
  clocks)
- **Meaning:** 317–327 (pairing, hunch, live question, baseline runs, charge,
  symbols, life stage, polarity, closing ritual, oracle snapshot,
  equivalences), 328–343 (scarab hour, mandala, compensation, night-sea
  phase, constellation)
- **Map:** 344–357 (GS-1 … GS-10 plus structure export, explicit forecasts,
  multiordinal labels, the hold), 358–371 (etc. chip, dated selves, silence
  capture, premises, undefined words, stuck spiral, the differential as an
  object)
- **Join:** 372–394 (three readings on one card, handoff of premises plus
  question plus gain, the quiet house, meaning inside a band, living mirrors,
  the master stop word, pencil until the third time, the garden of Someday,
  mood as weather, absence as a choice, done at three floors)

### Expansion IV additions (395–464) by area

Mined from [`brain2taoism.md`](brain2taoism.md). Screen words stay plain.

- **Practices named in the reading:** 395 Reserves, 396 Almanac, 397 Gates,
  398 Hearth ledger, 399 Foundations
- **Changes to rooms:** 400 dimming light, 401 49-day recovery, 402 repair
  points, 403 friend calendar and five animals, 404 two heats and stepping
  back
- **Capture / vault:** 405 unnamed vessel, 408 hoarded jots, 409 sealed day,
  427 three seats, 437 seven shelves, 455 old name as alias, 456 both
  custodians
- **Tracking / light:** 410 four postures, 411 gentle hours, 412 seven lamps,
  414 the day’s circuit, 444 house light from the dimmest tube, 451 overflow
  shown, 462 hide the number
- **Plan / time:** 418 seasonal habit, 419 rank on a date, 420 three year
  prompts, 433 a fast you define, 440 birthday report, 459 a feast that is
  only a date
- **Work and gates:** 406 what it was beside what happened, 413 true form of
  a sink, 417 fortieth-day light, 435 one animal for a project, 439 short then
  long then unattended, 447 heat on the project, 448 served work leaves Home,
  450 knock with the smallest step, 461 a gate stays local
- **People / repair:** 415 thoughts in the year report, 416 miss and repair
  both stay, 429 a letter carried forward, 441 what it taught, 452 a broken
  promise expires, 457 deeds off the score unless asked, 460 mid-year names
  and counts
- **Scripts / modules:** 424 phrases you write, 425 a rule on the door, 426
  runs alone or needs you, 428 a cabinet of procedures, 434 sand before ink,
  438 a check against flattering the past, 442 a wild skin is welcome
- **Method:** 407 a day of equals, 421 twelve houses, 422 room drift, 423 the
  day’s river, 430 the tally goes quiet, 431 a mark before the usual switch,
  432 a sit that stores a count, 436 regalia that dims and returns, 443 four
  kinds of attachment, 445 the small universe of one item, 446 an equality
  stroll, 449 the messenger carries what you handed it, 453 use promotes,
  454 for seeing how things depend, 458 a short first stage, 463 the last
  stage retires the scaffolding, 464 five walks

---

*Total suggestions: **464** — the original 160 (mined from `Brain2Ideas (1).pdf`),
**120 added in Expansion II** (ideas 161–280), **114 added in Expansion III**
(ideas 281–394), and **70 added in Expansion IV** (ideas 395–464). Expansion II
was mined from the Brain2 prototype docs, the Brain2-titled docs, and the
"to-do list theory app" doc. Expansion III was mined from *Cybernetics*,
*Science and Sanity*, and *Synchronicity* / a paraphrase of *The Stages of
Life*. Expansion IV was mined from Eva Wong’s *Taoism: An Essential Guide* as
read in [`brain2taoism.md`](brain2taoism.md): the five practices, the five
changes, and further mechanisms from the same chapters. Each entry is mapped
to a concrete place in the current data model or component tree. Where a slice
id is named, that file stays the work order. The bank honors the project's AI
posture — **self-hosted models only, implemented last**, with **semantic/vector
search** and **classical data-science / ML** fast-tracked instead. It is a menu
to pull from, not a roadmap commitment.*
