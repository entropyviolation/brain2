# `lib/` — Data model, state stores, and pure helpers

Everything that is **not** React UI: the TypeScript data model, Zustand stores
(persisted to localStorage — the offline-first source of truth; see
`docs/SPEC_MAPPING.md` §3 and [`docs/ROADMAP.md`](../docs/ROADMAP.md) for the
planned opportunistic **MongoDB Atlas** sync target — flexible documents,
semantic/fuzzy/advanced search, and aggregation-based routing), and pure
calculation/date/sync utilities.

> **Future direction — shared `@cogs/core`.** Most of this folder (the data model
> in `types.ts`, Zod schemas in `data/schemas.ts`, the `DataSource` interface,
> domain `services/`, and pure logic like `search`, `needs-attention`, `links`,
> `link-graph`, and scheduling) is slated for extraction into a shared
> **`@cogs/core`** package so web, desktop, and a future **mobile** (Expo / React
> Native) app consume one source of truth. The `DataSource`/repository seam is the
> **transport-agnostic boundary** that makes offline-first + opportunistic cloud
> sync (and the mobile client) possible. Full plan: [`docs/ROADMAP.md`](../docs/ROADMAP.md).

## Zustand stores

| File | localStorage key | Purpose | Spec |
|------|------------------|---------|------|
| `task-store.ts` | `cogs-task-storage` | Tasks, categories, folders — the Inbox / Lists / Scheduler source of truth. Date-aware serialization, versioned migrations, `calculatePriorityScore`. | §4, §5, §6, §7 |
| `event-store.ts` | `cogs-event-storage` | Calendar `CalendarEvent`s. Seeded with demo events. | §7.5 |
| `habits-store.ts` | `cogs-habits-store` | Habit definitions (`WeeklyTask`), per-day completion data (`WeeklyData`), habit categories. Shared by Home Habits and Lists Daily Habits. One-time import from legacy `weekly-habits-*` keys. | §9 |
| `goals-store.ts` | `cogs-goals-store` | All-time **Objectives** (prioritizable per period with custom point multipliers; written period reviews) + quantifiable **Goals** that serve them. Seeds 26 default objectives + example goals (persist v3). Exports the multiplier helpers `objectiveMultiplierFor`/`taskObjectiveMultiplier` + `DEFAULT_OBJECTIVE_MULTIPLIER` (1.5×). | §10 |
| `points-store.ts` | `points-store` | Points ledger (`PointsEntry[]`), day/week/month totals, possible-points projections. | §14 |
| `time-tracking-store.ts` | `cogs-timegrid-store` | TimeGrid scopes, pens, and logged intervals (Activity / Location / Mood). | §12 |
| `reviews-store.ts` | `cogs-reviews-store` | Period reviews (day/week/month/quarter/year) plus helpers for period keys, previous/next period, and carry-over prompts. | §13 |
| `modules-store.ts` | `cogs-modules-store` | User-composed Modules: dashboard **widgets** (`{ id, type, title, config }`) and full-screen **workspaces** (`kind: "workspace"` + bound `views[]`, `planSync`, `enablePrint`). | §8 |
| `item-type-store.ts` | `cogs-item-types-store` | Registry of **item types** (`ItemTypeDefinition`): built-in `task` plus user-defined types (Book, Friend, …). Built-ins re-seeded on load and undeletable. | §5 |
| `lists-ui-store.ts` | `cogs-lists-ui` | Lists UI prefs: folder view mode, icon positions, orb gallery (hidden orbs, edit mode), auto-organize grid, uncategorized filter on All Items. | §6 |
| `metrics-store.ts` | `cogs-metrics-store` | Custom self-tracking metrics: `MetricDefinition`s (name, unit, `MetricKind`, target/bounds, color) + dated `MetricEntry` readings. Types are local (not in `types.ts`) so the feature stays self-contained. Backs Metrics analytics + `MetricLogger`. | §137/§138/§275 |
| `regret-store.ts` | `regret-store` | Append-only `RegretEntry[]` ledger mirroring `points-store` for the *opposite* signal — the accruing cost of not doing important/overdue items. Pure accrual math (`regretCost`/`dailyRegretIncrement`/`projectedRegret`) is exported; daily accrual is idempotent per task per day. | §14 |
| `theme-store.ts` | `cogs-theme-store` | User-customizable theme colors (points card, habit-type icons). | — |

## Pure helpers (no store)

