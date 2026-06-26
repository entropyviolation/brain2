# Brain2 → COGS Feature Build Roadmap — Wave 2

This is the **execution roadmap + coordination contract** for the *second* wave of
Brain2 ideas: the **10 selected features plus 4 honorable mentions** (14 total). It
is the source of truth for parallel work: who owns which files, what types are
added upfront, and the final integration checklist. **If context is lost, re-read
this file to resume.**

> Status legend: ⬜ not started · 🟡 doing/partial · ✅ done
>
> **Wave 1 is already built** (see [`brain2_features_roadmap.md`](brain2_features_roadmap.md)):
> Gantt/CPM/dependency graph, plan-vs-reality, calibration, post-mortem, molecular
> + just-start, decision matrix, priority formula, beat-the-clock + streaks,
> knowledge-graph view, source/belief types, global search, JSON backup,
> needs-attention/zombie queue. **Wave 2 below deliberately does not overlap any of
> those.** Every Wave-2 feature was verified against the live repo as *not yet
> built* (see §2 grounding notes).

---

## 0. Operating rules (collision avoidance)

- **`lib/types.ts` is FROZEN to workers.** All shared type additions are made
  upfront by the coordinator (see §2). Workers MUST NOT edit `lib/types.ts`.
- **`lib/links.ts` relation catalog is coordinator-owned.** All new relation
  entries are added upfront (§2). Workers may **read** relations and call link
  helpers, but MUST NOT edit `lib/links.ts`.
- **`lib/item-types.ts` builtin registry + `lib/item-type-store.ts` are
  integration-owned.** Workers that introduce a new built-in item type ship it as
  a self-contained `lib/<x>-types.ts` module exporting a `getXTypeDefinition()` /
  `withXTypes()` helper (mirroring `lib/second-brain-types.ts`). The coordinator
  wires seeding during the integration pass.
- Each worker edits ONLY files in its **owned set** (§3). New files a worker
  creates live in its owned namespace.
- Workers may **call** any Zustand store action (e.g. `useTaskStore.getState().updateTask`)
  but may only **edit a store file** if they own it (see the store-ownership table
  in §3.0).
- Cross-cutting wiring into `app/page.tsx`, `components/Home/home-dashboard.tsx`,
  `components/Analytics/enhanced-analytics.tsx`, the `ItemDetailPage` panel shell,
  and the global header is reserved for the **final integration pass** (§5).
  Workers wire entry points only inside their OWNED surfaces.
- Each worker writes vitest tests for new pure helpers and runs targeted tests
  (`npm test -- <path>`). Do not run the full e2e suite.
- `vitest.setup.ts` is frozen.
- **User rule:** after the integration pass, update `docs/tree.txt` + `docs/tree.md`
  (run `scripts/update-tree.sh` if present).

---

## 1. The 14 features → worker map

**Selected 10:** — all ✅ (integrated)

| # | Feature | Idea(s) | Worker | Aim served | Status |
|---|---------|---------|--------|------------|--------|
| 1 | **Objectives layer** — `Objective` entity + Goal↔Objective↔Action links + direction-in-life report | #214/215/216/217/218/224 | **A** | Planning & reflection engine | ✅ |
| 2 | **Operation item type** — directed enterprises (phases, home/notes, log, to-do-next, resources, op post-mortem) | #201/202–213/276/277 | **B** | Custom-module platform / projects | ✅ |
| 3 | **Arbitrary self-tracking metrics** + trend/correlation/context-switch analytics (classical, no LLM) | #137/138/140/275 | **C** | Self-tracking & analytics instrument | ✅ |
| 4 | **Document-type items** — rich-text `Item.body` + `note` type + editor | #184/#84 | **D** | Second brain | ✅ |
| 5 | **Computed / formula attributes** in the grid | #149 | **E** | Custom-module platform / spreadsheets | ✅ |
| 6 | **Kanban board display** — Lists mode + Module view kind | #20 | **F** | Externalize everything / modules | ✅ |
| 7 | **Regret accrual** ledger | #41 | **G** | Planning & reflection (control loop) | ✅ |
| 8 | **Nested categories + sublists** (`parentCategoryId`) | #148/#232 | **H** | Dense interconnected structure | ✅ |
| 9 | **Richer completion status** (done/partial/deferred/cancelled) | #266 | **I** | Everything reviewable | ✅ |
| 10 | **Smart-parse capture** (classical date/time/category) + global capture hotkey | #242/#241 | **J** | Capture-first / externalize everything | ✅ |

