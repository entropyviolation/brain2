# Brain2 → COGS Feature Build Roadmap

Execution roadmap + coordination contract for the 10 selected Brain2 ideas plus
3 honorable mentions. **STATUS: ALL COMPLETE** — `tsc` clean, 489 tests pass,
production build succeeds.

> Built in parallel by 5 disjoint workers (A–E) coordinated to avoid file
> collisions, then a coordinator integration pass wired the app shell.

---

## 0. Operating rules (collision avoidance — used during the build)

- `lib/types.ts` was FROZEN to workers; all shared type additions were made
  upfront by the coordinator (§2). No worker edited it.
- Each worker edited ONLY files in its owned set (§3). Stores could be **called**
  but only **edited** by their owner.
- Cross-cutting wiring (`app/page.tsx`, `home-dashboard.tsx`, header) was reserved
  for the final integration pass (§5).

---

## 1. The 13 features — all ✅

| # | Feature | Brain2 idea | Owner |
|---|---------|-------------|-------|
| 1 | Gantt + Critical Path + dependency graph | #14/#15/#19 | C |
| 2 | Plan-vs-reality dashboard | #33 | B |
| 3 | Estimate-vs-actual calibration | #26/#29 | B |
| 4 | Task post-mortem | #40 | B |
| 5 | Molecular breakdown + "Just Start" focus mode | #1/#59/#128 | A |
| 6 | Decision matrix module | #51 | D |
| 7 | Entropy-aware prioritization + transparent priority formula | #42/#46 | A |
| 8 | Beat-the-clock standard time (8a) + streaks (8b) | #28/#144 | A / B |
| 9 | Typed-links knowledge graph view | Q/#109 | C |
| 10 | Source / Belief knowledge-graph item types | #55/#66/#67/#68 | E |
| HM1 | "Search your brain" command palette (Cmd/Ctrl-K) | #122 | shell (pre-wired) |
| HM2 | JSON export/import + snapshots | #150 | integration (Settings) |
| HM3 | Needs-Attention queue | #34 | shell (pre-wired) |

---

## 2. Type contract (added upfront to `lib/types.ts`)

- `LinkStance = "strong-support"|"weak-support"|"none"|"weak-refute"|"strong-refute"`;
  `ItemLink.stance?`, `ItemLink.weight?`.
- `Subtask { id; description; completed; isMolecular?; context? }`; `Task.subtasks?: Subtask[]`.
- `Task.isSummary?`, `Task.parallelGroup?`, `Task.riskFlag?`,
  `Task.pertEstimate?: {optimistic;likely;pessimistic}`, `Task.definitionOfDone?`,
  `Task.completionReview?: TaskCompletionReview`.
- `PriorityWeights { urgency; importance; cognitiveLoad; entropy }`.

---

## 3. What each worker shipped

### Worker A — Daily Execution Loop (5, 7, 8a)
- NEW: `lib/molecular.ts`(+test), `lib/priority.ts`(+test),
  `components/Focus/JustStartMode.tsx` (+README), `lib/item-utils.test.ts`.
- EDIT: `lib/item-utils.ts` (`beatTheClockMultiplier` → +20% under-estimate bonus),
  `lib/task-store.ts` (persisted `priorityWeights`), `components/Home/ToDo/*`
  (Tier/Priority sort toggle + reweight panel + per-row ⚡ Just-Start), molecular
  breakdown card in `components/ItemDetail/ItemDetailPage.tsx`.
- Priority: each signal normalized 0–1, weighted sum; cognitiveLoad inverted
  (low-load quick wins rank up); entropy surfaces vague tasks. 45 tests.

### Worker B — Analytics & Reflection (2, 3, 4, 8b)
- NEW: `lib/plan-vs-reality.ts`, `lib/calibration.ts`, `lib/streaks.ts` (+tests),
  `components/Analytics/{PlanVsReality,CalibrationView,StreaksWidget}.tsx`,
  `components/Reviews/PostMortemDialog.tsx`.
- EDIT: `components/Analytics/enhanced-analytics.tsx` (Plan vs Reality / Calibration
  / Streaks / Reflection tabs), `components/Reviews/reviews.tsx` ("Reflect"
  affordance), `lib/services/completion-service.ts` (`saveCompletionReview`).
- Variance score 0–100 (tasks 0.5 / time 0.3 / points 0.2); calibration median-bias
  insight; streaks current+longest with one-period grace. 40 tests.

### Worker C — Project Visualization (1, 9)
- NEW: `lib/critical-path.ts`(+test, CPM+PERT), `lib/graph-layout.ts`(+test),
  `components/Scheduler/{GanttView,DependencyGraph,project-network}.tsx`,
  `components/Graph/KnowledgeGraph.tsx` (+README).
- EDIT: `components/Scheduler/enhanced-scheduler.tsx` (Funnel/Gantt/Dependencies
  switcher). CPM: PERT expected duration, Kahn topo-sort, forward/backward pass,
  zero-slack critical path. 33 tests.

### Worker D — Decision Matrix Module (6)
- NEW: `lib/decision-matrix.ts`(+test, 13 tests).
- EDIT: `lib/modules-store.ts` (`"decision-matrix"` view kind + `DecisionCriterion`),
  `components/Modules/workspace/{module-view-bodies,ModuleViewEditor}.tsx`.
  Rows = options, columns = weighted numeric-attribute criteria; min–max normalized
  weighted score, ranked, winner highlighted, live weight sliders.

### Worker E — Second Brain: Sources & Beliefs (10)
- NEW: `lib/second-brain-types.ts` (Source/Belief `ItemTypeDefinition` + seed helper),
  `lib/belief-strength.ts`(+tests, 47 tests).
- EDIT: `lib/links.ts` (added `refutes`/`refuted-by` + stance helpers, no signature
  changes), `lib/item-type-store.ts` (`seedSecondBrainTypes()`).
  Belief strength = trust-weighted support-vs-refute, normalized 0–1 (0.5 = neutral).

---

## 4. Integration pass (coordinator) — ✅

- Top-level **Graph** tab in `app/page.tsx` + `lib/app-navigation.ts`
  (`APP_TABS` → 6, grid-cols-6), lazy-mounts `<KnowledgeGraph />`.
- `components/Settings/SettingsDialog.tsx` (header **Settings** button) hosts
  `BackupRestore` (HM2) + "Set up Second Brain" (`seedSecondBrainTypes`).
- HM1 GlobalSearch + Cmd/Ctrl-K: already wired in `app/page.tsx` (verified).
- HM3 NeedsAttention: already mounted in `home-dashboard.tsx` (verified).
- Verification: `npx tsc --noEmit` clean · `npm test` 489 passed / 85 files ·
  `npm run build` static export succeeds.
- `docs/tree.txt` regenerated; `docs/tree.md` annotated (Graph/Settings/Focus,
  decision-matrix, Brain2 analytics tabs, post-mortems).

---

## 5. Where to find each feature in the running app

- **Graph tab** → knowledge graph of all items + typed links.
- **Scheduler → Gantt / Dependencies** sub-views (critical path highlighted).
- **Home → To Do** → Priority sort toggle + reweight panel + ⚡ Just Start.
- **Item detail → Subtasks** → Molecular breakdown (split / context / atomic).
- **Analytics → Plan vs Reality / Calibration / Streaks / Reflection**.
- **Modules** → add a workspace view of kind **Decision Matrix**.
- **Header → Settings** → Backup/Restore + Set up Second Brain (Source/Belief types).
- **Header → 🔍 / Cmd-K** → global search. **Home → Needs Attention** card.