| File | Purpose | Spec |
|------|---------|------|
| `types.ts` | Shared interfaces/enums: `Task`, `TodoItem`, `CalendarEvent`, `TaskCategory`, `CategoryFolder`, habits (`WeeklyTask`/`TaskType`/`WeeklyData`), scheduling, reviews, modules, attributes. Convergence target for the unified Item model (§5). | §5 |
| `calculations.ts` | Habit completion math: `calculateTaskPercentage`, `calculateDayPercentage`, `calculateDayPercentageAV` for all five habit types. | §9 |
| `date-utils.ts` | App-wide date helpers: `formatDateKey`, `formatLocalDateKey`, week/month/year keys, `getWeekStartDate`, `getWeekString`/`parseWeekString`, range formatting, `isToday`, safe date guards. | §7, §9 |
| `item-utils.ts` | Task/list helpers: schedule-level predicates, `createListItem` / `createNextActionItem`, attribute seeding, `resolveCompletionPoints` (default 1 or list **Points** attribute), singular labels, push-forward. | §5, §6, §7 |
| `item-types.ts` | Item-type helpers: built-in `task` definition, `getItemType`, `resolveAttributes`/`resolveDefaultValues` (compose type + category schemas), and serializable rule evaluation (`evaluateCondition`, `applyRulesFor`, `validateItem`). | §5 |
| `migrations.ts` | Versioned data migrations for the unified Item model — backfills `type`/`title`/`tags`/`links` onto persisted tasks (does not touch `category`/`categories`). | §5 |
| `completion-status.ts` | Keeps the legacy boolean `completed` and the richer `CompletionStatus` (active/partial/deferred/cancelled/done) in sync via the single invariant `done ⇔ completed`. Pure `withStatus`/`withCompleted` + status labels; callers persist through `updateTask`. | §6 |
| `completion-events.ts` | Tiny pub/sub completion event bus (`onTaskCompleted`/`emitTaskCompleted`). `task-store.updateTask` emits on every false→true completion so the global completion popup (`components/Completion/`) appears each and every time a task is done. | §6 |
| `category-tree.ts` | Pure nested-category (sublist) forest helpers over `TaskCategory.parentCategoryId`: ancestors/descendants, render-tree builder, and cycle/dangling-parent-safe `moveCategory`. | §6.2 |
| `molecular.ts` | Pure, immutable `Subtask[]` tree helpers for "molecular" task decomposition — recursively split a task into atomic (`isMolecular`) steps, each with a self-contained `context`. Backs the "Just Start" focus flow. | §1/§59/§128 |
| `priority.ts` | Transparent, entropy-aware priority formula: weighted blend of urgency/importance/cognitive-load/entropy with `priorityBreakdown` so the UI can explain *why* a task ranks where it does. `DEFAULT_PRIORITY_WEIGHTS`. | §42/§46 |
| `scheduling.ts` | Canonical schedule-field helpers (`scheduleFieldsForPeriod`, `clearedScheduleFields`) shared by the Scheduler UI and the scheduling service. | §7 |
| `smart-parse.ts` | Pure, LLM-free smart-capture parser: turns free text ("call dentist tomorrow at 3pm for 30m !!") into a structured `SmartSuggestion` + highlight ranges (category, relative/absolute dates, times, priority markers, durations) using regex + `date-fns`. `now` injectable. | §10 |
| `app-navigation.ts` | App-wide navigation persistence: localStorage keys + `readStoredTab`/`writeStoredTab` and Lists-navigation read/write so a refresh returns the user to their last tab/folder/period/view. | — |
| `search.ts` | Pure, framework-free ranked global search: `searchItems(query, items, opts?)` → `SearchResult[]` (`{ item, score, matchedOn }`), case-insensitive multi-term AND over title/tag/attribute tiers, deterministic ordering, plus `displayTitle` and the `SearchResult`/`SearchField` types. Backs the Cmd/Ctrl-K palette. Unit-tested. | §6a |
| `needs-attention.ts` | Pure, deterministic selector `getNeedsAttention(tasks, opts?)` + `groupNeedsAttentionByReason`, the `NeedsAttentionReason` type, and reason labels. Flags overdue/unclarified/blocked/stale tasks for the Home "Needs Attention" card. Unit-tested. | §6b |
| `pending-reviews.ts` | `getPendingReviews`/`countPendingReviews` — which end-of-period reviews (day/week/month/quarter/year) are still due for the previous period. | §13 |
| `affirmations.ts` | Helpers for the Morning **spoken affirmations** ritual: locate/seed the Lists "Affirmations" list (`findAffirmationsCategory`, `DEFAULT_AFFIRMATIONS`), read its lines (`getAffirmationItems`/`affirmationText`, resilient to the category→list rename), and Fisher–Yates `pickRandom` a session subset. Unit-tested. | §13 |
| `vocal-confidence.ts` | Pure, dependency-free **vocal-confidence** DSP + scoring for the affirmations ritual. McLeod-Pitch-Method `detectPitch` (NSDF + parabolic interpolation; tracks female & male f0), `computeFrameMetrics`, jitter/shimmer (`relativePerturbation`), HNR (`clarityToHnr`), terminal contour/loudness (uptalk + trailing-off), and `scoreConfidence`/`ConfidenceTracker` → a live `ConfidenceScore` (volume · steadiness · conviction · sustain) with hard gates. Swappable scoring boundary; unit-tested. See `components/Reviews/README.md`. | §13 |