**Honorable mentions (folded into nearby workers):** — all ✅

| HM | Feature | Idea | Worker | Status |
|----|---------|------|--------|--------|
| HM1 | **Event-linked "must-be-done-before" checklist** | #227 | **K** | ✅ |
| HM2 | **Morning review ritual** | #265 | **G** | ✅ |
| HM3 | **Structured "why blocked/skipped" reasons** | #267 | **G** | ✅ |
| HM4 | **Per-category JSON export/import** | #233 | **H** | ✅ |

11 workers (A–K), all launchable in parallel. Dependencies are minimal and listed
in §4.

---

## 2. Type & relation contract (added upfront by the coordinator)

All additions are **additive/optional** so existing data + literals still compile.
Grounding notes record what was verified in the live repo on 2026-06-23.

### 2.1 `lib/types.ts` additions

**Feature 1 — Objectives (Worker A)**
- Add `export type ObjectivePeriod = "week" | "month" | "quarter" | "year" | "custom-range"`.
- Add `export interface Objective { id; title; description?; period: ObjectivePeriod; periodKey?: string; startDate?: Date; endDate?: Date; type: "count" | "numerical" | "boolean"; target: number; current: number; track?: number; parentObjectiveId?: string; goalIds?: string[]; stake?: string; completed: boolean; createdAt: Date }`.
  *(track = expected pace fraction; doc example "completion 13/36, track 12/18".)*
- Extend `Goal` (≈L528): add `parentGoalId?: string`, `why?: string[]` (reason stack), `entropyViolation?: string`.
  *Grounding: `Goal` is flat today (≈L528–541); no `Objective` exists.*

**Feature 4 — Document items (Worker D)**
- Add `Item.body?: string` to `interface Item` (≈L176).
- Extend `ItemDetailPanel` (≈L526) → add `"body"`: `"details" | "scheduling" | "dependencies" | "subtasks" | "analysis" | "time" | "body"`.
  *Grounding: `Item` (≈L176) has tags/links/attributes but no `body`.*

**Feature 5 — Formula attributes (Worker E)**
- Extend `AttributeType` (≈L322) → add `"formula"`.
- Extend `AttributeDefinition` (≈L339) → add `formula?: string` (the expression, e.g. `"=price*qty"`) and optional `formatAs?: "number" | "currency" | "percent"`.
  *Grounding: union ends at `"goal"` (L335); no formula field.*

**Feature 8 — Nested categories (Worker H)**
- Add `TaskCategory.parentCategoryId?: string` (≈L502).
  *Grounding: `TaskCategory` (L502–524) has no parent field; only folders nest today (SPEC §6.2 gap).*

**Feature 9 — Completion status (Worker I)**
- Add `export type CompletionStatus = "active" | "done" | "partial" | "deferred" | "cancelled"`.
- Add `Task.status?: CompletionStatus`. **Invariant:** `status === "done"` ⇔ `completed === true`; helpers in `lib/completion-status.ts` keep them in sync.
  *Grounding: `allowPartialCompletion`/`completedChunks` exist for "partial" but there is no status enum.*

**HM2/HM3 — Reviews (Worker G)**
- Extend `PeriodReview` (≈L598): add `morning?: { wakeTime?: string; dream?: string; intentions?: string[]; affirmations?: string[]; postponedTaskIds?: string[] }`, `blockedReasons?: Record<string /*taskId*/, BlockedReason>`, and `spawnedItemIds?: string[]`.
- Add `export type BlockedReason = "no-energy" | "missing-input" | "procrastination" | "no-time" | "blocked-by-other" | "other"`.

> **No type change needed** for: HM1 (`schedulingConstraints.mustBeDoneBefore?: Date`
> already exists at types.ts ≈L280, and is in the task-store sanitizer at
> `lib/task-store.ts:36`), Feature 3 metrics (types live in the worker-owned
> `lib/metrics-store.ts`), Feature 6 kanban (lives in worker-owned
> `lib/modules-store.ts` + `lib/lists-ui-store.ts`), Feature 7 regret
> (worker-owned `lib/regret-store.ts`).

