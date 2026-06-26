# Brain2 → COGS Feature Idea Bank

> **Source:** A close, exhaustive reading of `Brain2Ideas (1).pdf` (134 pages — a
> stream-of-consciousness brain dump mixing classical management theory, task /
> planning / information / network theory, a "fleet of AI agents" architecture
> ("brain2"), a research → source → belief → concept → understanding knowledge
> system, ADHD-specific productivity notes, and assorted second-brain ideas)
> cross-referenced against what COGS actually is today (`README.md`,
> `docs/SPEC_MAPPING.md`, `docs/tree.md`, `lib/types.ts`, and the folder READMEs).
>
> **Purpose:** A long, deliberately wide-ranging menu of **potential** buildouts —
> data-model extensions, features, and ways-of-functioning — for COGS / Brain2,
> the productivity / self-tracking / planning / review / self-analysis omni-tool.
> These range from small, concrete, near-term additions to deeply "pie-in-the-sky"
> swings. Nothing here is a commitment; it is an idea bank to pull from.
>
> **How to read each entry:** *idea* — a short description, then **From the doc:**
> (what inspired it) and **In COGS:** (where it would live — store, type, or
> component). Entries are grouped by app area / theme. Numbered 1–150+.

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
   MOLECULAR." **In COGS:** extend `Task.subtasks` with a depth/`isMolecular`
   flag; surface in the To-Do and item-detail subtasks panel.

2. **Background context on every subtask.** When decomposing, each step is worded
   to be understandable out of context (carries its own background). **From the
   doc:** "each step should be worded such that it is understandable even if read
   outside the context of the list." **In COGS:** a `context`/`why` field per
   subtask object, not just the parent.

3. **Task-domain (Cynefin) classifier.** Tag each task as *simple / complicated /
   complex / chaotic*, and let the domain drive UI and handling (checklists for
   simple, dependency graphs for complicated, experiment-loops for complex).
   **From the doc:** "Task type identifier definitely need: simple, complicated,
   complex, chaotic." **In COGS:** add `domain` to `Task` + an `ItemTypeRule`
   that adapts the detail panels per domain.

4. **Strategy-per-domain presets.** "Simple → programmatic/best-practice,
   Complicated → hierarchical (low temp), Complex → encourage emergence
   (high temp/creative)." Map each domain to a default workflow template. **From
   the doc:** the explicit simple/complicated/complex mapping. **In COGS:** a
   workflow preset attached to the domain field.

5. **Terminal vs. summary elements (Gantt vocabulary).** Distinguish "terminal"
   leaf tasks from "summary" rollup tasks that complete when their children do.
   **From the doc:** Gantt's terminal/summary element distinction. **In COGS:**
   `Task.isSummary`; auto-complete summary when subtasks complete.

6. **Concurrency map ("what can/can't be done at the same time").** On any
   project, mark which steps are parallelizable vs. strictly sequential. **From
   the doc:** repeated "what can and cannot be done concurrently." **In COGS:**
   reuse `dependencies[]` + a `parallelGroup` tag; visualize in a graph view.

7. **"Tricky step" flagging + safety pipeline.** Let the planner flag steps
   likely to go wrong and attach a helper checklist / extra guidance. **From the
   doc:** "Decide which steps might be 'tricky' and create helpful pipelines for
   them not to get messed up." **In COGS:** `Task.riskFlag` + linked checklist
   item via `ItemLink` relation `"checklist-of"`.

8. **Plan B / contingency per task or project.** Every "area of concern" gets a
   failsafe plan. **From the doc:** "could be cool to create a 'Plan B'… a Plan B
   for every area of concern." **In COGS:** a `contingency` rich-text attribute;
   show in the Analysis detail panel.

9. **Stages → Steps → Molecular tasks hierarchy.** A three-level project shape:
   high-level *stages* (with desired outputs/benchmarks), *steps*, and *molecular
   tasks*. **From the doc:** "Break into DEPARTMENTS! And Stages… Stages as a
   whole can have desired outputs with benchmarks." **In COGS:** a new
   `project`/`stage` item type with `links` to child items.

10. **Per-step success metrics.** Each step records its expected output, how
    success is measured, precursors, and resources needed. **From the doc:**
    "For each step: Metrics (expected result/output, how will success be
    measured), precursors, resources needed." **In COGS:** attributes
    `successCriteria`, `precursors`, `resourcesNeeded` on tasks.

11. **General vs. specific metric formulation.** Two-pass metrics: a loose
    success notion first, then a precise measurable one. **From the doc:** "this
    may need to be made into 2 steps: general and specific formulations of
    metrics." **In COGS:** optional `metricDraft` + `metricFinal` fields.

12. **"Resources needed" as first-class links.** A task can declare the
    documents, tools, or people it needs, pre-loaded into its detail view.
    **From the doc:** "Task agents… preloaded with the resources they need."
    **In COGS:** `ItemLink` relation `"resource-of"`; render resources panel.

13. **Reusable "bits" vs. directed enterprises.** Distinguish recurring reusable
    machinery (e.g. the scheduler, a cleaning routine) from one-off goal-directed
    projects. **From the doc:** "Directed Enterprises… vs Reusable bits — things
    you can call on every day like a scheduler." **In COGS:** a `reusable` flag on
    workspaces/templates vs. project items.

---

## B. Project visualization & scheduling math (CPM / PERT / Gantt / queueing)

14. **Gantt chart view.** A real timeline view with bars, durations, start dates,
    and dependency arrows. **From the doc:** extended Gantt explanation (paint-a-
    room example). **In COGS:** a new Scheduler sub-view driven by
    `Task.scheduledDate` + `estimatedDuration` + `dependencies`. The
    `GraphNode`/`GraphEdge` types already exist in `lib/types.ts`.

15. **Critical Path Method (CPM) highlighting.** Compute and highlight the longest
    dependent chain that determines project end date. **From the doc:** CPM
    section. **In COGS:** `GraphNode.isOnCriticalPath`/`GraphEdge.isOnCriticalPath`
    already exist — add the solver + render.

16. **PERT three-point estimates.** Store optimistic / likely / pessimistic
    durations and compute expected time + variance. **From the doc:** PERT
    section. **In COGS:** replace single `estimatedDuration` with an optional
    `{optimistic, likely, pessimistic}` estimate object.

17. **Monte Carlo completion forecast.** Simulate project finish-date
    distributions from task estimate ranges; show "70% chance done by X." **From
    the doc:** "Monte Carlo simulations… estimate the best, worst, and most likely
    completion times." **In COGS:** a pure helper in `lib/` + an Analytics view.

18. **Dependency graph view (graph theory).** Tasks as nodes, dependencies as
    edges, to reason over complex relationships. **From the doc:** "graph theory…
    tasks as vertices, dependencies as edges." **In COGS:** reuse `GraphNode/Edge`
    types; a force-directed view in Scheduler or a new tab.

19. **Queueing/WIP limits.** Cap how many tasks can be "in progress" at once to
    reduce thrash and surface bottlenecks. **From the doc:** queueing theory
    ("flow of tasks… reducing waiting times and improving throughput"). **In
    COGS:** a per-list/per-day WIP limit setting; warn when exceeded.

20. **Kanban board display.** A column board (To do / Doing / Done, or custom)
    over any list. **From the doc:** "Agile methodologies like Scrum and Kanban."
    **In COGS:** a new Lists display mode / Module view kind, grouping items by a
    status attribute.

21. **Velocity metric.** Track how much work (points or count) is actually
    completed per day/week to predict capacity. **From the doc:** "velocity in
    Scrum… predicts how much work an agile team can complete in a sprint." **In
    COGS:** derive from `points-store` completions; show in Analytics.

22. **Sprint planning module.** Time-boxed batches of tasks with a commitment and
    a retro. **From the doc:** Scrum/agile. **In COGS:** a Module/workspace
    template binding a list + a date range + a review.

23. **Linear-programming resource allocator.** Given a fixed time budget and task
    values/durations, suggest the optimal subset to do today (knapsack). **From
    the doc:** "Linear programming… find the most efficient way of using limited
    resources." **In COGS:** a "Plan my day" helper over To-Do using
    `estimatedDuration` + `rewardValue`/`importance`.

24. **Auto-scheduler (constraint solver).** Respect `schedulingConstraints`
    (time-of-day, allowed days/dates, must-be-after/before) to auto-place tasks.
    **From the doc:** the scheduler is a repeated wish; "ML scheduler." **In
    COGS:** §7.6 is deferred but the constraint fields already exist on `Task`.

25. **Predecessor/successor chips in task detail.** Quick "comes after / comes
    before" pickers that build the dependency edges. **From the doc:** Gantt
    "predecessors to the task." **In COGS:** dependencies panel UX upgrade.

---

## C. Estimation, standards & the "one best way" (Taylorism)

26. **Time-and-motion logging on recurring tasks.** Record actual durations over
    repeats and compute a personal "standard time." **From the doc:** Taylor's
    time-and-motion studies; Gilbreths filming workers. **In COGS:**
    `Task.actualDuration` + `completedChunks` already capture this; aggregate per
    recurring task into a standard.

27. **"Standard time" with beat-the-clock bonus (Gantt task-and-bonus).** Award
    bonus points for finishing under the standard time. **From the doc:** Gantt's
    "task and bonus plan… a bonus of up to 20 percent more." **In COGS:** extend
    `resolveCompletionPoints()` to add a multiplier when `actualDuration <
    estimatedDuration`.

28. **"One best way" procedure capture.** When a task type is done well, save the
    exact steps as the canonical procedure for next time. **From the doc:** "the
    'one best way' to perform the job"; "Procedure: how things should work, with a
    diagram." **In COGS:** a `procedure` document linked to an `ItemTypeDefinition`.

29. **Estimate-vs-actual calibration analytics.** Chart your estimation accuracy
    over time to fight time-blindness. **From the doc:** Taylor measurement +
    ADHD "time-blindness." **In COGS:** new Analytics view over
    `estimatedDuration` vs `actualDuration`.

30. **First-class "standard / benchmark" per item type.** A type can define
    target duration, target quality, expected output. **From the doc:** Taylor's
    "first-class worker" standard. **In COGS:** add benchmark fields to
    `ItemTypeDefinition.defaultAttributeValues`.

31. **Task templates ("optimized & simplified jobs").** Reusable task blueprints
    with pre-filled steps, resources, and metrics. **From the doc:** "productivity
    would increase if jobs were optimized and simplified… matching a worker to a
    job." **In COGS:** extend `module-templates.ts` to also scaffold single tasks.

32. **Separate "planning" from "doing" modes.** A dedicated planning surface vs. a
    stripped-down execution surface. **From the doc:** Fayol/Taylor "management
    can plan… workers execute"; "separate planning from doing." **In COGS:** a
    Focus/Execution mode that hides planning chrome (ties to ADHD section).

---

## D. Plan-vs-reality, control & review (Fayol's "Control")

33. **Plan-vs-reality dashboard.** Side-by-side of what was planned for a period
    vs. what actually happened. **From the doc:** Fayol's *Control* ("verify
    whether things are going according to plan"); systems-approach feedback loops.
    **In COGS:** the long-noted missing Analytics view; data already in plan-text
    + `timeLogs` + completions. (SPEC §15 gap.)

34. **Intention→outcome variance score.** A single number per period for how
    closely reality matched the plan. **From the doc:** systems-approach feedback;
    "track how your plans actually matched reality." **In COGS:** derived metric
    in reviews; store on `PeriodReview`.

35. **Feedback-loop prompts in reviews.** Each review surfaces "where did the plan
    diverge and why?" with structured causes. **From the doc:** "asking/analyzing
    why things went well or didn't… brainstorm how to do better." **In COGS:**
    add structured cause tags to `PeriodReview.reflections`.

36. **Post-mortem on completed tasks.** A quick retro per finished task
    (satisfaction/resistance/focus/distraction). **From the doc:** "review small
    problems as a batch and make decisions to increase overall productivity." **In
    COGS:** `TaskCompletionReview` type already exists — wire a UI (SPEC §13.7).

37. **Batch problem review.** Group recent failures/overdues and decide a single
    systemic fix. **From the doc:** "Review small problems as a batch and make
    decisions to increase overall productivity." **In COGS:** a Review sub-step
    listing overdue/pushed tasks with a "root cause + fix" capture.

38. **"What padding/mechanism would prevent this next time?"** A review prompt
    that turns failures into new guardrails. **From the doc:** "what padding or
    extra mechanisms might be created in the future to improve performance." **In
    COGS:** review answer that can spawn an `ItemTypeRule` or a checklist.

39. **Spawned items from reviews.** A review can directly create next-period
    tasks/plans. **From the doc:** continuous improvement loop. **In COGS:**
    `PeriodReview.spawnedItems` (SPEC §13 gap) → push into Plan.

40. **Scheduled review prompting.** Proactive nudges when a period closes, beyond
    the header badge. **From the doc:** "Scheduled Reminders or updates to core
    principles." **In COGS:** extend `lib/pending-reviews.ts` with notifications.

41. **Regret accrual.** Track the cost of not-done important tasks over time.
    **From the doc:** systems feedback + the spec's own §14.4. **In COGS:** SPEC
    §14.4 missing item; a `regret` ledger parallel to `points-store`.

---

## E. Priority, attention & information theory