### Knowledge graph & second-brain helpers

Pure, serializable building blocks for the typed-link knowledge graph (sources →
beliefs, notes, relations). No store/React imports.

| File | Purpose | Spec |
|------|---------|------|
| `links.ts` | Typed-relation catalog + tag helpers: `RELATIONS`/`inverseRelation`, evidence relations (`supports`/`refutes`…) with per-link `stance` (`getLinkStance`/`linkStanceWeight`), `addLink`/`removeLink`/`hasLink` (self/dup-guarded), `normalizeTag`/`addTag`/`removeTag`. Backs the store's tag/link selectors. Unit-tested. | §5 |
| `link-graph.ts` | Pure relationship-graph builder: `buildLinkGraph(items, opts?)` → `{ nodes, edges }` from items' typed `links` (undirected traversal within `opts.depth` of `opts.focusId`; dedup/self-link guarded). Backs the SVG `LinkGraph` view — see `components/Graph/README.md`. Unit-tested. | §5 |
| `graph-layout.ts` | Pure, deterministic graph/timeline geometry: layered (Sugiyama-lite) `topologicalRanks` for Gantt/dependency columns + radial/circular spread for relation/knowledge graphs. SSR-safe. | §14/§15/§19 |
| `second-brain-types.ts` | Declares the **Source** and **Belief** `ItemTypeDefinition`s (attributes, defaults, detail panels) + a `withSecondBrainTypes` seed helper. Exposes `SOURCE_ATTR`/`BELIEF_ATTR`/`DEFAULT_SOURCE_TRUST`. | §10/§55/§66 |
| `note-types.ts` | Declares the `note` (rich-text document) `ItemTypeDefinition` + `withNoteType` seed helper. Notes aren't actionable but participate in tags/links/lists; rendered via `ItemDetail/BodyPanel`. | §184/§84 |
| `belief-strength.ts` | Pure derived **belief strength** (0–1, 0.5 = balanced) combining each evidence link's `stance` with its source's `trust`, weighted by total evidence mass. Backs the belief calibration view. Unit-tested. | §10 |
| `event-links.ts` | Pure event-prerequisite checklist helpers: link a `CalendarEvent` to its `checklist-of` tasks and derive each task's `schedulingConstraints.mustBeDoneBefore` from the event's start. Unit-tested. | §7.5 |

### Planning, objectives & analytics helpers (Brain2)

Pure, unit-tested computation behind the Analytics, Scheduler, and Objectives
views. All take plain data in / return plain data out (no store, no LLM).