### 2.2 `lib/links.ts` relation catalog additions (coordinator, upfront)

Append to `RELATIONS` (≈L26). Existing entries already include `goal-of`/`action-of`
(L38–39), `checklist-of`/`has-checklist` (L40–41), `reviews`/`reviewed-by`
(L36–37) — **do not re-add those.** Add only:

```
{ id: "objective-of",  label: "objective of",  inverse: "has-objective", inverseLabel: "has objective" },
{ id: "has-objective", label: "has objective", inverse: "objective-of",  inverseLabel: "objective of" },
{ id: "subgoal-of",    label: "subgoal of",    inverse: "has-subgoal",   inverseLabel: "has subgoal" },
{ id: "has-subgoal",   label: "has subgoal",   inverse: "subgoal-of",    inverseLabel: "subgoal of" },
{ id: "part-of",       label: "part of",       inverse: "has-part",      inverseLabel: "has part" },
{ id: "has-part",      label: "has part",      inverse: "part-of",       inverseLabel: "part of" },
{ id: "phase-of",      label: "phase of",      inverse: "has-phase",     inverseLabel: "has phase" },
{ id: "has-phase",     label: "has phase",     inverse: "phase-of",      inverseLabel: "phase of" },
{ id: "resource-of",   label: "resource of",   inverse: "has-resource",  inverseLabel: "has resource" },
{ id: "has-resource",  label: "has resource",  inverse: "resource-of",   inverseLabel: "resource of" },
```

Usage: A uses `objective-of`/`action-of`/`subgoal-of`; B uses `part-of`/`phase-of`/`resource-of`;
K uses the existing `checklist-of`.

---

## 3. Ownership matrix (STRICT — disjoint)

### 3.0 Store ownership (one editor each)

| Store file | Sole editor | Everyone else |
|------------|-------------|---------------|
| `lib/goals-store.ts` | **A** | call actions only |
| `lib/task-store.ts` | **H** | call `updateTask`/`addTask`/`completeTask` only |
| `lib/reviews-store.ts` | **G** | call actions only |
| `lib/modules-store.ts` | **F** | read only |
| `lib/lists-ui-store.ts` | **F** | read only |
| `lib/metrics-store.ts` *(new)* | **C** | — |
| `lib/regret-store.ts` *(new)* | **G** | — |
| `lib/item-type-store.ts` / `lib/item-types.ts` | **integration** | ship `*-types.ts` modules |
| `lib/points-store.ts`, `lib/time-tracking-store.ts`, `lib/event-store.ts` | **nobody** (read only) | — |

---

### Worker A — Goals & Objectives (Feature 1)
**New files:** `lib/objectives.ts`(+`.test.ts`) — pure helpers: progress/track
rollups, multi-horizon parent aggregation, "direction in life" coverage (goals
with no recent linked action; days whose tasks served no goal).
`components/Home/Goals/ObjectivesPanel.tsx`, `components/Home/Goals/DirectionReport.tsx`.
**Edits (exclusive):** `lib/goals-store.ts` (Objective CRUD + `objectives` slice),
`components/Home/Goals/goals-tracker.tsx` (mount Objectives + reason-stack "why" +
`entropyViolation` field; subgoal nesting UI), `components/Home/Goals/README.md`.
**Reads:** `lib/links.ts` (`objective-of`/`action-of`/`subgoal-of`), `task-store`
(completions, read-only). Coverage is **recomputed on read** from links — do NOT
hook the hot `completeTask` path (that's H's file).
**Must NOT touch:** types.ts, links.ts, task-store.ts, Analytics shell, Operations.
**Self-mount:** A owns the Goals tab content, so Objectives/DirectionReport mount
themselves there; no app-shell wiring needed.