42. **Entropy-aware prioritization.** Use the existing `entropy` field as a real
    signal: high-entropy (uncertain) items bubble up for clarification; certainty
    increases as you act. **From the doc:** "Higher entropy at the top, complete
    certainty at the bottom." **In COGS:** `Task.entropy` exists — feed it into
    To-Do sort and Inbox clarification ordering.

43. **Minimum-redundancy dedup.** Detect near-duplicate tasks/notes and offer to
    merge. **From the doc:** "Principle of Minimum Redundancy… eliminate
    unnecessary or redundant information." **In COGS:** fuzzy match on
    titles/tags (future MongoDB text/vector search) → merge suggestions.

44. **Maximum-entropy input diversity.** When planning a goal, prompt for diverse
    sources/perspectives to reduce bias. **From the doc:** "maximize the entropy
    of information sources… reducing bias." **In COGS:** a planning checklist that
    asks for ≥N distinct sources/angles before finalizing.

45. **Noise reduction / Focus mode.** A distraction-minimizing single-task view.
    **From the doc:** signal theory "reduce 'noise'… minimize disruptions." **In
    COGS:** full-screen focus over one task + its molecular steps; hide all tabs.

46. **Priority formula transparency.** Show how urgency/importance/cognitiveLoad/
    entropy combine into a rank, and let the user reweight. **From the doc:**
    MCDA "weighing different factors." **In COGS:** the To-Do tiering already
    implies a formula — expose and make it configurable.

47. **Uncertainty-reduction clarification flow.** The Inbox clarifier explicitly
    asks the questions that most reduce uncertainty about a captured item. **From
    the doc:** Uncertainty Reduction Theory; "conduct an interview… get all
    information needed to correctly route the input." **In COGS:** upgrade
    `TaskClarificationDialog` (SPEC §4.4) with guided routing questions.

48. **Signal/priority broadcasting.** Clear visual "this is the one thing that
    matters today" surfacing. **From the doc:** signaling "priorities,
    responsibilities, expected outcomes… increase clarity." **In COGS:** a
    pinned "today's signal" slot on the Home dashboard.

---

## F. Decision-making & multi-criteria analysis

49. **Decision matrix module.** A weighted multi-criteria scoring grid for
    choices (options × criteria × weights → ranked result). **From the doc:**
    MCDA; "decision matrices" explicitly listed as a list use-case. **In COGS:**
    a new Module/workspace view over a list where rows = options, attributes =
    criteria, with a computed weighted score.

50. **Pros/cons + "different methods" capture.** For any decision/task, enumerate
    all known methods with advantages/disadvantages before choosing. **From the
    doc:** "ALL POTENTIAL METHODS FOR ACCOMPLISHING A TASK SHOULD BE INCLUDED!"
    **In COGS:** a structured `methods[]` attribute (method, pros, cons, cost).

51. **Choice architecture / nudges.** Design defaults and option ordering to steer
    toward intended behavior (recommended option first, friction on bad ones).
    **From the doc:** "Choice Architecture… the way choices are presented
    impacts decisions." **In COGS:** smart default selection in dialogs; surface
    the "recommended" next action prominently.

52. **Affordance-based environment design.** Configure the app so the
    environment itself affords good behavior (e.g. the easiest path is the planned
    one). **From the doc:** Affordance Theory ("bike lanes afford cycling"). **In
    COGS:** make the planned next action the lowest-friction button everywhere.

53. **Cost/ease/consequence triage.** Tag options by cost, ease, and downstream
    consequence to compare quickly. **From the doc:** LLCGPT "considering ease,
    cost, and potential consequences." **In COGS:** three numeric attributes on a
    decision item type.

54. **Game-theory "stakeholder" view.** For decisions involving other people,
    model each party's interests and look for win-win moves. **From the doc:**
    "Game theory… cooperative strategies or win-win solutions." **In COGS:** a
    decision detail panel listing stakeholders + their interests.

---

## G. Second-brain knowledge graph: Sources

55. **Source as a first-class item type.** A `source` item with content, type
    (full / snippet / report), origin (URL/file/page/chunk), summary, hints,
    tags, trust, and related sources. **From the doc:** the detailed `Source`
    schema appears many times. **In COGS:** new `ItemTypeDefinition` "Source"
    with those attributes; fits the unified Item model exactly.

56. **Trust score on sources.** A numeric, updatable trust level that grows with
    corroboration. **From the doc:** `trust`, `update_trust()`, `get_trust()`.
    **In COGS:** `trust` number attribute + a recompute helper.

57. **Fact-checking elevation levels.** Each "check" escalates a source/claim to
    a higher verification tier. **From the doc:** "checked: number of times…
    each time escalating it to a higher level fact checking procedure." **In
    COGS:** `factCheckLevel` integer; badge in the item card.

58. **Auto-summary + "hint" generation for sources.** Long + short summaries and a
    situational "how to use this" hint. **From the doc:** `get_summary()`,
    `get_hint()`; "short summary and full summary." **In COGS:** attributes
    `summaryShort`, `summaryLong`, `usageHint` (AI-fillable later).

59. **Source ingestion pipeline (PDF / web / YouTube).** Import a URL, PDF, or
    YouTube video (transcribe), auto-tag and summarize, and save as a source.
    **From the doc:** the whisper/pytube transcription snippet; PDF indexer; "save
    the source document after browsing." **In COGS:** an importer feeding the
    Source item type (web-only at first).

60. **Index/TOC-based auto-tagging.** Use a document's index, chapters, and
    headers to derive tags; drop tags too dissimilar from content. **From the
    doc:** "Use index to add tags… use chapters and headers… if the tag is too
    dissimilar, don't include it." **In COGS:** a tagging step in ingestion.

61. **"Approve before ingest" gate.** User reviews and approves sources before
    they enter the knowledge base. **From the doc:** "should be able to 'approve'
    sources before they are 'ingested'." **In COGS:** a staging area / inbox for
    sources.