| File | Purpose | Spec |
|------|---------|------|
| `objectives.ts` | Objectives & Goals helpers: period keys (`periodKeyFor`), objective prioritization (`isObjectivePrioritized`/`prioritizedObjectives`, `MAX_PRIORITIES_PER_PERIOD`), goal progress (`goalProgressFraction`/`goalProgressPercent`), and "direction in life" coverage (neglected goals, days serving no goal) derived on read from each task's contribution fields/typed links. | §10 |
| `plan-vs-reality.ts` | Compares a period's plan (plan-text + scheduled tasks + points) against what happened across tasks/time/points dimensions, rolled into an "intention → outcome" variance score (0–100). | §33 |
| `calibration.ts` | Estimate-vs-actual calibration over completed tasks: per-task points (ratio, signed error %), aggregate bias/under-over rates with a plain-language insight, ratio-bucket histogram, and per-period median-ratio trend. | §26/§29 |
| `critical-path.ts` | Dependency-free CPM + PERT solver over a task network: forward/backward pass, slack, and the zero-slack critical path (`isCriticalEdge`). Durations from `pertEstimate` `(o+4l+p)/6` else `estimatedDuration`. | §14/§15/§19 |
| `decision-matrix.ts` | Weighted multi-criteria decision analysis (MCDA): min–max normalizes each criterion across options (benefit vs cost), renormalizes weights, ranks options highest-first with tie handling. Backs the Modules "decision-matrix" view. | §5 |
| `metrics.ts` | Classical analytics over `{date,value}` series: least-squares trend + rolling slope, Pearson correlation (date-aligned), windowed change-point detection, and context-switch counts/heatmap series. Dates parsed as local days. | §137/§138/§140/§275 |
| `streaks.ts` | Store-agnostic streak computation (`day`/`week`/`month`) over date-keyed completions → current/longest run, last date, active-period count. Powers habit/review/focus streaks. | §8b/§9.5 |
| `spreadsheet-utils.ts` | Pure grid/rollup math: numeric/currency attribute detection, `aggregateColumn`/`sumBy`, currency-aware `formatNumber`, and `rollup` (group-by + sum) for the spreadsheet display and Module summary views. Unit-tested. | §5 |
| `spreadsheet-contract.ts` | The framework-free read/write/sort/filter contract every SheetGrid consumer shares: `SheetColumn`, the serializable `SheetViewConfig` (sort/filter/freeze/widths/row-heights), `buildSheetColumns`, `sortRows`/`filterRows`, and the `canWriteCell` formula-column write guard. Unit-tested. | §5 |
| `spreadsheet-keys.ts` | Pure grid interaction model behind the Google-Sheets ergonomics: keyboard navigation (`moveActive`/`tabTarget`/`enterTarget`), rectangular range math (`normalizeRange`/`isWithinRange`/`rangeArea`), clipboard TSV (`rangeToTSV`/`parseClipboardGrid`), and `selectionStats` (Sum/Avg/Min/Max/Count). Unit-tested. | §5 |
| `sheet-a1.ts` | A1-notation cell-reference math: `columnToLetters`/`lettersToColumn`, `parseA1`/`formatA1`, `isCellFormula`, `extractA1Refs`, and `shiftFormula` — relative-reference rewriting for fill-drag that honors `$`-absolute markers and skips quoted strings. Unit-tested. | §5 |
| `sheet-eval.ts` | Evaluates per-cell `=A1` formulas (`=B2+C2`) against a `RawCellAccessor` over the grid: reuses the safe `lib/formula` engine (no `eval`), resolves A1 refs to other cells recursively with cycle detection, and formats the result. Unit-tested. | §5 |

## Data-access layer & domain services

A repository abstracts data access from storage so business logic and UI don't
reach into Zustand directly — the single seam for opportunistic **MongoDB Atlas**
sync via a future `RemoteDataSource`/`SyncingDataSource` (§3) and for sharing this
layer with a future mobile client. The local store stays the offline source of
truth. Domain services hold cross-entity workflows on top of the repository, and
Zod validates writes/imports at the boundary.