### Worker B — Operations / directed enterprises (Feature 2)
**New files:** `lib/operation-types.ts` (`operation` `ItemTypeDefinition` +
`withOperationType()`), `lib/operations.ts`(+`.test.ts`) — hours rollup over
`Task.timeLogs`, phase-completion evaluation, work/neglect heatmap data, "to do
next" selector. `components/Operations/*` (new folder): `OperationWorkspace.tsx`,
`OperationHome.tsx` (notes pad + heatmap), `PhasesPanel.tsx`, `ToDoNextRail.tsx`,
`ResourcesPanel.tsx`, `OperationLogFeed.tsx`, `README.md`.
**Edits (exclusive):** everything under `components/Operations/`.
**Calls (no edit):** `useReviewStore` operation-review action (added by **G**);
`useTaskStore.updateTask` to set links/timeLogs; `useItemTypeStore` (seeding wired
at integration).
**Must NOT touch:** types.ts, links.ts, item-types.ts/item-type-store.ts,
reviews-store.ts, task-store.ts.
**Exports for integration:** `withOperationType()` (register built-in type);
`OperationWorkspace` (mounted by a top-level Operations entry or from a list item);
an `upgradeTaskToOperation(taskId)` helper the coordinator wires into the item
detail "⋯" menu.

### Worker C — Self-tracking metrics & analytics (Feature 3)
**New files:** `lib/metrics-store.ts`(+`.test.ts`) — `MetricDefinition` +
`MetricEntry` value series (its own persisted store, like `modules-store`);
`lib/metrics.ts`(+`.test.ts`) — classical trend (rolling slope), correlation
(Pearson over aligned series), change-point detection, context-switch counts (all
pure, no LLM). `components/Tracking/MetricLogger.tsx`,
`components/Analytics/MetricsTrends.tsx`, `components/Analytics/CorrelationExplorer.tsx`,
`components/Analytics/ContextSwitchHeatmap.tsx`.
**Must NOT touch:** types.ts, `enhanced-analytics.tsx` (coordinator mounts the
three views), `time-tracking-store.ts` (read context-switch data via its actions).
**Exports for integration:** the three Analytics view components (self-contained,
read stores themselves) + a header/Tracking entry for `MetricLogger`.

### Worker D — Document-type items / rich notes (Feature 4)
**New files:** `lib/note-types.ts` (`note` `ItemTypeDefinition` + `withNoteType()`),
`components/Editor/RichTextEditor.tsx` (+ `Editor/editor.css`, `Editor/README.md`) —
dependency-light contentEditable/markdown editor honoring the Win95 skin,
`components/ItemDetail/BodyPanel.tsx` (reads/writes `Item.body` via `updateTask`).
**Must NOT touch:** types.ts, `ItemDetailPage.tsx` shell (coordinator registers the
`"body"` panel), item-types registry (ship `withNoteType()`), legacy
`task-detail-popup.tsx`/`enhanced-task-detail.tsx` (Worker I owns those).
**Exports for integration:** `withNoteType()`; `BodyPanel` (coordinator adds
`"body"` to the relevant `ItemTypeDefinition.detailPanels` / `TaskCategory.detailPanels`).

### Worker E — Computed / formula attributes (Feature 5)
**New files:** `lib/formula.ts`(+`.test.ts`) — a small, safe spreadsheet-style
expression evaluator (cell refs by attribute id, `+ - * / ( )`, `SUM/AVG/MIN/MAX`,
no `eval`).
**Edits (exclusive):** `components/spreadsheet/SheetGrid.tsx` (render computed
cells, recompute on dependency change), `lib/spreadsheet-utils.ts` (formula-aware
rollups), `components/Lists/attributes/AttributeSchemaEditor.tsx` +
`components/Lists/attributes/AttributeValueField.tsx` (the `"formula"` attribute
type: expression input + read-only computed display), `components/Lists/attributes/helpers.ts`.
**Must NOT touch:** types.ts, modules-store.ts, `module-view-bodies.tsx`,
`ListContentPanel.tsx` (F owns the display switcher).
**Exports for integration:** none (formulas appear wherever attributes render).