62. **Source usage tracking.** Record which items/notes cited a source and how.
    **From the doc:** `uses` ("keeps track of the agents that used this source and
    what they did with it"). **In COGS:** reverse `ItemLink` index ("cited-by").

63. **Per-source visibility / hidden flag.** Keep some sources in the store but
    hidden from normal views. **From the doc:** `hidden: bool`. **In COGS:** an
    `archived`/`hidden` attribute already conceptually supported.

---

## H. Second-brain knowledge graph: Beliefs

64. **Belief as a first-class item type.** A `belief` item: statement,
    presuppositions, subject tags, supporting vs. refuting sources, and a dynamic
    strength. **From the doc:** the detailed `Belief` schema. **In COGS:** new
    item type with `links` to sources via relations `"supports"`/`"refutes"`.

65. **Dynamic belief strength.** Strength computed from number + strength of
    confirming vs. opposing sources (each source also weighted by its trust).
    **From the doc:** "dynamic belief strength based on strength and number of
    confirming and opposing sources." **In COGS:** a recompute helper in `lib/`.

66. **Support spectrum on links.** Source→belief links carry a level: strong
    support / weak support / no relation / weak refute / strong refute. **From the
    doc:** the exact five-level enum. **In COGS:** add a `weight`/`stance` field
    to `ItemLink`.

67. **Contradiction detection + resolution.** Flag mutually inconsistent beliefs
    and walk the user through resolving (reword, synthesize, or drop the weaker).
    **From the doc:** `resolve_contradiction()`; "mark conflicts and seek more
    information to resolve." **In COGS:** a "conflicts" view + guided resolver.

68. **Belief consolidation (dedup/merge).** Detect redundant beliefs and merge;
    keep non-redundant set. **From the doc:** `consolidate_beliefs()`; "eliminate
    redundancy and contradiction in beliefs." **In COGS:** a maintenance action.

69. **Conclusions drawn from belief sets.** Derive new conclusions from
    combinations of beliefs. **From the doc:** `draw_conclusions()`,
    `develop_conclusions(beliefs)`. **In COGS:** a `conclusion` item type linked
    to its premise beliefs.

70. **Lockable / "core" beliefs.** Mark certain beliefs as core (hard or
    impossible to auto-edit). **From the doc:** "core_beliefs ## cannot be edited
    (?) or harder to edit"; "lock beliefs or categories to stop them updating."
    **In COGS:** a `locked` flag on items.

71. **Belief history / evolution trace.** Track how a belief's strength and
    supporting sources changed over time. **From the doc:** "self.history —
    specifically how belief set/strengths have changed over time"; "trace the
    creation, storage and evolution of these ideas." **In COGS:** an append-only
    change log per item.

72. **Null/dismissed beliefs.** Remember beliefs you've judged irrelevant so they
    aren't re-created. **From the doc:** "Null beliefs: seemingly irrelevant, but
    still there so it doesn't recreate them." **In COGS:** a "dismissed" archive
    that dedup checks against.

73. **Confidence/certainty on any statement.** Optional certainty value plus a
    short justification ("explanation for the high level of certainty"). **From
    the doc:** "all accepted 'true' statements associated with a formal proof or
    at least an explanation." **In COGS:** `certainty` + `justification` fields.

---

## I. Second-brain knowledge graph: Concepts & understanding maps

74. **Concept item type with interrelations.** A `concept` carries a description,
    related concepts, and a certainty for each relation. **From the doc:**
    "concepts — as molecular as possible… all concepts interrelated"; "each
    concept should have a certainty." **In COGS:** new item type + typed `links`.

75. **Auto concept extraction from a topic.** Generate an exhaustive
    concept-dictionary for any topic (key concept → short description). **From the
    doc:** the big "concept generation experiment" (returns `{concept:
    description}`). **In COGS:** a tool that seeds Concept items from a topic.

76. **Understanding maps.** Visual maps where understanding = concepts + the
    relations between them; an "understanding" emerges when relations are certain
    enough. **From the doc:** "Belief → Conclusion → Concepts and Relations →
    General Understanding"; "Maps of meaning." **In COGS:** a graph visualization
    over Concept items and their links.

77. **Relations as their own objects (with beliefs).** A relation between two
    concepts is itself an entity that can hold beliefs and certainty. **From the
    doc:** "Relations and concepts both have their own sets of beliefs." **In
    COGS:** promote significant links to first-class "relation" items.

78. **"Express X as a combination of concepts."** Decompose a topic into its
    component concepts you already understand. **From the doc:** "express as a
    combination of the following concepts." **In COGS:** a detail-panel tool on
    Concept items.

79. **Expand-understanding action.** "Research this more" adds new relations or
    deepens existing ones on a concept map. **From the doc:** "Expand
    understanding of topic = research it more and add more to the understanding."
    **In COGS:** an action that creates linked sub-concepts/sources.

80. **Categories as "types of understanding."** Categories group understandings
    that share an analogous structure (analogous but different components). **From
    the doc:** "Categories are types of understanding which follow a similar
    structure… analogous but different components." **In COGS:** richer category
    semantics for the second-brain types.

81. **Double-referencing / forced categories.** An item can belong to multiple
    concept clusters at once; deliberately surface under-represented documents.
    **From the doc:** "things can be double referenced… categories can be forced…
    find the documents not represented for any keyword." **In COGS:** multi-membership
    is already supported via `Task.categories[]`; add a "gaps" report.

82. **Topic clustering + auto-category labeling.** Extract topics from all notes,
    cluster, and propose smartly-labeled dynamic categories. **From the doc:**
    "Topic extraction from every text… find the topics that cluster… dynamically
    generated categories with smart labels." **In COGS:** an analytics/maintenance
    job (needs embeddings; aligns with MongoDB vector roadmap).

83. **Self-updating but lockable knowledge.** The graph re-derives itself as new
    sources arrive, except where the user has locked nodes. **From the doc:**
    "Should all be self-updating and able to be user hard-coded… lock beliefs or
    categories." **In COGS:** background recompute respecting `locked`.

---

## J. Research workflow & document/report items

84. **Document-type items (rich text).** Notion/Docs-style rich body as an item
    type — already the stated long-term vision. **From the doc:** reports,
    outlines, abstracts everywhere. **In COGS:** SPEC long-term "document-type
    items"; `Item.body` + an editor.

85. **Report items with attached source list + abstract.** A `report` carries
    content, the full list of sources used, an auto abstract, and "suggested
    further research." **From the doc:** `Report` schema; "create an abstract +
    suggestions for further research." **In COGS:** report item type linking its
    sources.

86. **Guided research procedure.** A repeatable flow: gather sources → background
    reports → guiding questions → answer (pulling source snippets) → beliefs →
    outline → write. **From the doc:** the multi-page Research_Agent procedure.
    **In COGS:** a research workspace template chaining these steps as items.

87. **Background-knowledge reports.** Before a deep dive, generate "what would I
    need to know first" sub-topics and short reports. **From the doc:**
    `get_background()`; "list any areas of background knowledge useful to
    understand {topic}." **In COGS:** a prerequisite-topics generator.

88. **Rabbit-hole depth limit.** Bound recursion when auto-generating background
    reports. **From the doc:** `rabbit_hole_depth`, `max_rabbit_hole`. **In
    COGS:** a depth setting on the research workspace.

89. **Guiding questions list per topic.** Maintain the open questions that, once
    answered, complete understanding; check them off as sources resolve them.
    **From the doc:** "Create a list of questions to guide your research…
    eliminate redundant questions." **In COGS:** a `question` item type linked to
    topic + answering sources.

90. **"Is this enough?" readiness gate.** A check on whether current sources
    suffice before writing, with "blind spot" detection. **From the doc:** "does
    it appear the information will be sufficient…?"; "any blind spots in your
    sources?" **In COGS:** a readiness checklist on the research workspace.

91. **Multi-perspective ("emotional") reports → synthesis.** Generate several
    differing-stance write-ups, then synthesize a neutral lit-review. **From the
    doc:** "Create several 'emotional research reports'… synthesized from
    multiple." **In COGS:** linked draft items → one synthesized report.

92. **Ask-vs-search sources.** Two modes: "search sources" (returns documents) and
    "ask sources" (returns an answer). **From the doc:** "Search Sources —
    documents / Ask sources — answer." **In COGS:** two query modes over the
    Source corpus (semantic search roadmap).

93. **Required-sources-first search.** Consult user-uploaded sources first; only
    fall back to others if results are weak. **From the doc:** "user uploaded
    sources are consulted first… others only if result too weak." **In COGS:** a
    source-priority tier on search.

94. **LaTeX / math note interpreter.** Parse LaTeX math notes, answer questions
    about them, and categorize math concepts. **From the doc:** the "Personal
    LaTeX Math Notes Interpreter" project + "learn to understand/categorize
    math/latex." **In COGS:** a math-note item subtype with rendering + Q&A.

---

## K. The "Brain2" agent-corporation as an automation/module layer

95. **Handbook of constraints per project.** Project-level absolute rules nothing
    may violate, plus per-item-type rules. **From the doc:** "Handbook:
    Constraints. Absolute rules… each individual employee should also have their
    own set of absolute rules." **In COGS:** `ItemTypeRule` exists — add a
    project-scope rule set with `block`/`require` actions.

96. **Mission statement (the "why") per project.** A first-class WHY that can be
    invoked when stuck. **From the doc:** "Mission Statement: The WHY"; "keep an
    emphasis on WHY the agents are doing what they're doing." **In COGS:**
    `Task.why` exists for tasks — elevate to projects and surface when overdue.

97. **Procedure diagrams tied to pipelines.** Document how a process works with a
    diagram that can later drive automation. **From the doc:** "Procedure: how
    things should work, with a diagram… tied to the actual pipeline code." **In
    COGS:** a procedure item with an embedded flow diagram.

98. **Rule engine expansion (triggers/conditions/actions).** Grow the existing
    serializable rule system: more triggers, more actions (notify, spawn task,
    escalate). **From the doc:** the whole authority/accountability/metrics/
    retraining loop. **In COGS:** extend `ItemRuleAction` /`ItemRuleTrigger` in
    `lib/types.ts` (already designed for this).

99. **Escalation / "move it up" on difficulty.** If a task stalls or exceeds a
    difficulty threshold, auto-escalate (re-prioritize, flag for help). **From the
    doc:** "have a lower level agent assess difficulty… if they can't do it
    properly, move it up." **In COGS:** a rule that bumps tier / flags after N
    pushes (`daysPushed`).

100. **Difficulty assessment before assignment.** Estimate task difficulty up
     front and route accordingly. **From the doc:** "assess the level of
     difficulty before assigning the task." **In COGS:** `cognitiveLoad` (1–3)
     exists — use it to route into Focus vs. quick-win lanes.

101. **"Natural selection" of methods (experiment tracking).** Try variants of a
     routine, keep what measurably works, retire what doesn't. **From the doc:**
     "Natural Selection: if an adaptation gives an advantage it should stay…
     internal experiments… to make the right decision in the future." **In
     COGS:** an experiment log linking a method variant to outcome metrics.

102. **Preference learning ("pick the better of two").** Periodically show two of
     your past plans/outputs and ask which was better, to learn your taste. **From
     the doc:** "TRAINING IDEA: have the user pick between 2 outputs which is
     better." **In COGS:** an A/B capture stored for later weighting.

103. **Committees / multi-angle deliberation.** For a hard decision, spin up
     several "perspectives" that argue, then converge. **From the doc:**
     "Committees for investigating… HAVE THE COMMITTEES MAKE CHARTS! REPORTS!
     symposium." **In COGS:** a structured multi-perspective note → synthesis.

104. **Monitoring/contingency predictions.** Make explicit predictions about how
     a project will unfold and watch which branch is occurring. **From the doc:**
     "MONITORING AGENTS THAT MAKE PREDICTIONS FOR CONTINGENCIES… determine which
     projected course is being taken." **In COGS:** a `prediction` item with
     outcome-tracking; ties to Plan-vs-reality.

105. **Sandboxed experiments + config backups.** Run risky reorganizations in an
     isolated copy; back up working configurations to roll back. **From the doc:**
     "experimental divisions that operate in containers… backup different
     configurations in case something goes wrong." **In COGS:** snapshot/restore
     of the whole data set (aligns with JSON export/import, SPEC §3).

106. **Caching of recurring outputs.** Cache the result of repeated, identical
     operations (toggleable when you want freshness). **From the doc:** "FrugalGPT
     … a cache of commonly used responses… enable-able/disableable." **In COGS:**
     a results cache for expensive computed views/AI calls.

107. **Tiered model/effort routing.** Route simple work to cheap/fast handling and
     hard work to heavyweight handling. **From the doc:** "LLM cascade… simple
     tasks to a cheaper model, complex tasks to a more powerful one." **In COGS:**
     when AI lands, pick model by task `domain`/`cognitiveLoad`.

108. **Tool/resource retriever per task.** Decide which tools a task needs and
     attach usage instructions the worker can reference on error. **From the
     doc:** "query tool retriever"; "training uploaded into memory on how to use
     the tool." **In COGS:** resource links + a how-to note per task type.

---

## L. Conscious / subconscious cognition & ambient surfacing

109. **Ambient "subconscious" surfacing.** A background process that, given what
     you're doing, quietly surfaces relevant past notes, beliefs, and resources.
     **From the doc:** "Subconscious is constantly responding and evoking relevant
     resources, memories, core beliefs… informs the conscious." **In COGS:** a
     "related items" rail driven by tags/links/embeddings.

110. **Two-track item detail (foreground + context).** The detail view shows the
     item plus an automatically-assembled context panel (its why, related items,
     relevant beliefs). **From the doc:** "subconscious output is conscious
     input." **In COGS:** add a context sidebar to `ItemDetailPage`.

111. **"Search your brain" universal semantic search.** One box that retrieves
     across every item type by meaning, not just keyword. **From the doc:**
     "'Search your brain'"; "Search your brain" + semantic search emphasis. **In
     COGS:** the planned MongoDB text/vector search over all items.

112. **Semantic-reaction triggers.** Certain words/tags in an item automatically
     pull in associated resources/rules. **From the doc:** "Certain words in the
     prompt triggering certain resources? Give them semantic reactions." **In
     COGS:** keyword→resource rules (a special `ItemTypeRule` trigger on text).

113. **Core principles / knowledge base with scheduled resurfacing.** A small set
     of core principles that periodically resurface for review. **From the doc:**
     "Scheduled Reminders or updates to core principles/core knowledge base." **In
     COGS:** a "core" list + spaced resurfacing (ties to active recall below).

114. **The "librarian" = active recall.** A spaced-repetition mechanism that
     resurfaces knowledge items for active recall. **From the doc:** "the
     librarian is the active recall mechanism." **In COGS:** an SRS scheduler over
     note/concept items (intervals stored as attributes).

115. **Memory tiers.** Distinguish long-term (archived), short-term (active),
     and "voluntary/error-handling" (recently-failed) item pools, each surfaced
     differently. **From the doc:** "vector memory for long term, cache memory for
     short term, voluntary memory for error handling, core beliefs continuously
     updated." **In COGS:** a `memoryTier` attribute influencing surfacing.

---

## M. Capture, multimodal & visual ("Pinterest-y") experience

116. **Visual/gallery-first boards.** A Pinterest-style visual board over image-
     bearing items. **From the doc:** "I literally want it to have an almost
     pinterest-y feel at times." **In COGS:** the Lists gallery + orbs exist —
     extend to a masonry image board (Module gallery view).

117. **Image-attribute mood boards.** Items with `image`/`multiimage` attributes
     arranged as a visual collection for vibes/decisions. **From the doc:**
     pinterest feel + multimodal search. **In COGS:** `AttributeType` already
     includes `image`/`multiimage`; add a board layout.

118. **Visual/similar-image search.** Find items by image similarity. **From the
     doc:** "A visual search system takes an image and returns similar items."
     **In COGS:** future embedding search over item images.

119. **Recommendation surfacing.** "Because you did/saved X, consider Y" across
     lists. **From the doc:** "A recommendation system… returns similar items
     optimizing for an objective." **In COGS:** a recommendations rail from
     link/tag co-occurrence.

120. **Voice / quick multimodal capture.** Capture by voice (transcribe) or image
     straight into the Inbox. **From the doc:** whisper transcription; multimodal
     emphasis. **In COGS:** extend Quick Add with audio/image capture.

121. **Comment-section / opinion-corpus analysis.** Paste a discussion thread and
     get a structured map of what people think (stances + frequency). **From the
     doc:** "Symposium style analysis of all comments… develop an awareness of
     what people generally think." **In COGS:** an analysis tool producing
     belief/stance items.

---

## N. Outsourcing, delegation & the wider world

122. **Delegation / "who does this" assignment.** Assign tasks to other people (or
     a future agent) and track status of delegated work. **From the doc:** the
     whole 4-Hour-Workweek "Outsourcing Life" section; "delegation, proposal, and
     approval." **In COGS:** an `assignee` attribute + a "delegated" view.

123. **Proposal → approval workflow.** Items can be proposed and require approval
     before becoming active (for delegated or auto-generated work). **From the
     doc:** "Emphasizing the concept of delegation, proposal, and approval";
     "challenge proposal / accept proposal." **In COGS:** a `proposed` status +
     approve/reject actions.

124. **Service-research tasks.** A task type that researches the best provider for
     a need (e.g. "find the best X near me"), comparing options. **From the doc:**
     "research the best hair place near me"; the Craigslist personal-chef example.
     **In COGS:** a "service quest" item linking candidate-option items.

125. **Real-world quest templates.** Templates for multi-step life admin (e.g.
     "form an LLC", "hire help") with stages, resources, and contingencies.
     **From the doc:** the recurring "LLCGPT" worked example. **In COGS:** add to
     `module-templates.ts` alongside Itinerary/Cleaning/Budget.

126. **Monitoring/watcher items.** Standing watchers that track an external metric
     over time (price, availability) and alert on change. **From the doc:** "An
     agent to monitor house prices"; "agents keep track of your money/schedule."
     **In COGS:** a `watcher` item type with a tracked value series.

127. **Finance/money tracking surface.** A dedicated money view beyond the Budget
     template — net worth, recurring costs, runway. **From the doc:** "Agents keep
     track of your money"; "You need money to live." **In COGS:** a finance
     workspace + transaction item type.

---

## O. ADHD-aware design (executive function support)

128. **Anti-paralysis "just start" mode.** When a task is stalled, collapse it to
     its single smallest next molecular action and a 2-minute timer. **From the
     doc:** the ADHD-paralysis concept maps (task initiation, "Task Breakdown into
     smaller steps"). **In COGS:** a "start the tiniest piece" button on stuck
     tasks.

129. **Body-doubling / focus-session timer.** A co-working timer (Pomodoro +
     ambient presence) to externalize accountability. **From the doc:** ADHD
     "structured environment," reward-driven behavior; existing focus-timer view.
     **In COGS:** the Module **timer** view exists — add session logging + streaks.

130. **Time-blindness aids.** Always-visible elapsed/remaining time, and "this
     usually takes you N min" hints from history. **From the doc:** ADHD
     "Time-blindness… difficulty comprehending the passage of time." **In COGS:**
     surface `actualDuration` history inline while doing a task.

131. **Immediate-reward scheduling.** Front-load small rewards/points for task
     initiation, not just completion. **From the doc:** ADHD "Reward-Driven
     Behavior… struggle to initiate tasks without immediate rewards." **In COGS:**
     award partial points on starting (`completedChunks` already exists).

132. **RSD-aware gentle framing.** Soft, non-punitive language for overdue/missed
     items; reframe "failure" as data. **From the doc:** ADHD "Rejection Sensitive
     Dysphoria… self-compassion." **In COGS:** a tone setting for overdue badges
     and review prompts.

133. **Structured-environment defaults.** Strong routines/templates and
     predictable layouts as the default for users who want them. **From the doc:**
     ADHD "Structured Environment: routine, order, predictability." **In COGS:**
     a "routine mode" with fixed daily scaffolding.

134. **Externalize-everything inbox.** Frictionless dump-it-here capture so
     nothing has to be held in working memory. **From the doc:** ADHD "Working
     Memory… impaired"; the app's own "capture-first" philosophy. **In COGS:**
     Quick Add/Bulk Add exist — add a global hotkey + always-on capture bar.

135. **Hyperfocus harnessing.** Detect a long unbroken focus session and offer to
     queue the next related task automatically. **From the doc:** ADHD energy
     patterns + reward-driven behavior. **In COGS:** chain next task from
     `timeLogs` session length.

136. **Perfectionism guardrails.** "Good enough" definitions of done to prevent
     endless polishing. **From the doc:** ADHD "Perfectionism… unrealistically
     high standards interfere with completion." **In COGS:** a `definitionOfDone`
     attribute that caps a task.

---

## P. Self-tracking, metrics & analytics depth

137. **Arbitrary user-defined metrics.** Track any numeric/qualitative metric on
     any schedule (mood, energy, symptom, custom). **From the doc:** "Track
     yourself on any number of metrics at any time, then analyze." **In COGS:**
     the TimeGrid scopes + habit types are a start; generalize to a `metric` item
     type with a value series.

138. **Trend detection over your data.** Surface emerging upward/downward trends
     and change-points in any tracked series. **From the doc:** "OKAY ABSOLUTELY
     THE ML SCHEDULER WILL USE TREND DETECTION (REALLY EXCITING!!)"; "change-point
     detection." **In COGS:** a trend-analysis helper feeding Analytics.

139. **Predictive scheduling from patterns.** Suggest when to do a task based on
     when you historically do similar things well. **From the doc:** "ML
     scheduler… trend detection"; metalearning "adapt to new tasks quickly." **In
     COGS:** SPEC §15.3 deferred predictive analytics; derive from `timeLogs`.

140. **Correlation explorer.** "Does my mood correlate with sleep / exercise /
     task completion?" cross-metric analysis. **From the doc:** self-analysis +
     "analyze that data to understand patterns and trends." **In COGS:** a new
     Analytics view correlating any two tracked series.

141. **Where-I've-been map.** Map view of logged locations over time. **From the
     doc:** the doc's geo/location interest + the README's own "Where I've been on
     a map" note. **In COGS:** TimeGrid has a Location scope + `TimeLogEntry.location`;
     add a map (SPEC §15 idea).

142. **Cognitive-state trends.** Chart entropy/cognitiveLoad/mood over time to see
     how your mental state moves. **From the doc:** the "cognitive state"
     framing + information theory. **In COGS:** `cognitive-state.tsx` exists;
     add a trend chart (SPEC §15 gap).

143. **Category/area performance view.** Which life areas (lists) are thriving vs.
     neglected, by completion + points. **From the doc:** "evaluate performance in
     various areas… why things went well or not." **In COGS:** SPEC §15
     category-performance view over `task-store` + `points-store`.

144. **Streaks everywhere.** Compute and display streaks for habits, reviews, and
     focus sessions. **From the doc:** reward/consistency emphasis. **In COGS:**
     SPEC §9.5 streaks gap; a streak widget across habits.

145. **Embedding-stream / semantic shape visualization.** Visualize the "shape" of
     your notes/thoughts in semantic space over time. **From the doc:** "Is there
     a way to graph the embeddings of the sources or the thoughts of an agent
     visually?… semantic isomorphs." **In COGS:** a 2D projection (UMAP/t-SNE) of
     item embeddings — far-future, vector-search dependent.

---

## Q. Data model & platform foundations (enablers for the above)

146. **Generic typed links graph.** Lean fully into `ItemLink` so any item can
     relate to any item with a typed relation, and visualize the whole graph.
     **From the doc:** knowledge graphs, neurosymbolic "ontologies," "everything
     interrelated." **In COGS:** `ItemLink` exists in `lib/types.ts`; build the
     graph view + a relation-type registry (SPEC §5 + long-term vision).

147. **Tags as a real dimension (distinct from categories).** Free-form tags
     (e.g. "to schedule") usable for routing, filtering, and semantic reactions.
     **From the doc:** double-referencing, dynamic categories, "to schedule" tag.
     **In COGS:** `Item.tags` exists; SPEC §6.5 wants "to schedule" as a tag — add
     tag UI + filters.

148. **Nested categories (`parentCategoryId`).** Hierarchical lists/folders for
     deeper structure. **From the doc:** Weber's hierarchy; knowledge-tree
     framing. **In COGS:** SPEC §6.2 gap; folders nest but categories don't yet.

149. **Computed / formula attributes.** Spreadsheet-style formulas and cross-item
     rollups in the grid. **From the doc:** charts/rollups; "in-grid formulas."
     **In COGS:** SPEC long-term + `spreadsheet-utils.ts` rollups exist; add
     per-cell formulas.

150. **JSON export/import + snapshots + migrations.** One-click backup/restore of
     everything, with versioned migrations. **From the doc:** "backup different
     configurations in case something goes wrong"; database/logging emphasis.
     **In COGS:** SPEC §3 highest-leverage gap; `lib/migrations.ts` exists, add
     export/import (a `BackupRestore.tsx` is already stubbed).

151. **MongoDB + semantic/fuzzy/vector search backend.** The durable store that
     unlocks "search your brain," dedup, clustering, and recommendations. **From
     the doc:** vector DBs (Pinecone/Weaviate/Elastic), embeddings, semantic
     search throughout. **In COGS:** SPEC §3 planned MongoDB layer via Electron
     IPC.

152. **Per-item provenance/origin metadata.** Every item records where/when/how it
     came to exist (captured, imported, spawned-by-review, derived). **From the
     doc:** the `origin` field on sources/beliefs ("URL/filepath/page/chunk OR the
     belief set that gave rise to it"). **In COGS:** an `origin` attribute on
     `Item`.

153. **Append-only activity log / "inherent logging."** Log significant item
     changes for transparency and undo, "so you can see what they're thinking."
     **From the doc:** "Database… creates inherent logging for increased user
     interactability or intervention." **In COGS:** a lightweight change log
     across stores.

154. **Portable, serializable rules/types (cross-app).** Keep item types, rules,
     and templates exportable so setups can be shared. **From the doc:** "Designed
     to be flexible and portable across applications (fully serializable)." **In
     COGS:** `ItemTypeDefinition`/`ItemTypeRule` are already serializable — add a
     share/import format.

---

## R. Bigger swings (pie-in-the-sky)

155. **AI "council of advisors" / persona panel.** Consult configurable expert
     personas (and let them debate) over your own data and decisions. **From the
     doc:** "Eventually a website where you can generate collections of text from
     various experts… consult that expert directly, or have those experts
     argue/discuss." **In COGS:** persona items + a debate view over your sources.

156. **Devil's-advocate / second-thought reviewer.** An automatic challenger that
     pokes holes in your plans and beliefs. **From the doc:** "Lex bot + Second
     Thought bot"; "Challenge proposal." **In COGS:** a review mode that surfaces
     counter-evidence (refuting links) for your active beliefs/plans.

157. **Goal-reasoning agent.** A system that not only pursues goals but reasons
     about *which* goals to pursue, detecting discrepancies and reprioritizing.
     **From the doc:** the Goal-Driven Autonomy / goal-reasoning Q&A. **In COGS:**
     a goal-review assistant over the Goals/Objectives model (SPEC §10).

158. **Neurosymbolic "explainable" suggestions.** Any AI suggestion comes with the
     symbolic reasons (which beliefs/sources/rules led to it). **From the doc:**
     extensive neurosymbolic / explainability section. **In COGS:** attach a
     "why this suggestion" trace (linked items) to every recommendation.

159. **Self-improving system that proposes its own changes.** The app notices
     friction patterns and proposes new rules/templates/automations, run by you
     for approval. **From the doc:** "agents to assess how things are going…
     brainstorm how to do better… Run changes by user." **In COGS:** a
     "suggested improvements" inbox generated from analytics + review data.

160. **Models develop a shorthand / your personal ontology.** Over time the system
     learns your personal vocabulary for recurring concepts and uses it. **From
     the doc:** "save on token cost by having the models 'speak their own
     language'… develop relevant words for common concepts." **In COGS:** a
     learned synonym/alias map feeding search + tagging.

---

# Expansion II — 120 additional ideas (June 2026)

> Ideas **161–280** are a second mining pass over a fresh batch of source
> documents (two **Brain2** prototype docs, six **COGS**-titled docs, and the long
> **"to-do list theory app"** doc), generated by three parallel readings and
> grounded the same way (a passage from the source + a concrete place in the COGS
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

161. **Grey out past days in every calendar.** Dim already-elapsed dates across the
     Month/Week views so the eye lands on what is still actionable. **From the doc:**
     the prototype change-list opens with "Calendar — Grey out past days." **In COGS:**
     compute "is past" against `lib/use-current-date.ts` inside
     `components/Home/Plan/month-view.tsx` / `week-view.tsx`; render a `.fm98`-friendly
     muted cell state (no data-model change needed).

162. **Aligned, clickable week-label rail.** A left rail of week labels that lines up
     pixel-perfect with the calendar rows and, on click, jumps the Plan/Scheduler to
     that week. **From the doc:** "Line up week labels / Make week labels clickable."
     **In COGS:** add a week gutter to `components/Home/Plan/month-view.tsx` that calls
     into `plan-panel.tsx` state and persists focus via `lib/app-navigation.ts`; week
     keys come from `lib/date-utils.ts` `getWeekString`.

163. **Click any day cell to drill into it.** Clicking a date opens that day's
     agenda/plan rather than only selecting it. **From the doc:** "Make days clickable."
     **In COGS:** wire `onSelect` in `month-view.tsx` to switch `plan-panel.tsx` to the
     Day view (`day-view.tsx` + `agenda-grid.tsx`) and set the shared selected day used
     by `lib/use-current-date.ts`.

164. **Nameable periods (custom week/month titles).** Let a user title a week or month
     ("Move week", "Launch sprint") so periods become memorable anchors, not just date
     ranges. **From the doc:** the "week of August 29th… (possibility to name week
     eventually??)" note. **In COGS:** add an optional `label` to `PeriodReview` and a
     small `periodKey → label` map persisted alongside plan text in `lib/plan-text.ts`;
     surface in Plan headers and the Reviews ritual.

165. **Explicit human date-range label on each week.** Show "Week of Aug 29 – Sep 4"
     as the week header, derived live and responsive to the rollover. **From the doc:**
     'Add week label — "week of August 29th - August 30th".' **In COGS:** a formatter in
     `lib/date-utils.ts` consumed by `week-view.tsx`; reuses the canonical week string so
     it stays consistent with the Scheduler funnel.

166. **Per-day completion progress bar on calendar cells.** Each day cell carries a thin
     bar showing that day's habit + to-do completion ratio. **From the doc:** "Checklist —
     Add progress bar to days." **In COGS:** derive the ratio from `habits-store` +
     `task-store` completions for that date and render it in `month-view.tsx` /
     `week-view.tsx`; pure math can live beside `lib/calculations.ts`.

167. **Live, responsive "today" header that updates itself.** A date display that
     re-renders at midnight and reflects the currently-selected day everywhere. **From
     the doc:** 'Add date (eventually clickable, updating, responsive).' **In COGS:**
     already seeded by `lib/use-current-date.ts` (midnight rollover) — extend it to a
     shared, clickable header component reused by Home, Plan, and Tracking.

### T. Weekly composite layout, checklists & agenda

168. **Three-zone weekly composite (checklist · goals/priorities · to-do).** A single
     weekly screen with the habit checklist center, goals/priorities to the right, and
     the to-do list beneath — the prototype's signature layout. **From the doc:** "Goals
     and priorities to the right, to do list below" and "Add goals/priorities (beside
     checklist) / Add to do (beneath checklist)." **In COGS:** a layout preset in
     `components/Home/home-dashboard.tsx` composing `habit-tracker.tsx`,
     `goals-tracker.tsx`, and `ToDo/todo-panel.tsx` into one bound weekly view.

169. **Inline note / event / reminder on a checklist day.** Drop a quick note, event, or
     reminder directly onto a day without leaving the weekly grid. **From the doc:** "Add
     note/event/reminder." **In COGS:** reuse `CalendarEvent` (`event-store.ts`) and
     `MonthlyItem` (`type: "deadline" | "reminder"`) from `lib/types.ts`, surfaced via an
     inline affordance in `agenda-grid.tsx` / `week-view.tsx`.

170. **"Practices" — lightweight recurring micro-habits beside the checklist.** A column
     of small daily practices distinct from heavyweight habits, tracked with a tap. **From
     the doc:** "Add practices." **In COGS:** model as `WeeklyTask` with
     `frequency: "daily"` and `TaskType.BOOLEAN` in `habits-store`, rendered in a compact
     "practices" strip within `habit-tracker.tsx`.

171. **Embedded day plan / agenda inside the week.** Each day expands to a mini agenda
     (free-text plan + timed slots) without navigating away. **From the doc:** "Add day
     plan/agenda." **In COGS:** embed `Home/Plan/agenda-grid.tsx` (already shared with
     Tracking) plus the `dayPlan-*` free text from `lib/plan-text.ts` into the weekly
     composite.

172. **"Add more tasks" quick-append in the grid.** A persistent affordance to keep
     appending tasks to a day/week without opening a dialog. **From the doc:** "Add more
     tasks." **In COGS:** an inline add-row in `ToDo/TodoTable.tsx` / `AddTodoDialog.tsx`
     that creates `Task`s in `task-store` pre-scoped to the focused date.

173. **Goals/priorities sidebar bound to the active period.** A right-hand rail that
     always shows the current week's top goals and priorities, editable in place. **From
     the doc:** "Add goals/priorities (beside checklist)." **In COGS:** extend
     `components/Home/Plan/planned-tasks-sidebar.tsx` to surface period-scoped `Goal`s
     (`goals-store`) alongside high-tier to-dos.

174. **Checklist-view day progress, not just list progress.** The Lists checklist display
     gains the same per-day progress bar so any list used as a routine shows momentum.
     **From the doc:** "Checklist — Add progress bar to days." **In COGS:** add a progress
     header to `components/Lists/list-content/ListContentChecklist.tsx`, computed over the
     list's completed vs. total items.

175. **Staged onboarding that reveals tabs progressively.** Introduce Lists, Points, and
     advanced surfaces only once the basics are in use — the prototype explicitly deferred
     them to "Eventually." **From the doc:** the "Eventually: Add lists tab / Add 'points'
     concept" section. **In COGS:** a first-run flag in `lib/app-navigation.ts` gating tab
     visibility in `app/page.tsx`, easing new users into the full omni-tool.

### U. Goal typing, inline editing & grids

176. **First-class x/x goal list type.** A list whose items are progress goals rendered as
     "current / target" with a bar, distinct from plain task lists. **From the doc:**
     "Create a specific goal list type for x/x progress per goal." **In COGS:** the
     `AttributeType` `"goal"` + `GoalValue {current, target}` already exist in
     `lib/types.ts`; ship a built-in `ItemTypeDefinition` "Goal List" whose default
     attribute is a `goal` value, displayed via `attributes/AttributeValueField.tsx`.

177. **Click-to-edit cells, type-to-create rows.** Editing text by clicking it and adding
     items just by typing at the bottom — frictionless list authoring. **From the doc:**
     "Change tasklist type to allow proper adding & editing (text on click, add by
     typing)." **In COGS:** strengthen inline editing in
     `components/Lists/list-content/ListContentSpreadsheet.tsx` and
     `components/spreadsheet/SheetGrid.tsx`, plus a persistent "type to add" trailing row.

178. **Trailing "ghost row" on every list display.** A blank affordance row at the end of
     any list/grid that materializes into a real item on first keystroke. **From the doc:**
     "add by typing." **In COGS:** add to `Lists/list-content/ListContentPanel.tsx` and
     `SheetGrid.tsx`; creation routes through `createListItem` in `lib/item-utils.ts`.

179. **Goal-progress rollups across a list.** Sum/average `current` vs `target` across all
     goal-typed items to show aggregate progress for a goal list. **From the doc:** the
     x/x-progress goal-list idea. **In COGS:** extend `lib/spreadsheet-utils.ts` rollups to
     understand `GoalValue`, feeding Module **summary** views and the Lists footer totals.

180. **Editable data grid with an arbitrary number of variables.** Any list can grow new
     typed columns on the fly, mirroring the prototype's variable-count grid. **From the
     doc:** "an interesting way to create table/lists with any number of variables." **In
     COGS:** the add-column path in `SheetGrid.tsx` extends `TaskCategory.itemAttributes`
     via `attributes/AttributeSchemaEditor.tsx` — generalize column types to the full
     `AttributeType` union.

181. **Goal/priority quick-edit without a dialog.** Edit a goal's target or a priority's
     rank inline, matching the "text on click" ergonomic. **From the doc:** "proper adding
     & editing (text on click)." **In COGS:** inline `AttributeValueField` editors in
     `goals-tracker.tsx` and the priorities rail, writing straight to `goals-store` /
     `task-store`.

182. **Spreadsheet-as-default for any list flagged "data-heavy."** Lists with many
     attributes auto-open in the grid display so variable-rich data stays legible. **From
     the doc:** the editable data-grid emphasis ("Editable data grid list"). **In COGS:** a
     per-list `displayMode` preference in `lib/lists-ui-store.ts` defaulting to
     `ListContentSpreadsheet.tsx` when `itemAttributes.length` is large.

### V. The "databrain" prototype — capture, notes & command surfaces

183. **Global command palette for everything.** A keyboard-summoned palette to jump to any
     list/item, run actions, or capture — the prototype's most promising unfinished piece.
     **From the doc:** "Command palette currently needs work but cool idea." **In COGS:**
     this seam already exists as `components/Search/GlobalSearch.tsx` +
     `components/Search/useGlobalSearchHotkey.ts`; back it with `lib/search.ts` and add an
     actions registry (navigate, create, toggle) over the Zustand stores.

184. **Rich note-taking as a real item type.** A document-style note with a body editor,
     captured fast and linked to other items — the prototype centered on "React elements
     for note taking." **From the doc:** "React elements for note taking and many other
     things"; "creating/saving notes." **In COGS:** add a built-in `note`
     `ItemTypeDefinition` with an `Item.body` rich-text field (the README's long-term
     document-type item), edited in `ItemDetail/ItemDetailPage.tsx`.

185. **Bulletproof note autosave + a real repository layer.** Notes must never silently
     fail to save — the prototype's notes "not really working… maybe issue with database
     access." **From the doc:** "creating/saving notes not really working it seems / Maybe
     issue with database access?" **In COGS:** route writes through the stubbed
     `lib/data/task-repository.ts` + `lib/data/schemas.ts` with optimistic local persistence
     and `lib/data/backup.ts` snapshots, ahead of the MongoDB cutover.

186. **Self-hosted semantic search over notes & sources (FAST-TRACK).** Search notes,
     resources, and documents by meaning using a local embedding index — no paid tokens —
     and expose it inside user-built widgets. **From the doc:** the databrain's note/search
     ambitions and "many other things." **In COGS:** build `lib/search.ts` on a self-hosted
     vector index (e.g. Haystack-style, local model), queryable from `GlobalSearch.tsx` and
     bindable as a Module view source — the prioritized semantic-search track.

187. **Command palette as a capture surface, not just navigation.** Typing a sentence and
     hitting enter drops it into the Inbox, so capture is always one keystroke away. **From
     the doc:** the command-palette concept + databrain's capture focus. **In COGS:** fold
     `components/quick-add.tsx` capture logic into `GlobalSearch.tsx` so the palette routes
     free text to `inbox.tsx`.

188. **"More interactivity per page" — progressive in-place actions.** Surface contextual
     actions (complete, schedule, link, tag) directly on items wherever they appear, rather
     than only in detail views. **From the doc:** "code for a lot more interactivity on
     pages which could be awesome." **In COGS:** add hover/inline action affordances in
     `Lists/views/*` and `SchedulerTaskItem.tsx`, reusing the mutators in
     `ItemDetail/useItemDetailDraft.ts`.

189. **Login / profile gate for the desktop shell.** A working sign-in so data and (future)
     sync are scoped to a user — the one piece the prototype shipped solidly. **From the
     doc:** "Login system works." **In COGS:** a local profile gate in `electron/main.js` +
     `preload.js`, scoping localStorage/MongoDB keys per profile (deferred until the
     storage layer lands).

### W. State architecture, links & theming lessons

190. **Atom-style fine-grained cell reactivity.** Editing one grid cell should re-render
     only that cell, learned from the prototype's jotai-atom table. **From the doc:** "Most
     of the action takes place in the atoms and the components"; "jotai table system from
     scratch??" **In COGS:** use narrow Zustand selectors (and `useShallow`) per cell in
     `components/spreadsheet/SheetGrid.tsx` so large lists stay responsive.

191. **Fix the "weird link structure" with clean typed links.** A coherent, typed
     relationship layer instead of the prototype's confusing linking. **From the doc:**
     "Link structure is kinda weird." **In COGS:** lean on `ItemLink {relation, targetId}`
     in `lib/types.ts` with pure helpers in `lib/links.ts`, surfaced through
     `ItemDetail/LinkPicker.tsx` and `RelatedItemsPanel.tsx`.

192. **Theme system beyond "ugly rainbow buttons."** A coherent, tasteful palette and
     control styling rather than ad-hoc loud buttons. **From the doc:** "Lol but the ugly
     rainbow buttons." **In COGS:** centralize palette decisions in `lib/theme-store.ts`
     and the Win95 chrome in `app/win95.css`, with a small set of curated themes.

193. **Drag-to-paint as a reusable interaction primitive.** The prototype's "drag your
     finger" dashboard gesture generalizes to painting state across cells/days. **From the
     doc:** "Maybe like if you drag your finger it does that." **In COGS:** the 15-minute
     paint pens in `components/Home/Tracking/time-grid.tsx` already do this — extract the
     drag-paint handler for reuse in calendar selection and grid multi-edit.

194. **No third-party grid lock-in (the syncfusion lesson).** Keep the data grid in-house
     so no community-license expiry can break core functionality. **From the doc:** "Has
     syncfusion community license check if still active… to see how much to rely on it."
     **In COGS:** `components/spreadsheet/SheetGrid.tsx` is already a from-scratch grid —
     keep grids dependency-light and document the deliberate choice.

195. **Separate pure logic from components (atoms/components split).** Keep computation in
     testable pure modules and UI thin — the prototype's "action takes place in the atoms
     and the components." **From the doc:** "Most of the action takes place in the atoms
     and the components." **In COGS:** this is already the house pattern (`lib/*-utils.ts`
     vs. `components/*`); codify it as a rule so new features (e.g. `scheduler-utils.ts`,
     `todo-utils.ts`) keep math out of JSX.