| File | Purpose | Spec |
|------|---------|------|
| `data/schemas.ts` | Zod schemas for `Task`/`TaskCategory`/`CategoryFolder`/`ItemLink`/attribute values + the full store snapshot; `parseOrThrow` and `ValidationError`. Permissive about optional/legacy fields. | §5 |
| `data/task-repository.ts` | `taskRepository`: canonical CRUD + query API over the task store; validates writes via Zod. Includes tag/link ops (`byTag`/`addLink`/`removeLink`). | §4–§7 |
| `services/completion-service.ts` | `completeTask`/`uncompleteTask`/`toggleCompletion` — completion semantics incl. repeated-"count" tasks and actual-duration capture (points still awarded in the store). | §6 |
| `services/scheduling-service.ts` | `scheduleTask`/`scheduleTaskToTime`/`clearScheduledTime`/`unscheduleTask`/`pushTask` — scheduling workflows delegating to `scheduling.ts` + `item-utils.ts`. | §7 |
| `services/review-service.ts` | `savePeriodReview`/`getPeriodReview`/`upsertPeriodReview` — period-review persistence over `useReviewsStore` (stable id `${period}:${key}`). | §6 |
| `data/backup.ts` | Full app backup/restore: snapshots every persisted store + free-text plans into one JSON file (`createBackup`/`downloadBackup`) and restores them (`restoreBackup`, rehydrates live stores). | §3.2 |
| `data/data-source.ts` | Phase 10/11 **groundwork** (not yet wired): the transport-agnostic, Promise-returning `DataSource` interface covering every persisted entity (tasks/categories/folders/reviews/points/plans) plus `transaction()` and `DataSourceError`. The seam for the future out-of-process backend. | §3 |
| `data/sources/local-data-source.ts` | **Groundwork.** `DataSource` impl backed by today's sync stores + `taskRepository` (each method wraps the sync result in a resolved Promise). Additive default/offline impl; `transaction()` runs inline (non-atomic). | §3 |
| `data/sources/ipc-data-source.ts` | **Groundwork.** Renderer-side `DataSource` skeleton that validates inputs (Zod) then forwards each op to the Electron main process over a typed `window.cogs` bridge; inert until channels are wired (throws `"not wired"`). See `electron/ipc/README.md`. | §3 |
| `data/mongo/collections.ts` | **Groundwork (driver-agnostic).** Planned MongoDB collection names, document shapes (app `id` → `_id`), and index plan as plain TS types/constants — no `mongodb` import. See `data/mongo/README.md`. | §3 |
| `data/mongo/mongo-data-source.ts` | **Groundwork (driver-agnostic).** Main-process `DataSource` skeleton for MongoDB; methods throw `"not implemented"` with `TODO(phase-11)` notes. Driver injected later via constructor; shapes/indexes in `./collections.ts`. | §3 |
| `habit-utils.ts` | Habit type normalization (`GOAL`/`TIME`/`COUNT` aliases), completion helpers. | §9 |
| `attribute-utils.ts` | Legacy attribute type normalization and value coercion; run from `task-store` migrate on load. | §5 |
| `module-templates.ts` | Pre-built workspace **module templates** (Itinerary, Cleaning, Budget, Blank): `buildModuleTemplate` (pure — lists + attribute schemas + seed items + views) and `instantiateModuleTemplate` (commits to stores). Unit-tested. | §8 |
| `module-plan-sync.ts` | `syncModuleToPlan` — pushes a workspace's finalized, dated items into the day Plan text (`plan-text.ts`). | §7, §8 |
| `plan-text.ts` | Read/write free-text plan areas (`dayPlan-*`, `weekPlan-*`, `monthPlan-*` localStorage keys today). Target: MongoDB `plans` collection. Used by Plan views and period reviews. | §7 |
| `folder-all-items.ts` | Per-folder **All Items** category (`__all-items__{folderId}`): ensure category exists, assign uncategorized items, folder drop helpers. | §6 |
| `scheduled-lists-sync.ts` | Keeps Next Actions smart lists and scheduled folder lists in sync (`na-smart-daily`, week/month/year buckets). | §6, §7 |
| `csv.ts` | Dependency-free CSV parser for Lists import (quoted fields, escaped quotes). | §6 |
| `lists-grid-entries.ts` | `buildGridEntries()` — builds folder/list grid entries for Lists navigation (Map-keyed, no duplicate kind-id entries). Used by `enhanced-category-view.tsx`. | §6 |
| `lists-icon-grid.ts` | `computeIconGridPositions()` — deterministic x/y grid layout for the freeform Lists icon view, shared by the store and the auto-organize animation. | §6 |
| `string-utils.ts` | `hashString`, `hashIconSlot` — deterministic hashing for orb selection and freeform icon slot placement. | — |
| `remove-background.ts` | Client-side near-uniform background removal for uploaded orb images (corner sampling → transparent PNG). | — |
| `orbs-manifest.ts` | Auto-generated manifest of PNG orb filenames under `public/orbs-removebackground/`. Do not edit by hand. | — |
| `utils.ts` | shadcn `cn()` helper (clsx + tailwind-merge). | — |

## Persistence outside stores

Some data still writes directly to `localStorage` from components or helpers rather
than through a Zustand store:

- **Plan text** — `plan-text.ts` keys (`dayPlan-*`, `weekPlan-*`, `monthPlan-*`).
- **Legacy habits** — `habits-store` imports once from old `weekly-habits-*` keys.

The target is moving all of this into **MongoDB** documents (see
`docs/SPEC_MAPPING.md` §3) — e.g. a `plans` collection for plan text and unified
`items` / domain collections with text and vector search indexes.

## Notes

- Prefer `types.ts` + `calculations.ts` + `date-utils.ts` as canonical; older parallel files (`weekly-*`) have been removed.
- `task-store` runs attribute migration via `attribute-utils.ts` on load.
- Completion points for Lists/Next Actions items: `resolveCompletionPoints()` in `item-utils.ts` (default **1**, or numeric **Points** list attribute). On top of that, contributing to an Objective applies a **stacking multiplier** (1.5× default, or a prioritized objective's custom value) via the completion popup — see `goals-store.ts` (`taskObjectiveMultiplier`) and `components/Completion/`.