### Worker F — Kanban board display (Feature 6)
**New files:** `components/Lists/list-content/ListContentKanban.tsx`,
`components/Modules/workspace/kanban-view-body.tsx` (or a case in
`module-view-bodies.tsx` — F owns that file), `components/Lists/list-content/kanban.README.md`.
**Edits (exclusive):** `lib/modules-store.ts` (add `"kanban"` to `ModuleViewKind`
(≈L34) + `statusAttrId` to `ModuleViewConfig`), `components/Modules/workspace/module-view-bodies.tsx`
+ `ModuleViewEditor.tsx` (kanban body + editor config), `lib/lists-ui-store.ts`
(add `"kanban"` display mode + per-list `kanbanStatusAttrId`),
`components/Lists/list-content/ListContentPanel.tsx` (switch case),
`components/Lists/toolbar/ViewModeControls.tsx` (add the mode button).
**Must NOT touch:** types.ts, SheetGrid / spreadsheet-utils / Lists/attributes/* (E owns).
**Self-contained:** appears as a Lists display mode + a Module view kind.

### Worker G — Reviews & Regret (Feature 7 + HM2 + HM3)
**New files:** `lib/regret-store.ts`(+`.test.ts`) — regret ledger (accrues cost of
not-done important/overdue items, parallel to points-store; day/week/month totals),
`components/Analytics/RegretView.tsx`, `components/Reviews/MorningReview.tsx`.
**Edits (exclusive):** `lib/reviews-store.ts` (morning-review variant; `blockedReasons`
capture; `spawnedItemIds`; **operation-review** action for Worker B; carry-over may
reuse existing `lib/services/review-service.ts:carryOverIncomplete`),
`components/Reviews/reviews.tsx` (morning ritual entry + why-blocked prompts in the
carry-over step), `components/Reviews/README.md`.
**Must NOT touch:** types.ts, task-store.ts, points-store.ts, ToDo, Analytics shell.
**Exports for integration:** `RegretView` (mounted in `enhanced-analytics.tsx`);
morning review entry surfaced from the Review header/Home banner.

### Worker H — Lists structure: nested categories + sublists + per-category export (Feature 8 + HM4)
**Edits (exclusive):** `lib/task-store.ts` (category `parentCategoryId`, `moveCategory`,
descendant queries; keep `updateTask`/`addTask`/`completeTask` signatures stable —
other workers call them), `components/Lists/navigation/FolderTree.tsx` +
`BreadcrumbNav.tsx` (render nesting), `components/Lists/settings-dialog.tsx`
(per-category Export/Import JSON), `lib/data/backup.ts` (add `exportCategory()` /
`importCategory()` serializers), `lib/folder-all-items.ts` (respect nesting).
**New files:** `lib/category-tree.ts`(+`.test.ts`) — pure ancestor/descendant/move-cycle helpers.
**Must NOT touch:** types.ts, lists-ui-store.ts (F owns), ListContentPanel.tsx (F owns).
**Exports for integration:** none (self-contained inside Lists).
**⚠ Hot file:** H is the **sole** editor of `task-store.ts`; coordinate the
`Task.status` field plumbing with Worker I via the `updateTask` action (no
duplicate edits — the field is added in types.ts by the coordinator; I only reads/
writes it through `updateTask`).

### Worker I — Richer completion status (Feature 9)
**New files:** `lib/completion-status.ts`(+`.test.ts`) — status ↔ `completed`
sync, status transitions, filter predicates (e.g. "active & available").
**Edits (exclusive):** `components/Home/ToDo/*` (status control + status filters +
status column), `components/task-detail-popup.tsx`, `components/enhanced-task-detail.tsx`
(status selector in the analysis/details area).
**Calls (no edit):** `useTaskStore.updateTask` to persist `status`.
**Must NOT touch:** types.ts, task-store.ts (call `updateTask`), reviews-store.ts,
`ItemDetail/ItemDetailPage.tsx` shell (Worker D + integration).
**Exports for integration:** none (status surfaces inside owned components).
**⚠ Watch:** D edits the new `ItemDetail/BodyPanel.tsx`; I edits the legacy
`task-detail-popup.tsx`/`enhanced-task-detail.tsx`. Disjoint files, but verify the
status selector lands in the legacy popups only.

### Worker J — Capture: smart-parse + global hotkey (Feature 10)
**New files:** `lib/smart-parse.ts`(+`.test.ts`) — pure classical parser
(regex + `date-fns`) extracting dates/times and `Category:` hints; returns
highlights + a structured suggestion (no LLM). `hooks/useQuickCaptureHotkey.ts`.
**Edits (exclusive):** `components/quick-add.tsx`, `components/enhanced-bulk-add.tsx`
(already does colon-categories — route through the parser), `components/inbox.tsx`
(show parsed chips during clarify).
**Must NOT touch:** types.ts, `components/Search/*` (search hotkey is Wave-1),
`app/page.tsx`/`electron/main.js` (coordinator wires the global shortcut + Electron
`globalShortcut` at integration).
**Exports for integration:** `useQuickCaptureHotkey()` (registered in `app/page.tsx`)
and an Electron `globalShortcut` request handled in the integration pass.

### Worker K — Event-linked "must-be-done-before" checklist (HM1)
**New files:** `lib/event-links.ts`(+`.test.ts`) — derive each linked task's
`schedulingConstraints.mustBeDoneBefore` from `CalendarEvent.date`; list a
checklist's items + completion for an event.
**Edits (exclusive):** `components/Home/Plan/event-dialog.tsx` (attach/detach a
prerequisite checklist via the existing `checklist-of` relation),
`components/Home/Plan/agenda-grid.tsx` (render the "must be done before <date>"
badge + multi-day/all-day banner rows using existing `CalendarEvent.isAllDay`/`endDate`).
**Calls (no edit):** `useTaskStore.updateTask` (write the derived constraint +
link), `useEventStore` (read).
**Must NOT touch:** types.ts, links.ts (`checklist-of` already exists),
event-store.ts core (read only), Scheduler files owned elsewhere.
**Exports for integration:** none (self-contained inside Plan).

---

## 4. Cross-worker dependencies (intentional, minimal)

- **B → G:** operation post-mortem (#277) persists via a `reviews-store` action
  that **G** adds; **B** calls it. G must expose it before B's integration.
- **B, D → integration:** new built-in types (`operation`, `note`) are registered
  by the coordinator via `withOperationType()` / `withNoteType()` in the integration
  pass (workers ship the helper, don't edit the registry).
- **A → coordinator:** `objective-of`/`action-of`/`subgoal-of` relations come from
  §2.2 (links.ts). A only reads them.
- **I ↔ H:** `Task.status` is added to types.ts by the coordinator; **H** owns
  task-store.ts but does **not** add status logic — **I** reads/writes `status`
  through the existing `updateTask` action. No duplicate store edits.
- **C, G → integration:** `MetricsTrends`/`CorrelationExplorer`/`ContextSwitchHeatmap`
  (C) and `RegretView` (G) are self-contained components mounted into
  `enhanced-analytics.tsx` by the coordinator.
- **E ⟂ F:** formulas (E: SheetGrid + attributes) and kanban (F: ListContentPanel +
  modules) touch disjoint files; both read attribute values, neither edits the
  other's surfaces.
- **J → integration:** global capture hotkey wiring in `app/page.tsx` +
  `electron/main.js` is integration-only (avoids the reserved hot files).

---

## 5. Final integration pass (coordinator / Worker L — runs AFTER A–K)

Reserved hot files: `lib/types.ts`, `lib/links.ts`, `lib/item-types.ts`,
`lib/item-type-store.ts`, `app/page.tsx`, `components/Home/home-dashboard.tsx`,
`components/Analytics/enhanced-analytics.tsx`, `components/ItemDetail/ItemDetailPage.tsx`,
`electron/main.js`, the global header.

Checklist:
- ✅ Apply the §2 type + relation contract to `lib/types.ts` + `lib/links.ts` (do this **first**, before launching workers).
- ✅ Register built-in types: call `withOperationType()` (B) and `withNoteType()` (D) in `lib/item-types.ts` / seed via `item-type-store`.
- ✅ Add the `"body"` panel (D) to the relevant `detailPanels` and route it in `ItemDetailPage.tsx` (+ `ItemDetailPopup.tsx`).
- ✅ Add an **Operations** entry point (top-level tab `OperationsView` → `OperationWorkspace`); wire `upgradeTaskToOperation` into the item "⋯" menu.
- ✅ Mount **Objectives** + **DirectionReport** (A) — A self-mounts in the Goals tab; verified.
- ✅ Mount Analytics views: `MetricsTrends`, `CorrelationExplorer`, `ContextSwitchHeatmap` (C), `RegretView` (G) as tabs in `enhanced-analytics.tsx`.
- ✅ Surface `MetricLogger` (C) from the header (`MetricLoggerButton`); **MorningReview** (G) already surfaced from the Review header (no duplication).
- ✅ Register the global capture hotkey: `useQuickCaptureHotkey()` in `app/page.tsx` + an Electron `globalShortcut` (J) (main.js + preload bridge).
- ✅ Verify Kanban (F) appears as a Lists display mode + a Module view kind; formula attributes (E) compute in grids + summary rollups. (compiles + tests pass)
- ✅ Verify event-linked checklists + multi-day banners (K) render in Plan. (compiles + tests pass)
- ✅ `npm run build` + `npm test` green; fixed integration/type errors. No
  `ItemDetailPopup.tsx` type error remained.
- ✅ Update `docs/tree.txt` + `docs/tree.md` (user rule) via `scripts/update-tree.sh`.
- ✅ Update `docs/SPEC_MAPPING.md` status markers: §10 (Objectives), §6.2 (nested
  categories), §7.5 (event checklist), §13 (morning review / blocked reasons),
  §14.4 (regret), §15 (metrics/correlation/context-switch), long-term
  (document-type items, formula attributes).
- ✅ Flip statuses in §1/§6 to ✅.

---

## 6. Progress log (append as workers report)

- (init) Wave-2 roadmap created. 11 workers (A–K) defined with disjoint ownership;
  §2 type/relation contract drafted and grounded against the live repo
  (2026-06-23). Coordinator to apply §2, then launch A–K in parallel; integration
  pass (§5) runs last.
- (integration, Worker L, 2026-06-23) §5 final integration pass complete. All 14
  features wired and verified green. Edits:
  - `lib/item-types.ts` — `getBuiltinItemTypes()` now composes `withOperationType()`
    (B) + `withNoteType()` (D) over the base task type (idempotent built-in seeding).
  - `components/ItemDetail/ItemDetailPage.tsx` — `"body"` tab (D) for `note` items /
    lists with `detailPanels` including `"body"`; item "⋯" overflow menu →
    `upgradeTaskToOperation` (B).
  - `components/ItemDetail/ItemDetailPopup.tsx` — `"body"` tab wired into
    `visiblePanels` + `BodyPanel` content.
  - `components/Operations/OperationsView.tsx` (new) — top-level Operations surface
    listing operation items → mounts `OperationWorkspace`; create-operation inline.
  - `app/page.tsx` — **Operations** tab (lazy `OperationsView`); header **Metrics**
    button (`MetricLoggerButton`, C); global capture hotkey `useQuickCaptureHotkey()`
    driving a controlled `<QuickAdd>` (J).
  - `lib/app-navigation.ts` — added `"operations"` to `APP_TABS`.
  - `components/Analytics/enhanced-analytics.tsx` — added `metrics` / `correlation` /
    `context-switch` (C) + `regret` (G) tabs.
  - `electron/main.js` + `electron/preload.js` — `globalShortcut` registration for
    `CommandOrControl+Alt+Space` → focus window + IPC `quick-capture:open`; preload
    exposes `window.electron.onQuickCapture(cb)` (J).
  - MorningReview (G) confirmed already surfaced from the Review header (no dup).
  - Verified (compile + tests): Kanban (F), formula attributes (E), event-linked
    checklists + multi-day banners (K), nested categories (H), completion status (I).
  - Fixed one Wave-2 regression: `goals-tracker.test.tsx` asserted a single
    "Read 3 books", now ambiguous because `DirectionReport` (A) surfaces the same
    goal title; relaxed to `getAllByText(...).length > 0`.
  - Results: `npm run build` ✅; `tsc --noEmit` ✅; `npm test` ✅ 750/750 (99 files).
  - Docs: regenerated `docs/tree.txt`; updated `docs/tree.md` (App map + spec gaps)
    and `docs/SPEC_MAPPING.md` (§6.2, §7.5, §10, §13, §14.4, §15, long-term).