### X. Onboarding, animation, shell & database

196. **Memorable animated splash / boot screen.** A distinctive opening animation that
     sets the app's identity, in the spirit of the prototype's standout homepage. **From
     the doc:** "INCREDIBLE homepage. Awesome 3js animation"; "the cool homepage
     animation?" **In COGS:** a lightweight, dependency-free Win95-style boot/splash in
     `app/layout.tsx` (CSS/canvas, no heavy 3D libs) honoring the retro skin.

197. **Mobile / responsive web target alongside desktop.** Design core surfaces to degrade
     gracefully to small screens even if the desktop shell stays primary. **From the doc:**
     "Would be cool transferred to mobile. Still cool if it can't be transferred"; "wouldn't
     transfer to mobile but still awesome." **In COGS:** use `hooks/use-mobile.tsx`
     (`useIsMobile()`) to drive responsive layouts in `home-dashboard.tsx` and Lists, since
     the build already runs as a plain web app.

198. **Connect to a real database (durable source of truth).** Move off fragile
     localStorage to a proper document store, as both prototypes wished. **From the doc:**
     "Connect to a database" (planning prototype) + the databrain's "issue with database
     access?" **In COGS:** realize the planned MongoDB layer via Electron IPC behind
     `lib/data/task-repository.ts` + `lib/data/schemas.ts`, with `lib/migrations.ts` running
     versioned migrations (SPEC §3).

199. **One-click backup/restore before the DB cutover.** Make data portable and safe with
     JSON export/import and snapshots, de-risking the storage migration. **From the doc:**
     the repeated database-access pain in the databrain notes. **In COGS:** finish the
     stubbed `components/Settings/BackupRestore.tsx` over `lib/data/backup.ts`, exporting all
     ten Zustand stores plus `plan-text` keys (SPEC §3, highest-leverage gap).

200. **Sustained "font & appearance" polish pass.** Treat visual refinement as an explicit,
     recurring workstream, not an afterthought — the prototype literally listed it. **From
     the doc:** "Improve UI (font, appearance)." **In COGS:** consolidate pixel-font and
     bevel styling across `app/win95.css`, `app/globals.css`, and
     `components/Lists/filemanager98.css`, and add a typography/spacing audit checklist to
     the Reviews ritual for the app itself.

## Batch B · COGS docs (201–240)

### Y. Operations — projects as first-class "directed enterprises"

201. **Operation as a first-class item type.** Promote the recurring "Operation"
     concept to its own `ItemTypeDefinition` ("operation") — a directed,
     finite-lifespan enterprise that owns goals, objectives, a timeline, a plan,
     tasks, resources, progress, and a completion flag. **From the doc:**
     "OPERATION BASED PLANNING AND TASK MANAGEMENT FOR DAILY LIFE… operation has:
     goals, Objectives, timeline, plan, tasks, Completion (bool), Progress,
     Phases? … Notes, Resources" (`cogs_operations.pdf`). **In COGS:** register an
     `operation` type in `lib/item-type-store.ts`; it composes with the existing
     `Item`/`ItemLink`/`attributes` primitives in `lib/types.ts` (cross-ref idea
     #9's stages/steps hierarchy).

202. **"Upgrade task → operation" action.** A one-click promotion that turns a
     stuck or sprawling Next-Actions task into a full Operation, carrying its
     existing subtasks/notes across. **From the doc:** "Operation can be included
     on a next action list => a task can get upgraded to an operation"; "Tasks
     should be able to be upgraded to" (`cogs_operations.pdf`). **In COGS:** an
     action in `components/ItemDetail/ItemDetailPage.tsx` that re-types the `Item`
     and seeds an operation workspace via `lib/module-templates.ts`.

203. **Operation Home tab with a notes pad + work/neglect heatmap.** Each
     operation opens to a landing page with a free-text notes area and a calendar
     heatmap of how much you've worked on vs. neglected it. **From the doc:**
     "Home: the home page for the operation, with a text area for the user to
     input and save notes… there is also a heatmap showing the user how much they
     work on/neglect the project" (`cogs_operations.pdf`). **In COGS:** a
     workspace **notes** view + a per-operation heatmap built from `Task.timeLogs`
     / `points-store` completions (reuse the Analytics habit-heatmap renderer in
     `components/Analytics/enhanced-analytics.tsx`).

204. **Phases as checkpoints with explicit completion criteria.** An operation
     can define ordered "phases"; phase N is complete when its criteria/goals are
     met, which is literally how you know you've entered phase N+1. **From the
     doc:** "Phases??? Like checkpoints. Phase 1- completed when? that's how u
     know ur in phase 2"; "create 'phases' with specific goals or tasks
     associated in order for it to be considered completed" (`cogs_operations.pdf`).
     **In COGS:** a `phase` sub-entity linked via `ItemLink` relation
     `"phase-of"`, each with a completion `ItemRuleCondition` in `lib/types.ts`.

205. **Operation timeline by "project week #".** Plan deadlines relative to the
     operation's own start ("by project week 3") instead of only absolute dates,
     plus a final project deadline. **From the doc:** "timeline: add deadlines to
     a phase, add final deadline to project, plan when to get everything done by
     project week #" (`cogs_operations.pdf`). **In COGS:** a relative-offset
     scheduling helper in `lib/scheduling.ts` that resolves project-week offsets
     into concrete `Task.deadline` dates.

206. **Log-while-working stream per operation.** A running, timestamped work log
     you append to in the moment, distinct from the static notes pad. **From the
     doc:** "Log while working on!!! Notes !!! for sure" (`cogs_operations.pdf`).
     **In COGS:** append entries to `Task.timeLogs` (`TimeLogEntry` already carries
     `notes`/`date`) surfaced as a chronological feed in the operation workspace.

207. **"To do next" immediate-next-steps rail.** Every operation keeps a short,
     always-visible queue of the immediate next physical actions, separate from
     the full task backlog. **From the doc:** "To do next. (immediate next steps
     list)"; "Resources / To do next." (`cogs_operations.pdf`). **In COGS:** a
     filtered view over the operation's child tasks (tag `next` or top-N by tier)
     rendered as a workspace **checklist** view (cross-ref idea #48 "today's
     signal").

208. **Operation post-mortem on completion.** When an operation finishes, prompt
     a structured retro: what you did, what to do differently next time, and notes
     — saved as a reusable lesson. **From the doc:** "Review upon completion -
     what you did, what there is to do next time, any notes" (`cogs_operations.pdf`).
     **In COGS:** extend `PeriodReview`/`TaskCompletionReview` patterns in
     `lib/reviews-store.ts` with an operation-scoped review (cross-ref idea #36
     task post-mortems).

209. **Operation resources panel.** First-class "Resources" section listing the
     documents, tools, links, and references an operation depends on, preloaded
     into its workspace. **From the doc:** "Resources" listed twice in the
     operation shape (`cogs_operations.pdf`). **In COGS:** `ItemLink` relation
     `"resource-of"` rendered in `components/ItemDetail/RelatedItemsPanel.tsx`
     (cross-ref idea #12).

210. **Systems-view operation dashboard (inputs → process → outputs).** A view
     mode that renders an operation as a self-contained system with inputs
     (resources/dependencies), a process flow with current bottlenecks, and
     outputs (goals/metrics/deadlines), topped by health indicators. **From the
     doc:** "Outcome-Oriented Systems View… Inputs… Process Flow… Outputs… Visual
     dashboard with health indicators (entropy, time overrun)" (`cogs_operations.pdf`).
     **In COGS:** a new Module **summary/stat** composite that reads
     `Task.entropy` and estimated-vs-actual duration for the overrun gauge.

211. **OKR view mode for operations.** Map an operation to an Objective plus
     measurable Key Results, each with its own progress bar and linked tasks/effort.
     **From the doc:** "Goal-Driven OKR Tracker… Operation = Objective… Attach Key
     Results… Progress bar per KR, task linkage, effort spent per goal"
     (`cogs_operations.pdf`). **In COGS:** bind the operation to `Objective`
     entities (see idea #214) and render per-KR `goal`-type attributes
     (`AttributeType: "goal"` already exists in `lib/types.ts`).

212. **HTN hierarchical workflow view (expandable tree).** Render an operation as
     a composite task decomposed Plan → Design → Develop → Deploy, with expandable
     tree/collapsible cards and %-complete + blockers per node. **From the doc:**
     "Projects-as-Process (Hierarchical Workflows)… Theory: HTN Planning… Tasks
     nested hierarchically… Visualization: expandable tree or collapsible cards"
     (`cogs_operations.pdf`). **In COGS:** a tree view over `Task.subtasks` /
     `dependencies`, reusing `GraphNode`/`GraphEdge` in `lib/types.ts`
     (cross-ref ideas #14–18).

213. **Selectable operation paradigm (flow / goal / load).** Let each operation
     switch between the hierarchical, systems, and OKR lenses as a view mode or
     dynamic layered filter, depending on context. **From the doc:** "Each
     approach could be selectable as a view mode or filter, or layered
     dynamically via metadata, allowing users to shift between flow-based,
     goal-based, and load-based views" (`cogs_operations.pdf`). **In COGS:** a
     `viewMode` setting on the operation `ModuleInstance` in `lib/modules-store.ts`.

### Z. Goals, objectives, actions & "direction in life"

214. **Objective entity (numerical goal over a time period).** Add a first-class
     `Objective` distinct from `Goal`: a concrete, measurable target scoped to a
     period (year/month/custom) with a completion fraction and a separate "track"
     pace fraction. **From the doc:** "objective: id:1 period: year… name: go
     surfing 3 times per month, completed: false, completion: 13/36, track: 12/18"
     (`COGS REVIEW_RUNDOWN.pdf`). **In COGS:** new `Objective` interface in
     `lib/types.ts` + a `goals-store.ts` slice (closes SPEC §10 gap; cross-ref
     idea #157).

215. **Goal ↔ Objective ↔ Action link graph.** Wire the three layers: goals hold
     the "why", objectives quantify them per period, and daily actions roll up to
     both. **From the doc:** "objective… goals: [1,2], actions: [1]"; "action: id:1
     name: go surfing, goals: [1,2], objectives: [1]"; "Daily task actions can
     also be associated with goals" (`COGS REVIEW_RUNDOWN.pdf`). **In COGS:** typed
     `ItemLink` relations `"objective-of"`/`"action-of"` between `Goal`,
     `Objective`, and `Task` items (cross-ref idea #146).

216. **Multi-horizon objective nesting.** A yearly objective contains the monthly
     objectives that ladder up to it ("go surfing 3×/month" under a year target),
     and progress aggregates upward. **From the doc:** the year objective "go
     surfing 3 times per month" alongside "objective: period: month, month: may,
     name: go surfing 3 times" (`COGS REVIEW_RUNDOWN.pdf`); "be healthy extends
     across all time periods and has different objectives depending on the time
     period" (`COGS REVIEW_RUNDOWN.pdf`). **In COGS:** `Objective.parentObjectiveId`
     + rollup helper in `lib/calculations.ts`.

217. **"Before I turn 26" custom-range milestone objectives.** Support objectives
     bound to an arbitrary life milestone window rather than a calendar period
     (e.g. "surf 26 times, read 26 books, 1300 chess rating before 26"). **From
     the doc:** "Before I turn 26: 1M followers… surf 26 times… read 26 books…
     1300 chess rating" (`COGS REVIEW_RUNDOWN.pdf`). **In COGS:** add a
     `custom-range` value to `Objective.period` with explicit start/end (closes
     the SPEC §10 milestone gap).

218. **Goal "why" reason-stack surfaced when stuck.** A goal carries a stack of
     ranked reasons (not one line); when a linked task is overdue or pushed,
     resurface the why. **From the doc:** "goal: id:2 name: be good at surfing,
     why: helps you be healthy, the ocean is fun, it's a cool hobby, great
     exercise, meditative…" (`COGS REVIEW_RUNDOWN.pdf`). **In COGS:** a
     `multistring` "why" attribute on the `goal` type; surface it in
     `components/Home/NeedsAttention.tsx` for flagged items (cross-ref idea #96).

219. **Daily goal/priority re-ordering ritual.** A lightweight daily step where
     you reorder your goals/priorities as they pertain to *that* day, captured in
     the day review. **From the doc:** "EACH DAY ORDER YOUR PRIORITIES/GOALS AS
     THEY PERTAIN TO THAT DAY (reviews) also at the beginning/end of each week,
     month, quarter (Season), year" (`COGS REVIEW_RUNDOWN.pdf`). **In COGS:** a
     per-day ordering persisted on the day `PeriodReview` in `lib/reviews-store.ts`
     (note: "Season" = the existing `quarter` review period).

220. **Stakes / self-imposed penalty on unmet objectives.** Let an objective
     declare a consequence (e.g. a money penalty, or auto-purchasing what wasn't
     achieved) that the review surfaces when the period closes unmet. **From the
     doc:** "purchase whatever isn't achieved. (so $25 penalty this month for goal
     not reached)" (`COGS REVIEW_RUNDOWN.pdf`). **In COGS:** a `stake` attribute
     on `Objective`; tie into the Regret ledger (SPEC §14.4, cross-ref idea #41).

221. **Sub-goals with their own measurable targets.** A goal can spawn sub-goals
     that are themselves trackable (e.g. "double account size each month" under
     "optimize social media"). **From the doc:** "sub-goal: double account size
     each month"; "Goal: optimize social media accounts" (`COGS REVIEW_RUNDOWN.pdf`).
     **In COGS:** `Goal.parentGoalId` + `ItemLink` `"subgoal-of"`.

222. **"Entropy-violation" tactic field on goals.** Capture the deliberate,
     diversity-injecting moves that break out of a stale pattern toward a goal
     (mass-unfollow, post longer captions, broaden inputs). **From the doc:**
     "entropyviolation: mass unfollow, post more cool/interesting stuff with
     longer captions… art and soul, good songs" (`COGS REVIEW_RUNDOWN.pdf`). **In
     COGS:** a free-text `entropyViolation` attribute on the `goal` type
     (cross-ref idea #44 max-entropy input diversity).

223. **Action-to-goal alignment tagging on daily tasks.** Every daily task/habit
     can declare which goal(s) and objective(s) it serves, so completing it
     advances measurable progress automatically. **From the doc:** "Daily task
     actions can also be associated with goals"; "action… goals: [1,2],
     objectives: [1]" (`COGS REVIEW_RUNDOWN.pdf`). **In COGS:** add goal/objective
     link options to the daily-task form (`components/Home/Habits/daily-task-form-dialog.tsx`)
     that increment objective `completion` on completion.

224. **"Direction in life" goal-coverage report.** A dashboard answering "are my
     daily actions actually serving my expressed goals?" — flag goals with no
     recent linked actions, and days whose tasks served no goal. **From the doc:**
     "ensure I'm on path with all my expressed goals and that I know what they
     are… it's DIRECTION IN LIFE essentially" (`COGS REVIEW_RUNDOWN.pdf`). **In
     COGS:** an Analytics view joining goal/objective links to completions
     (cross-ref ideas #81 "gaps report" and #143 category performance).

### AA. Scheduling refinement, carry-over & calendar planning

225. **Two-step coarse → fine scheduling.** Keep the Scheduler as the coarse pass
     (drop a long backlog into a month/week bucket) and Home/Plan as the fine pass
     (assign a specific time or reassign), making the funnel an explicit
     refinement pipeline. **From the doc:** "SCHEDULER: Take long list of general
     tasks… quickly assign them to a given month/week (1st step…), gets refined in
     home/plan where you actually schedule a specific time" (`COGS REVIEW_RUNDOWN.pdf`).
     **In COGS:** formalize the handoff between
     `components/Scheduler/enhanced-scheduler.tsx` (week/month fields) and
     `components/Home/Plan/plan-panel.tsx` (`scheduledDate`/`scheduledTime`).

226. **Default-on weekly carry-over of undone tasks.** At week rollover, all
     undone tasks shift into the new week automatically unless the user opts a
     task out; hardcoded/review-entered items are pinned "must be on". **From the
     doc:** "All undone from prior week, shifted to new week unless otherwise
     specified"; "Must be on: all user hardcoded (or entered from review)"
     (`COGS REVIEW_RUNDOWN.pdf`). **In COGS:** an automatic carry-over pass in
     `lib/scheduling.ts` using `Task.weeksPushed` (closes SPEC §7.7; cross-ref
     existing carry-over prompt in Reviews).

227. **Event-linked to-do checklist (must-be-done-before).** Associate a
     prerequisite to-do list with a calendar event so its items inherit a
     "must be done before <event date>" deadline. **From the doc:** "associate a
     to-do list with an event, like Elijah Anniversary, must be done before: get
     elijah present" (`cogs_home_plan.pdf`). **In COGS:** `ItemLink` relation
     `"checklist-of"` from tasks to a `CalendarEvent`, deriving
     `schedulingConstraints.mustBeDoneBefore` from `CalendarEvent.date`
     (closes SPEC §7.5; cross-ref idea #7).

228. **Full-day & multi-day banner events.** Render reminder-style all-day events
     ("leave for Australia") and multi-day spans ("vacation to Tokyo") as banners
     at the top of the day column, not on the draggable hour grid. **From the
     doc:** "allow full day… or multi day events which should be displayed at the
     top of the day column rather than on the draggable grid" (`cogs_home_plan.pdf`).
     **In COGS:** use `CalendarEvent.isAllDay`/`endDate` (already in `lib/types.ts`)
     with a banner row in `components/Home/Plan/agenda-grid.tsx`.

229. **Scheduling conflict detection + automatic buffer time.** Warn when
     drag-scheduled tasks overlap, and auto-insert configurable buffer gaps
     between consecutive blocks. **From the doc:** "Conflict Detection: Automatic
     detection of scheduling conflicts… Buffer Time: Automatic buffer time between
     tasks" (`COGS REVIEW_RUNDOWN.pdf`). **In COGS:** an overlap/buffer check in
     `components/Scheduler/scheduler-utils.ts` over `scheduledTime` +
     `estimatedDuration` (cross-ref idea #24 auto-scheduler).

230. **Procedure items: if-then sequential steps that trigger reminders.** A
     procedure is an ordered chain where completing step N can fire the reminder
     for step N+1, encoding "how this gets done" as runnable structure. **From the
     doc:** "Add something about procedure; if-then sequential steps triggers
     reminders etc." (`COGS REVIEW_RUNDOWN.pdf`). **In COGS:** an `ItemTypeRule`
     with `trigger: "complete"` whose action schedules/surfaces the next linked
     step (cross-ref ideas #28 and #97; rule engine in `lib/item-types.ts`).

231. **Cognitive-state quick-log with user-defined scopes.** Extend the header
     Tracking quick-log to capture activity, feelings, and arbitrary user scopes
     (e.g. "nic cravings"), as a fast "for right now" entry distinct from detailed
     tracking. **From the doc:** "Quick log state (activity, feelings, nic cravings
     if applicable, whatever you want. Quick log for rn)" (`COGS REVIEW_RUNDOWN.pdf`).
     **In COGS:** add configurable scopes to `lib/time-tracking-store.ts` surfaced
     in `components/cognitive-state.tsx` (cross-ref idea #137 arbitrary metrics).

### AB. Lists, attributes, types & capture ergonomics

232. **Sublists nested inside a category.** Let a list contain named sub-lists
     ("Stuff to learn" → "Frameworks to explore") for one more level of structure
     without a separate folder. **From the doc:** "Add sublists to categories like
     stuff to learn => frameworks to explore or something" (`cogs_Next Actions.pdf`).
     **In COGS:** `TaskCategory.parentCategoryId` (the missing SPEC §6.2 field) +
     nesting in `components/Lists/navigation/FolderTree.tsx` (cross-ref idea #148).

233. **Per-category JSON export/import (granular, dev-friendly).** Beyond a global
     backup, allow exporting/importing a single category's lists + tasks as JSON
     from its settings, so individual structures survive iteration. **From the
     doc:** "Add ability to import/export all category/task data as json in Next
     Action/category settings… so [it doesn't] feel like it's dust in the wind…
     (LEARN FROM MISTAKES)" (`cogs_Next Actions.pdf`). **In COGS:** a per-category
     serializer in `lib/data/backup.ts` wired into
     `components/Lists/settings-dialog.tsx` (cross-ref idea #150 global JSON).

234. **Per-category default values for new items.** When a list defines defaults,
     new items added to it pre-fill those attribute/field values (duration, tier,
     reward). **From the doc:** "Eventually: add ability to add default values to
     created tasks in a category" (`cogs_Next Actions.pdf`). **In COGS:** surface
     `TaskCategory.defaultAttributeValues` (already in `lib/types.ts`) in the
     attribute editor and apply it in `lib/item-utils.ts` `createListItem`.

235. **Daily habits as a formal subtype of task.** Unify the parallel
     `WeeklyTask`/`Task` worlds so a daily habit *is* a task-subtype that
     participates in points, scheduling, and the grand to-do, instead of a
     separate structure. **From the doc:** "these daily tasks should be considered
     a subtype of task" (`COGS MVP.pdf`); "Daily Tasks… Needs to better correspond
     with point value and task structure" (`COGS MVP.pdf`). **In COGS:** model a
     `habit` `ItemTypeDefinition` (capabilities `completable`+`recurring`) bridging
     `lib/habits-store.ts` and `task-store` (cross-ref SPEC §9.4 gap).

236. **"Fully custom attributes" as the default mindset.** Lean into letting users
     attach *any* attribute (urgency, cost, custom) to any item/list, treating the
     built-in fields as just pre-seeded attributes — the "leveled-up spreadsheet"
     ethos. **From the doc:** "Other attributes- urgency, cost, etc. any custom
     ideally" (`COGS MVP.pdf`); "Literally just a leveled up version of Allieprime
     in google sheets" (`COGS MVP.pdf`). **In COGS:** expose a richer attribute
     palette in `components/Lists/attributes/AttributeSchemaEditor.tsx`
     (cross-ref ideas #149 formulas and the spreadsheet display).

### AC. Tracking, alignment & predictive analytics (classical/self-hosted)

237. **Intention-vs-alignment tracking score.** Make tracking dual-purpose: log
     what you actually did *and* the intention you set, then compute an alignment
     score between planned and actual time use. **From the doc:** "Dual purp- a.
     log status metrics and track. B. Set specific intentions and track alignment"
     (`COGS REVIEW_RUNDOWN.pdf`). **In COGS:** compare planned `CalendarEvent`s /
     plan-text against `TimeLogEntry` actuals in
     `components/Home/Tracking/actual-day-view.tsx` (classical diff, no LLM;
     cross-ref idea #33 plan-vs-reality).

238. **Burnout / overcommitment early-warning.** Detect upward trends and
     change-points in workload, pushed-task counts, and resistance that precede
     overcommitment, and warn before it happens — using classical change-point
     detection, not an LLM. **From the doc:** "Burnout Prevention: Early warning
     signs of overcommitment" (`COGS REVIEW_RUNDOWN.pdf`). **In COGS:** a
     fast-tracked classical-ML helper in `lib/` over `points-store` +
     `Task.daysPushed`, feeding an Analytics alert (cross-ref idea #138 trend
     detection; honors the self-hosted/classical-first constraint).

239. **Neglect detector wired into Needs Attention.** Surface goals, operations,
     and lists that have gone untouched too long (no recent linked actions or
     logs), extending the existing stale-task queue to higher-level structures.
     **From the doc:** the operation "heatmap showing… how much they work
     on/neglect the project" (`cogs_operations.pdf`) generalized across all areas.
     **In COGS:** add `neglected` reasons to `lib/needs-attention.ts` (which today
     handles overdue/unclarified/blocked/stale) and render them in
     `components/Home/NeedsAttention.tsx` (cross-ref idea #143).

240. **Semantic search over operation notes, logs & resources.** A fast-tracked
     local/self-hosted vector search (Haystack-style) across every operation's
     notes, work logs, and linked resources, usable from a global box and inside
     user-built widgets. **From the doc:** "Resources… Notes… Log while working"
     accumulate per operation (`cogs_operations.pdf`), and Analytics should
     "eventually analyze patterns" (`COGS REVIEW_RUNDOWN.pdf`). **In COGS:** index
     operation text in the planned local vector layer behind `lib/search.ts` and
     expose it via `components/Search/GlobalSearch.tsx` and a Module search view
     (fast-track per the semantic-search constraint; cross-ref ideas #111 & #151).

## Batch C · "To-do list theory" doc (241–280)

### AD. Capture & clarify (zero-friction inbox, entropy reduction)

241. **Global hotkey "lightbulb" quick-capture overlay.** A system-wide shortcut
     (e.g. `Cmd+Shift+I`) opens a minimal, blurred-background modal that accepts a
     single line and presses Enter to file it to the Inbox — never forcing
     structure up front. **From the doc:** "global keyboard shortcut (Cmd+Shift+I)…
     opens a minimal modal overlay… Instant capture: press Enter, done"; "hot key
     for quicknote would be cool… maybe lightbulb since it's all ideas." **In
     COGS:** wrap `components/quick-add.tsx` in a global hotkey handler registered
     in `app/page.tsx` (and an Electron `globalShortcut` in `electron/main.js`);
     extends #134.

242. **Local "smart parse" of dates, times & categories on capture.** As you type
     a capture line, classically (regex/`date-fns`, no LLM) highlight detected
     dates/times and `Category:` hints and offer to auto-extract them — structure
     optional. **From the doc:** "'Smart parse' highlights dates, times, and
     categories, offers to auto-extract structure, but never forces structure up
     front." **In COGS:** a pure `lib/smart-parse.ts` helper feeding
     `components/enhanced-bulk-add.tsx` (which already does `Category:` syntax) and
     Quick Add; self-hosted/classical, honoring the AI-last constraint.

243. **Inbox multi-select batch clarify / merge / move.** Select many inbox atoms
     and apply category, deadline, cognitive load, or context in one action, or
     merge near-identical captures. **From the doc:** "Multi-select for batch edit,
     merge, or move to clarify." **In COGS:** add selection state + a batch
     toolbar to `components/inbox.tsx`; merge reuses the dedup logic envisioned in
     #43.

244. **"Clarify all" keyboard-centric step-through mode.** A Superhuman/Linear-style
     flow that walks every uncleared inbox item one at a time, filling missing
     metadata with single keypresses. **From the doc:** "'Clarify all' mode: step
     through each, fill missing metadata in a 1-click, keyboard-centric flow (think
     Superhuman/Linear UX)." **In COGS:** a guided wizard over the
     `TaskClarificationDialog` in `components/inbox.tsx` (SPEC §4.4); extends #47.

245. **Drag-to-nest inbox items into subtasks.** In the inbox, drag one captured
     atom onto another to make it a subtask, building hierarchy before clarifying.
     **From the doc:** "Drag and drop to reorder or nest ('subtask')." **In COGS:**
     write to `Task.parentTaskId`/`Task.subtasks` (`lib/types.ts`) from a
     drag-drop handler in `components/inbox.tsx`.

246. **Outcome ("why this matters") as a clarify-time first field.** Distinguish a
     task's *outcome/purpose* from its description and prompt for it during
     clarification, separate from `why`/`consequences`. **From the doc:** atomic
     unit fields "Outcome (purpose)"; "Outcome — Why this matters (e.g., 'Move
     closer to project launch')." **In COGS:** surface `Task.why` (and a new
     `outcome` attribute) prominently in the `details` panel of
     `components/ItemDetail/ItemDetailPage.tsx`.

247. **Lightbulb "Idea" capture type with light flags.** Captures can be tagged at
     entry with quick flags (cost, this-weekend, prerequisites) so later sorting is
     cheaper, and pure ideas route to an Idea pool rather than the task lane.
     **From the doc:** "easy simple basic flag/additional info options to make
     sorting job easier later"; the raw dump "Elijah website ($900)… Reading room…
     read, sleep prior, pick outfit." **In COGS:** an `idea` `ItemTypeDefinition`
     (`lib/item-type-store.ts`) with a `flags` multistring attribute.

### AE. The transparent, editable priority engine

248. **First-class editable priority formula store.** Persist the weighted formula
     `Priority = (Importance × Urgency) / (Effort + CognitiveLoadWeight)` with
     user-tunable weights, recomputed live as factors change. **From the doc:** the
     literal `priorityFormula: { urgencyWeight, importanceWeight, effortWeight,
     cognitiveLoadWeight }` in `TaskState`, and "Priority = (Importance × Urgency)
     / (Effort + Cognitive Load Weight)." **In COGS:** add a `priorityFormula`
     slice to `lib/task-store.ts` and a pure scorer in `lib/scheduling.ts`;
     concretizes #46.

249. **Live priority queue with instant re-rank.** A To-Do view that auto-sorts by
     priority score and re-orders the instant any factor is edited. **From the
     doc:** "dynamic list with live updating scores (if you edit a factor,
     scores/ordering update instantly)." **In COGS:** a sort mode in
     `components/Home/ToDo/todo-panel.tsx` backed by `todo-utils.ts`, driven by the
     #248 scorer.

250. **"Why is this first?" score breakdown.** Hovering a task's rank shows the
     arithmetic (`5 × 4 / (2 + 1) = 6.7`) plus the dependency/critical-path reasons
     it's surfaced. **From the doc:** "Hover on a score: see the breakdown… 'Why is
     this first?' — shows dependency graph, urgency, and critical path
     highlights." **In COGS:** a tooltip/popover in the `analysis` panel of
     `components/ItemDetail/ItemDetailPage.tsx`; the explainable-trace cousin of
     #158.

251. **Manual score override with an audit log.** Let the user pin/override a
     computed priority, recording each override so the system can later learn from
     them. **From the doc:** "Option to manually adjust ('override' score, with log
     of overrides)." **In COGS:** an `overrideScore` field + append-only override
     entries on `Task` (`lib/types.ts`), feeding the change log in #153.

252. **Expected-utility / cost-of-delay triage.** A quick decision aid that
     computes value-of-doing-now vs. later and surfaces the cost of delay and
     opportunity cost to kill or defer low-value items. **From the doc:** "Use
     Decision Theory to Triage Tasks… expected value of doing this now vs later?…
     cost of delay?… opportunity cost?" **In COGS:** a pure
     `lib/services/triage-service.ts` deriving a delay-cost from `deadline` +
     `importance`; extends #53.

253. **"Available now" dependency-aware filter.** A filter that hides any task with
     unmet dependencies so the queue only shows what's actually actionable. **From
     the doc:** "Filter by: available tasks (no unmet dependencies)…"; "tasks with
     no unmet dependencies." **In COGS:** a predicate over `Task.dependencies` in
     `components/Scheduler/scheduler-utils.ts` and the To-Do filters.

### AF. Task graph, topological sort & critical path

254. **Atomic-task DAG view (React-Flow-style).** Render tasks as nodes and
     dependencies as edges in an interactive directed-acyclic graph for reasoning
     over a project. **From the doc:** "Directed Acyclic Graph… Nodes = tasks,
     Edges = dependencies"; "Interactive DAG visualization using React Flow or D3."
     **In COGS:** the `GraphNode`/`GraphEdge` types already exist in `lib/types.ts`
     — build the view as a Scheduler sub-view or Module kind; extends #18.

255. **Topological-sort execution preview (Kahn's algorithm).** One button computes
     a valid ordering of tasks respecting all dependencies and flags bottlenecks
     ("You cannot start X until Y is finished"). **From the doc:** "Topological
     Sorting: Generates valid execution sequences (Kahn, 1962)." **In COGS:** a
     pure `topologicalSort()` in `lib/scheduling.ts` over `Task.dependencies`,
     surfaced in the Scheduler.

256. **Cycle detection with guided fix on dependency edit.** When adding a
     dependency would create a loop, detect it and prompt the user to resolve.
     **From the doc:** "Drag nodes to connect… auto-detect cycles and prompt to
     fix." **In COGS:** validate in the dependencies mutator of
     `useItemDetailDraft` (`components/ItemDetail/useItemDetailDraft.ts`) before
     writing `Task.dependencies`.

257. **"What if I complete X?" simulation.** Mark a task hypothetically done and
     instantly see which tasks unblock and how the priority queue/schedule shifts.
     **From the doc:** "Option to simulate 'What if I complete X?' and instantly
     see schedule/priority shifts." **In COGS:** a read-only recompute path in
     `lib/scheduling.ts` that takes an overridden completed-set; pairs with #255.

258. **Zombie-task detector & sweeper.** Auto-flag tasks repeatedly rescheduled /
     long-resident with high entropy, and offer kill / split / clarify actions in
     the weekly review. **From the doc:** "Identify recurring 'zombie' tasks";
     "'Zombie task' sweeper (auto-flag and suggest kill/split/clarify actions)";
     "'Zombie' score: flag if it's been here > X days (entropy)." **In COGS:**
     derive from `Task.daysPushed`/`weeksPushed` + `entropy` (`lib/types.ts`) in
     `lib/needs-attention.ts`, surfaced in `components/Home/NeedsAttention.tsx`.

### AG. Minute-grid & cognitive-load-aware scheduling

259. **10-minute auto-fill scheduling grid.** A finer scheduling grid that
     auto-fills top-priority tasks into open slots, respecting dependencies and
     personal high-energy windows. **From the doc:** "Grid Planner (10-Minute
     Increments, 6am–10pm)… click 'Auto-Schedule,' and the system fits top-priority
     tasks into optimal windows, respecting dependencies, cognitive load,
     user-defined high-energy times." **In COGS:** a scheduling pass in
     `lib/services/scheduling-service.ts` feeding `components/Scheduler/DayAgenda.tsx`
     (the TimeGrid is 15-min for *tracking*; this is the *planning* analogue);
     realizes the deferred §7.6 and extends #24.

260. **Alternate-load day template + high-load cap.** A daily scaffold that
     alternates high/low cognitive-load tasks and refuses to schedule more than N
     high-load tasks. **From the doc:** "Alternate high and low cognitive load";
     "No more than 3 'High Load' tasks per day." **In COGS:** constraints in the
     #259 scheduler keyed off `Task.cognitiveLoad` (1–3); a setting in the
     Scheduler.

261. **Buffer / "drift" blocks after intense work.** Automatically suggest buffer
     and unstructured "drift" blocks after high-entropy tasks or long focus
     sprints, plus one drift block per hour. **From the doc:** "Buffer/Drift blocks
     are suggested after high-entropy tasks or long focus sprints"; "Leave 1 block
     per hour as 'drift time' for flexibility." **In COGS:** insert synthetic
     buffer `CalendarEvent`s (`lib/event-store.ts`) in `DayAgenda.tsx`.

262. **Cognitive-load & reward color encoding in the grid.** Encode load as
     saturation, reward as warm/cool hue, category as border, completed as dim
     strike-through, so the schedule reads at a glance. **From the doc:** "Color
     coding for: Cognitive load (saturation), Reward (warm/cool hues), Category (tag
     border), Completed (fade/dim with strike-through)." **In COGS:** a style
     helper in `components/Scheduler/SchedulerTaskItem.tsx` reading
     `cognitiveLoad`/`rewardValue`/`categories`/`completed`.

263. **Scheduling conflict detection + auto buffer.** Detect overlapping
     placements and automatically insert spacing between tasks. **From the doc:**
     "Conflict Detection: Automatic detection of scheduling conflicts"; "Buffer
     Time: Automatic buffer time between tasks." **In COGS:** an overlap check in
     `components/Scheduler/scheduler-utils.ts` / `Home/Plan/agenda-grid.tsx`,
     warning on drop.

264. **Intensity-based sprint timer (25:5 vs 52:17).** The focus timer picks a
     work/break ratio based on task intensity and logs the session. **From the
     doc:** "Apply Pomodoro (25:5) or 52:17 sprinting based on task intensity."
     **In COGS:** extend the Modules **timer** view
     (`components/Modules/workspace/module-view-bodies.tsx`) to choose a ratio from
     `cognitiveLoad` and append a `timeLogs` entry; extends #129.

### AH. Bayesian review, adaptive learning & richer status

265. **Morning review ritual (separate from end-of-day).** A start-of-day flow:
     log dream + wake time, decide which overdue/planned tasks to postpone, set
     intentions, and record affirmations. **From the doc:** "Morning review: Dream,
     Wake time, Decide which overdue/planned tasks to postpone, Set intentions for
     day, Affirmations." **In COGS:** a `morning` variant in
     `components/Reviews/reviews.tsx` / `lib/reviews-store.ts`, writing wake time
     into the day plan (`lib/plan-text.ts`).

266. **Richer completion status: done / partial / deferred / cancelled.** Replace
     the binary `completed` with a status so reviews and analytics can tell apart
     deferral from abandonment. **From the doc:** "Completion status
     (done/partial/deferred/cancelled)." **In COGS:** model as a per-type status
     attribute (the intentional non-core field noted in `lib/types.ts`), defaulting
     `Task.completed` semantics; `allowPartialCompletion`/`completedChunks` already
     exist for "partial."

267. **Structured "why blocked/skipped" reasons.** When a planned task isn't done,
     log a reason from a small taxonomy (ran out of energy, missing input,
     procrastination) for later pattern analysis. **From the doc:** "Prompts to log
     why tasks were blocked/skipped ('ran out of energy,' 'missing input,'
     'procrastination')." **In COGS:** a `blockedReason` selection attribute
     captured in the carry-over step of `components/Reviews/reviews.tsx`; extends
     #35.

268. **Bayesian effort-prior auto-learning.** Update each task's (or task type's)
     effort estimate from logged actuals via simple Bayesian updating, so estimates
     self-correct. **From the doc:** "System evolves via Bayesian inference:
     P(new estimate | data) ∝ P(data | estimate) × P(prior estimate)"; effort
     slider "with 'auto-learn' from past logs." **In COGS:** a classical estimator
     in `lib/services/completion-service.ts` over `estimatedDuration` vs
     `actualDuration`; extends #26 (a self-hosted, non-LLM ML win to fast-track).

269. **Weekly weight-retuning suggestions.** The weekly review evaluates how
     predictive the priority score was and suggests new formula weights. **From the
     doc:** "Tune the weights in your prioritization formula"; "Suggestions to
     retune priority weights based on observed performance." **In COGS:** a
     `lib/services/review-service.ts` routine comparing predicted rank vs. actual
     completion order, proposing edits to the #248 `priorityFormula`.

270. **Reward-realized vs. anticipated tracking.** Capture post-completion
     satisfaction and chart it against the anticipated `rewardValue` to learn what
     actually feels good. **From the doc:** "Reward Value (anticipated
     satisfaction, 1–10)"; "Updated entropy/confusion, reward satisfaction." **In
     COGS:** `TaskCompletionReview.satisfaction` already exists in `lib/types.ts` —
     wire its capture (SPEC §13.7) and an Analytics scatter.

271. **Self-graphed review history (draw-your-own-conclusions).** Plot the results
     of every past review and analysis so the user can spot their own patterns,
     not just receive verdicts. **From the doc:** "ALSO!!!! Display graphically
     results of prior reviews and analyses so the user can draw their own
     conclusions, the UI must also support this." **In COGS:** a reviews-history
     chart in `components/Analytics/enhanced-analytics.tsx` over
     `lib/reviews-store.ts`.

### AI. Cognitive state, capacity & live day-tracking

272. **Daily capacity self-assessment.** A start-of-day modal records sleep, mood,
     and energy and computes a cognitive-capacity score for the day. **From the
     doc:** "Daily Self-Assessment Modal… asks for sleep (hrs), mood (emoji
     slider), energy (1–5)"; "Adjust cognitive load tolerance for the day." **In
     COGS:** extend `components/cognitive-state.tsx` to store a daily capacity
     record (a `metric`-style series, cf. #137) alongside the TimeGrid.

273. **Capacity-gated scheduling.** When energy is low, the scheduler blocks/defers
     high-load tasks, suggests breaks, or lowers the WIP limit for the day. **From
     the doc:** "Block out high-load tasks when depleted"; "If energy is low,
     prompts to auto-reschedule high-load tasks, suggest breaks, or reduce WIP
     limit." **In COGS:** feed the #272 capacity score into
     `lib/services/scheduling-service.ts` as a per-day high-load budget; pairs with
     #260 and the WIP idea (#19).

274. **Live "resistance log" during the day.** A minute-by-minute capture of what
     you're doing now, how badly you don't want to do the thing you should, why,
     and what you did instead. **From the doc:** "Input: what you're doing rn, how
     bad you don't want to do what u have to do, why you're not doing what you
     should be… what you did instead." **In COGS:** add resistance/avoidance fields
     to `TimeLogEntry` (`lib/types.ts`) captured in
     `components/Home/Tracking/actual-day-view.tsx`.

275. **Context-switch heatmap.** Count and visualize how often you jump categories/
     contexts through the day to expose fragmentation. **From the doc:** "context
     switch heatmap"; "Logs and graphs:… context switches." **In COGS:** derive
     from ordered `timeLogs` + `Task.categories`/`context` in a new Analytics view;
     a companion to the doc's "week view shows 'effort heatmap'" idea.

### AJ. Operations, onboarding & data portability

276. **"Operation" item type (multi-step process with logged hours).** A first-class
     Operation that lives on a category list, bundles several tasks + goals + a
     status, and rolls up total hours logged. **From the doc:** "Task vs Operation:
     operation is an involved multistep process that involves several tasks… lives
     on category lists with tasks. Operation: … Total hours logged: X. Tasks: …
     Goals: … Status: …" **In COGS:** an `operation` `ItemTypeDefinition`
     (`lib/item-type-store.ts`) linking child tasks via `ItemLink`, with an hours
     rollup over `timeLogs`; closely related to projects (#9) and the §10
     objectives gap (cross-ref Batch B #201).

277. **Per-operation status review.** After working on an operation, run a review
     of its status (hours, progress, blockers) distinct from period reviews. **From
     the doc:** "after working on an operation review the status"; "Review after
     completing tasks." **In COGS:** an operation-scoped review type in
     `lib/reviews-store.ts` linked from the operation's detail view.

278. **Onboarding setup wizard / goal survey.** A first-run wizard that interviews
     the user about goals and scaffolds starter lists, categories, and a priority
     formula. **From the doc:** "Start: entry setup wizard ai survey to determine
     goals and get started"; "Interactive Tutorial: Walks user through: capture,
     clarify, graph, schedule, execute, review." **In COGS:** a `components/Onboarding/`
     flow seeding `task-store` categories + the #248 formula; survey logic stays
     local/classical (AI optional, last).

279. **Starter scenario templates (Academic Week / Product Launch / Creative
     Sprint).** One-click sample setups that scaffold lists, attributes, seed
     items, and a schedule for common life patterns. **From the doc:** "Sample Data
     & Templates: 'Academic Week,' 'Product Launch,' 'Creative Sprint,' etc." **In
     COGS:** add these to `lib/module-templates.ts` next to Itinerary / Cleaning /
     Budget; extends #125.

280. **Multi-format export: JSON + CSV + iCal.** Beyond JSON backup, export tabular
     list data as CSV and scheduled items as a standard calendar file. **From the
     doc:** "Export to CSV, PDF, or connect to Google Calendar"; "JSON Format…
     CSV Export… Calendar Integration: Export to standard calendar formats." **In
     COGS:** extend `lib/data/backup.ts` / `components/Settings/BackupRestore.tsx`
     with CSV (reuse `lib/csv.ts`) and an iCal serializer over `event-store` +
     scheduled `Task`s; builds on #150.

---

## Quick index by COGS area (where these would land)

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

---

*Total suggestions: **280** — the original 160 (mined from `Brain2Ideas (1).pdf`)
plus **120 added in Expansion II** (ideas 161–280), mined from a second batch of
documents: the two **Brain2** prototype docs (161–200), six **COGS**-titled docs
(201–240), and the long **"to-do list theory app"** doc (241–280). Each is
grounded in a specific passage of its source and mapped to a concrete place in the
current COGS data model or component tree, and honors the project's AI posture —
**self-hosted models only, implemented last**, with **semantic/vector search** and
**classical data-science / ML** fast-tracked instead. They are intentionally a mix
of near-term, concrete extensions and long-horizon, ambitious bets — a menu to
pull from, not a roadmap commitment.*
