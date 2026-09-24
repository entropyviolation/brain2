# Canonical Data Fields — Analysis Snapshot

> **Status: the field-level authority, and now partly actioned.** This is the
> catalog of the Brain2 data model — what exists, what is canonical, what is
> legacy/duplicate, what is derived. It began as a read-only analysis; step 1 of
> [`ARCHITECTURE_MODULARITY.md`](ARCHITECTURE_MODULARITY.md) has since started
> acting on the `title` / `description` row, and the tables below say so where it
> has. Everything still marked a **cleanup candidate** remains un-actioned and
> needs the per-field confirmation noted in that section: the data is
> user-owned and persisted in `localStorage` (offline-first — MongoDB Atlas is a
> possible future *sync* target, not a migration that has been scheduled). Persist
> keys are **`brain2-*`**. Historical **`cogs-*`** keys are a lossless alias
> (`lib/storage-keys.ts`). A careless removal loses something a
> person typed.

> **Why this moved up the queue.** The end goal for Modules is that any small app
> can be **installed** and have its records become ordinary Items
> ([`MODULE_PLATFORM.md`](MODULE_PLATFORM.md)). Every module the platform ever
> installs inherits the vocabulary catalogued here, so a port wizard mapping onto
> two names for "what this thing is called" multiplies the ambiguity by the number
> of modules. Title-as-field-of-record (persist v11–v12) already shipped; remaining
> naming debt is the parked-note `description` / `body` question below. Screen
> waves in [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md) do **not** wait on finishing
> this file. Careful, migration-safe, per-field — Wave 10 of that plan.

**Orders of abstraction (planned, not a column yet).** GS-1 in
[`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md) gives every shown value
an order: observed, recorded, derived, inferred, stored on the existing
`FieldEstimate` rather than a new provenance type. Until that lands,
`FieldEstimate` on time fields is the only stored provenance. Do not add a
parallel `order` field in a drive-by. GS-5 adds one item type, `formulation`,
with a role. Do not add `concept`.

Primary sources read: `lib/types.ts`, `lib/data/schemas.ts`, `lib/task-store.ts`
(`migrate`, `DATE_KEYS`), `lib/migrations.ts`, `lib/item-utils.ts`, `lib/links.ts`,
plus grep of field usages across `components/**` and `lib/**`.

Legend for the **class** column:
- **canonical** — the intended long-term field.
- **legacy** — kept for back-compat / superseded but still read or written.
- **derived** — computed from other fields or set as a side effect (not user-authored).
- **placeholder** — declared in types for a roadmap feature, not yet read/written anywhere.

"Persisted?" = survives a `cogs-task-storage` round-trip (everything on `Task`
persists via Zustand `persist`; the column flags Date handling / defaulting
nuances). "Zod?" = explicitly listed in a schema in `lib/data/schemas.ts`
(note: `taskSchema` is `.passthrough()`, so unlisted fields still pass through
unvalidated).

---

## Base `Item` interface (`lib/types.ts`)

Every domain entity is an `Item` (spec §5). **Ontology:** Item is the only
noun. **Runtime:** the persisted document is still typed as `Task`; prefer
`ItemRecord` (`export type ItemRecord = Task`) on new signatures. `Task` remains
exported. Persist key `cogs-task-storage` and JSON array `tasks` are unchanged
(persist **v12**). Built-in subtypes (e.g. Task-the-kind) extend `Item`. The
base fields are optional during the v1→v2 migration; the store migration
(`migrateTasksToItems`, version 7) backfills `title`/`tags`/`links` and does
not invent `type`. Persist v12 fills a missing `type` only.

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `id` | `string` | canonical | yes | yes (`taskSchema`) | Primary key. MongoDB plan: `id → _id` (`lib/data/mongo/collections.ts`). |
| `type` | `ItemType` | canonical | yes | yes (optional) | Discriminator. Persist **v12** fills a **missing** type only: Next Actions membership or inbox lifecycle → `"task"`, else `"item"`. Explicit `"operation"` / `"note"` / catalog / already-written `"task"` are never overwritten. **New list items** use `"item"`. Next Actions / To-Do create `"task"`. |
| `title` | `string?` | canonical | yes | yes (optional) | **The field of record for "what is this called."** `Task.description` is still written as a mirror during the transition. Read through `itemTitle()` / `itemTitleOrUntitled()` (`lib/item-utils.ts`) rather than either field — before that seam existed, call sites disagreed about which one wins (`item-merge` / `calibration` / `ingest/apply-tracking` preferred `description`; `search` / `affirmations` / `implied-actions` / `NeedsAttention` preferred `title`). |
| `createdAt` | `Date` | canonical | yes (Date-revived) | yes | In `DATE_KEYS`; rehydrated to `Date`. |
| `tags` | `string[]?` | canonical | yes | yes (optional) | Free-form, normalized via `normalizeTag` (`lib/links.ts`). Backfilled to `[]`. |
| `links` | `ItemLink[]?` | canonical | yes | yes (optional) | Typed relations; see `ItemLink` table. Backfilled to `[]`. |
| `attributes` | `Record<string, AttributeValue>?` | canonical | yes | yes (optional) | Flexible schema-driven values keyed by `AttributeDefinition.id`. |

---

## `Task` (fields added on top of `Item`) (`lib/types.ts`)

`Task` is two things at once: (1) the **v1 persisted document** of an Item
record (`ItemRecord` is the alias — same type), and (2) the **built-in kind**
(`type: "task"`, Next Actions membership, `isTaskItem()`). Do not flatten
task-kind fields onto `Item`; they stay type capabilities. `Task` redeclares
`id`, `createdAt`, and `attributes` (identical to `Item`); those are omitted
below. Everything on `Task` persists to `cogs-task-storage`.

### Intentional distinctions — **KEEP (do NOT treat as cleanup candidates)**

These look like duplicates but are deliberate per the project owner (see the
header comment in `lib/types.ts` and `docs/SPEC_MAPPING.md` §5). Flagged here so a
future cleanup does not collapse them.

| field | type | class | notes |
|---|---|---|---|
| `entropy` | `number?` (0–1) | canonical — **keep** | Display-only uncertainty/messiness signal. **NOT** a duplicate of `cognitiveLoad`. |
| `cognitiveLoad` | `number?` (1–3) | canonical — **keep** | Feeds the priority formula (`lib/priority.ts`). Distinct purpose from `entropy`. |
| `stage` | `"inbox" \| "clarified" \| "scheduled" \| "completed" \| "list"` | canonical — **keep** | Built-in **task lifecycle bucket** (single value). Intentionally NOT a generalized `status`. Was named `category`; renamed so it cannot be mistaken for list membership. |
| `lists` | `string[]` | canonical — **keep** | **List membership** — which lists the task belongs to; drives attribute inheritance + scheduling. Different axis from `stage`. Was named `categories`. |

> **These two are settled, not pending.** The old `category` / `categories`
> collision was a naming problem, not a modelling one — two real axes wearing
> near-identical names. Renaming them to `stage` / `lists` (and `TaskCategory` /
> `CategoryFolder` to `List` / `Folder`) resolved it. Nothing further is owed
> here, and `ARCHITECTURE_MODULARITY.md` step 1 is scoped to `title` /
> `description` alone.

### Core / lifecycle

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `description` | `string` | canonical (**mirror, with one exception**) | yes | yes | The v1 name for the task's text. `title` is the field of record; persisted vaults and backups still carry `description`, so it is not removable yet. **Do not read it directly** — every display read goes through `itemTitle()` / `itemTitleOrUntitled()` in `lib/item-utils.ts`, and `lib/item-title-reads.test.ts` fails the build on a new one. The only exceptions are the name *editors* (ItemDetail, the spreadsheet name column, the itinerary place row), which read and write the same field in lockstep. ⚠️ It is not purely a mirror: `noteToParkedItem` (`lib/apple-notes.ts`) deliberately writes a short `title` and the note's **full body** here, because `lib/search.ts` indexes `description` and not `body`. See the open question below. |
| `completed` | `boolean` | canonical | yes | yes | Completion gate; triggers points award in `updateTask`. Invariant: `status === "done"` ⇔ `completed === true`. |
| `status` | `CompletionStatus?` (`active` / `partial` / `deferred` / `cancelled` / `missed` / `done`) | canonical | yes | yes | Feature 9 richer completion. `"missed"` is too late — leaves To Do / Next Actions like done, files on Missed Opportunities instead of Completed. Helpers: `lib/completion-status.ts`. |
| `missedAt` | `Date?` | canonical | yes (Date-revived) | yes | Stamped when `status` becomes `"missed"`; cleared on reopen. |
| `loggedAction` | `boolean?` | canonical | yes | no | Implied-action Done log (`type: "action"`); included in Done-today even when not a Task. |
| `icon` | `string?` | canonical | yes | no (passthrough) | Orb path or data URL for Lists "File Manager". |
| `notes` | `string?` | canonical | yes | no | Free text; indexed by `lib/search.ts`. |
| `taskDescription` | `string?` | canonical | yes | no | "Detailed description" distinct from `description`; edited in ItemDetail, read by search/LinkPicker. Naming is confusing but in active use. |

> **Open question for the owner — `description` is doing two jobs.** Step 1
> assumed `description` was only an older name for `title`, so the write path
> could keep the two in lockstep. It cannot. Parked Apple Notes
> (`noteToParkedItem`) store a short `title` and the note's full text in
> `description`, and `lib/search.ts` indexes `description` but not `body`, so
> forcing `description := title` would make those notes unfindable and forcing
> `title := description` would give them a multi-line name.
>
> What ships instead never writes `description` at all. Persist v11 only
> **backfills** a missing `title`, and `syncTitleFromDescription()` (applied in
> `addTask` / `updateTask`) follows a rename made through `description` only
> when the two fields were already identical before the write — which is true of
> a document and false of a parked note. Drifted pairs are left exactly as the
> user left them.
>
> The clean end state is to teach `search.ts` to index `body`, move parked-note
> text there, and only then make `description` a pure mirror. That is a separate
> change with its own migration, and it needs a decision first.

### Priority / effort inputs

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `urgency` | `number?` (1–5) | canonical | yes | yes | Priority numerator. |
| `importance` | `number?` (1–5) | canonical | yes | yes | Priority numerator. |
| `estimatedDuration` | `number?` (min) | canonical | yes | yes | Priority denominator; PERT coexists. |
| `actualDuration` | `number?` (min) | derived | yes | no | Set on completion / from `timeLogs` (`actual-day-view.tsx`). Feeds calibration + beat-the-clock. |
| `rewardValue` | `number?` | canonical | yes | yes | Points for non-next-action completion; default 50 in v2 migration. |
| `context` | `string?` (e.g. `@work`) | canonical | yes | no | GTD context. Active (inbox defaults, sidebar, search). NOT yet merged into `tags` (spec §5 future). |

### Scheduling

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `scheduledDate` | `Date?` | canonical | yes (Date-revived) | yes | In `DATE_KEYS`. Finest granularity. |
| `scheduledTime` | `string?` (`"14:30"`) | canonical | yes (string) | yes | Deliberately excluded from `DATE_KEYS` so it stays a string. |
| `scheduledWeek` | `string?` (`"YYYY-..._..."`) | canonical | yes (string) | yes | Coarse schedule level. |
| `scheduledMonth` | `string?` (`"YYYY-MM"`) | canonical | yes (string) | yes | Coarse schedule level. |
| `scheduledYear` | `string?` (`"YYYY"`) | canonical | yes (string) | yes | Coarse schedule level. |
| `deadline` | `Date?` | canonical | yes (Date-revived) | yes | In `DATE_KEYS`. |
| `scheduleable` | `boolean?` | canonical | yes | no | Per-item override; resolved by `isTaskScheduleable` (else list/folder default). |
| `dependencies` | `string[]?` (task ids) | canonical | yes | yes | Critical-path / Gantt / project network. |
| `schedulingConstraints` | object | canonical | yes (`mustBeDoneAfter/Before` Date-revived) | no | Nested constraints; only the two `mustBeDone*` keys are in `DATE_KEYS`. §7.6 auto-scheduling deferred but fields retained. |

### To-Do push / visibility (derived counters)

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `daysPushed` | `number?` | derived | yes | no | Incremented by `pushTaskOnePeriod`. |
| `weeksPushed` | `number?` | derived | yes | no | Incremented by `pushTaskOnePeriod`. |
| `monthsPushed` | `number?` | derived | yes | no | Incremented by `pushTaskOnePeriod`; verified by review-carryover integration test. |
| `hiddenFromTodo` | `boolean?` | canonical | yes | no | Hide from To-Do without completing. |

### Partial completion / time logging

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `allowPartialCompletion` | `boolean?` | canonical | yes | no | Set in many creators (default `false`); read/edited in ItemDetail. Defaulted in v2 migration. |
| `minimumChunkSize` | `number?` (min) | canonical | yes | no | Min minutes for partial completion; read/edited in ItemDetail. |
| `completedChunks` | `{ date: Date; duration: number; notes? }[]?` | canonical | yes (chunk `date` Date-revived) | no | Used by `plan-vs-reality.ts`, `calibration.ts`. `date` joined `DATE_KEYS` in persist v11; `timeLogs[].date` stays a string because it carries no time component. |
| `timeLogs` | `TimeLogEntry[]?` | canonical | yes (`date` is a `YYYY-MM-DD` string) | no | Day-log actual time (`actual-day-view.tsx`, `agenda-grid.tsx`); feeds plan-vs-reality. |

### Subtasks / decomposition

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `subtasks` | `Subtask[]?` | canonical | yes | yes (partial — see drift) | See `Subtask` table. |
| `parentTaskId` | `string?` | canonical | yes | no | Parent link for subtask-as-task; read in ItemDetailPage. |

### Motivation / review text

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `why` | `string?` | canonical | yes | no | "Why this needs doing"; edited in ItemDetail, indexed by search. |
| `consequences` | `string?` | canonical | yes | no | "What happens if not done"; edited in ItemDetail. |
| `completionReview` | `TaskCompletionReview?` | canonical | yes (`completedAt` Date-revived) | no | Post-mortem; written by `completion-service.ts`, read by Analytics/calibration. The reviver matches key names at any depth, so the nested `completedAt` was always a `Date`. |

### Recurrence

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `isRepeated` | `boolean?` | canonical | yes | no | Recurrence toggle. |
| `repeatSettings` | object | canonical | yes | no | count/frequency recurrence config. |

### PERT / Gantt / Brain2 additions

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `pertEstimate` | `{ optimistic; likely; pessimistic }?` | canonical | yes | no | Used by `critical-path.ts`, `project-network.ts`. Coexists with `estimatedDuration` by design. |
| `isSummary` | `boolean?` | **placeholder** | yes | no | Gantt rollup task. **No reads/writes found** outside `lib/types.ts`. Cleanup candidate. |
| `parallelGroup` | `string?` | **placeholder** | yes | no | Concurrency grouping. **No reads/writes found.** Cleanup candidate. |
| `riskFlag` | `boolean?` | **placeholder** | yes | no | "Tricky step" flag. **No reads/writes found.** Cleanup candidate. |
| `definitionOfDone` | `string?` | **placeholder** | yes | no | Perfectionism guardrail. **No reads/writes found**. Cleanup candidate. |

---

## `ItemLink` (`lib/types.ts`) — typed relations

The **graph** is Items as nodes and `ItemLink` as edges, stored on `Item.links`
and catalogued in `lib/links.ts` (`RELATIONS`, inverses, `recordLinks`).
Backlinks are derived (`getBacklinks`). Prefer `taskRepository.addLink` /
`lib/links.ts` helpers over hand-rolled `links: [...]`.

**Not the same graph:** `Task.dependencies: string[]` and `parentTaskId` are
task-kind schedule edges (Gantt / critical-path / ItemDetail parent). Slice 1
does not merge them into `Item.links`. A later slice may project `dependencies`
as `blocks` / `blocked-by` without deleting the arrays until every reader
moves.

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `id` | `string` | canonical | yes | yes (`itemLinkSchema`) | |
| `relation` | `string` | canonical | yes | yes | From `RELATIONS` catalog (`lib/links.ts`), but free-form allowed. |
| `targetId` | `string` | canonical | yes | yes | |
| `stance` | `LinkStance?` | canonical | yes | **no** | Five-level support↔refute; powers belief graph (`belief-strength.ts`). **Missing from `itemLinkSchema`** — drift. |
| `weight` | `number?` (0–1) | canonical | yes | **no** | Relation certainty. **Missing from `itemLinkSchema`** — drift. |

## `Subtask` (`lib/types.ts`)

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `id` | `string` | canonical | yes | yes (`subtaskSchema`) | |
| `description` | `string` | canonical | yes | yes | |
| `completed` | `boolean` | canonical | yes | yes | |
| `isMolecular` | `boolean?` | canonical | yes | **no** | Atomic-step flag (`molecular.ts`, JustStartMode). **Missing from `subtaskSchema`** — drift. |
| `context` | `string?` | canonical | yes | **no** | Self-contained background. **Missing from `subtaskSchema`** — drift. |

## `AttributeValue` / `AttributeDefinition` (`lib/types.ts`)

`AttributeValue` (`string | number | boolean | string[] | GoalValue | FileValue |
FileValue[] | null | undefined`) is mirrored by `attributeValueSchema` (which now
includes `fileValueSchema` and `fileValueSchema[]`). `AttributeType` adds
`"file"` and `"multifile"` alongside the existing members. `AttributeDefinition`
(the schema editor's shape — `id`, `name`, `type`, `options`, `unit`, `labels`,
`refListId`, `booleanDisplay`, `allowFloat`, `allowMultiple`, `optionSource`,
`optionListId`, `datetimeMode`) has **no Zod schema**; it round-trips inside
`TaskCategory.itemAttributes` via `.passthrough()`.

### `FileValue` (`lib/types.ts`) — attached-file attribute value

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `id` | `string` | canonical | yes | yes (`fileValueSchema`) | |
| `name` | `string` | canonical | yes | yes | Display file name. |
| `mime` | `string` | canonical | yes | yes | MIME type. |
| `uri` | `string` | canonical | yes | yes | **`idb:<id>` blob ref** (IndexedDB) or a legacy data URL. Same field reused for a future Electron file-store path. |
| `size` | `number?` | canonical | yes | yes | Bytes (optional). |
| `extractedText` | `string?` | canonical | yes | yes | Optional searchable/indexed text. |

## `List` (formerly `TaskCategory`) (`lib/types.ts`)

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `id`, `name`, `color` | string | canonical | yes | yes (`taskCategorySchema`) | |
| `createdAt` | `Date` | canonical | yes (Date-revived) | yes | In `DATE_KEYS`. |
| `description` | `string?` | canonical | yes | yes | |
| `order` | `number?` | canonical | yes | yes | Custom ordering; backfilled in v2 migration. |
| `scheduleable` | `boolean?` | canonical | yes | yes | Defaulted `true` in v4 migration. |
| `icon` | `string?` | canonical | yes | yes | |
| `itemAttributes` | `AttributeDefinition[]?` | canonical | yes | no (passthrough) | Per-list attribute schema. |
| `defaultAttributeValues` | `Record<string, AttributeValue>?` | canonical | yes | no | Seeded onto new items (`withCategoryDefaults`). |
| `displayedAttributes` | `string[]?` | canonical | yes | no | Shown-attributes default; Details uses this only when `detailsColumns` is unset. |
| `detailsColumns` | `string[]?` | canonical | yes | no | Ordered Details-table column ids. Independent of `sheetConfig.columnIds`. `[]` = Name only. |
| `sheetConfig` | `SheetViewConfig?` | canonical | yes | no | Spreadsheet layout including `columnIds`. Independent of Details. |
| `itemLabel` | `string?` | canonical | yes | no | Singular item label. |
| `itemTypeId` | `string?` | canonical | yes | no | Default type for new rows (`withListMembership`). |
| `detailPanels` | `ItemDetailPanel[]?` | canonical | yes | no | Extra tabs unioned onto the type's panels. |
| `hiddenDetailPanels` | `ItemDetailPanel[]?` | canonical | yes | no | Hide tabs even if the type would show them. |
| `rules` | `ItemTypeRule[]?` | canonical | yes | no | List-scoped rules including implied actions. |

## `Folder` (formerly `CategoryFolder`) (`lib/types.ts`)

Fully covered by `categoryFolderSchema` for the strict fields (`id`, `name`,
`createdAt`, `categoryIds`, `parentFolderId`, `color`, `description`,
`scheduleable`, `icon`); `.passthrough()` allows the rest. `scheduleable`
defaulted `true` in v4 migration; `categoryIds` deduped in v6.

## `PeriodReview` (`lib/types.ts`) — persisted by `reviews-store` (separate store)

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `id` | `string` (`${period}:${periodKey}`) | canonical | yes (reviews-store) | **no schema** | Not in `lib/data/schemas.ts`. |
| `period` | `ReviewPeriod` | canonical | yes | no | day/week/month/quarter/year. |
| `periodKey` | `string` | canonical | yes | no | |
| `completedAt` | `Date` | canonical | yes | no | |
| `summary` | `string` | canonical | yes | no | |
| `gratitude` | `string[]` | canonical | yes | no | |
| `nextPlans` | `string` | canonical | yes | no | |
| `planReflection` | `string?` | canonical | yes | no | Shown alongside plan text in Reviews. |
| `reflections` | `Record<string, string>` | canonical | yes | no | question id → answer. |
| `resolvedTaskIds` | `string[]` | derived | yes | no | Snapshot of carry-over resolution. |
| `pushedTaskIds` | `string[]` | derived | yes | no | Snapshot of carry-over resolution. |

## `ItemTypeDefinition` (`lib/types.ts`) — the type-extensibility seam

Declared in full (`id`, `name`, `pluralName`, `itemLabel`, `description`, `icon`,
`color`, `builtin`, `kind` (`system` \| `catalog`), `attributes`,
`defaultAttributeValues`, `displayedAttributes`, `detailPanels`, `detailLayout`
(hero image + featured attributes), `capabilities`, `rules`) with companion types
`ItemTypeCapabilities`, `ItemTypeRule`, `ItemRuleCondition`, `ItemRuleAction`
(including `logAction` / `incrementHabit`). Operators include `increased` /
`decreased` / `changed` (compare previous snapshot on update). **No Zod schema.**
The type-creation UI lives in `components/ItemTypes/`. Catalog types persist user
edits; system types are re-seeded from code.

## Module platform contract (`lib/types.ts`) — Phase 0 seam (additive, forward-looking)

The shared, serializable type contract for the flexible **Module platform**. All
additive; no persisted shape changed. The workflow engine, builder UI, and
example modules are later workstreams. Downstream agents should build on these
exact names:

- `FileValue` — attached-file value (see table above); backs `"file"` /
  `"multifile"` attribute types.
- `ModuleListBinding` — `{ role; categoryId; itemTypeId?; attributeExtensions? }`;
  binds a list (category) into a module under a named role, optionally extending
  its attribute schema.
- `ModuleDefinition` — `{ id; name; description?; icon?; lists; views;
  workflows; planSync?; enablePrint? }`. `views` reuses `ModuleView` and
  `planSync` reuses `ModulePlanSync` (= `NonNullable<ModuleInstance["planSync"]>`),
  both imported **type-only** from `lib/modules-store.ts` (no import cycle).
- `WorkflowTrigger` — union over `{ kind: "item"; event: ItemRuleTrigger }`,
  `{ kind: "attribute"; attrId; event: "change" }`, `{ kind: "manual"; buttonLabel? }`,
  `{ kind: "schedule"; intervalMinutes? }`.
- `WorkflowAction` — `ItemRuleAction` (existing variants stay usable) unioned with
  `createItem` / `link` / `setSchedule` / `syncPlan` / `runWorkflow` / `throw` /
  `pickRandom` variants.
- `WorkflowDefinition` — `{ id; name; moduleId?; scope?; trigger; conditions?
  (ItemRuleCondition[]); actions; enabled? }`.

**Mutation seam:** `lib/workflow-hooks.ts` exports `ItemMutationEvent`,
`registerItemMutationDispatcher`, `addItemMutationListener`, and
`dispatchItemMutation`. `lib/task-store.ts` fires `create` / `update` /
`complete` events (best-effort `changedAttrs` on update) from `addTask` /
`updateTask`. `initWorkflowEngine` (`lib/services/item-mutation-service.ts`) on
client mount wires module workflows **and** implied-action effects
(`logAction` / `incrementHabit`). A throwing dispatcher never breaks the
originating mutation. No Zod schema for the module/workflow types yet.

---

## Habits store (`WeeklyTask` / `TaskCompletion`) (`lib/types.ts` ~L546–620)

Persisted in `cogs-habits-store` (Zustand persist **v7**), not `cogs-task-storage`. Completions are keyed by local `YYYY-MM-DD` on `WeeklyData`.

| field | type | class | notes |
|---|---|---|---|
| `WeeklyTask.type` | `TaskType` | canonical | BOOLEAN, GOAL, TEXT, INCREMENTAL (climb). TIME/COUNT normalize to GOAL. |
| `WeeklyTask.frequency` | `"daily" \| "weekly" \| "monthly"` | canonical | Which Habits tab the habit appears on. Independent of climb cadence. |
| `WeeklyTask.trackingLink` | `HabitTrackingLink` | canonical | Auto-fill from Tracking tags for Goal / Yes-No habits (daily, weekly, or monthly). Weekly/monthly sum tagged minutes across the period. |
| `WeeklyTask.goal` / `unit` | number / string | canonical | Fixed target for GOAL habits. `unit` also used on climb. |
| `WeeklyTask.incrementalData` | `IncrementalHabitPersisted` | canonical (`IncrementalHabitData`) | `cadence`, `startValue`, `increment`, `unit?`, `startedOn?`. Source of truth after v3. |
| `IncrementalHabitLegacy.currentValues` / `weeklyIncrement` | `Record<string, number>` | legacy | Pre-cadence multi-metric maps. Migrated in persist v3 via `lib/incremental-habits.ts`. |
| `WeeklyTask.timeEstimate` | `HabitTimeEstimate?` | canonical | Minutes per unit or per completion for Done-row duration. |
| `WeeklyTask.priorityPinned` | `boolean?` | canonical | User pin; lasts until removed. Adds +1 effective weight. Persist v7. |
| `WeeklyTask.priorityMuted` | `boolean?` | canonical | Drops missed-period auto-priority. Persist v7. |
| `WeeklyTask.createdAt` | `string?` (ISO) | canonical | Stamped when a habit is added. Sort by date created. Persist v10. |
| `TaskCompletion.value` | `number?` | canonical | Numeric log for GOAL **and** climb (same cell shape: value vs target). |
| `TaskCompletion.incrementalValues` | `Record<string, number>?` | legacy | Old per-metric logs. Still **read** as fallback; new writes omit it. |
| `TaskCompletion.completed` / `text` / `goal` | mixed | canonical | Boolean / text / snapshot of goal. |
| `HabitsState.gradeTolerance` | `number` (1–100) | canonical | Raw day % that counts as 100 on the Week grade curve. Default 100 (no curve). |
| `HabitsState.outputGradeTolerance` | `number` (1–100) | canonical | Raw elapsed row % that counts as 100 on the Perfect output curve. Default 100. Independent of `gradeTolerance`. |
| `HabitsState.accomplishmentThreshold` | `number` (1–100) | canonical | Raw day % that counts as a Good day (“completion to feel accomplished”). Default 80. Independent of grade curves. Persist v6. |
| `HabitsState.accomplishmentBonus` | `number` (≥0) | canonical | Points awarded on a Good day. Default 50. Persist v6. |
| `HabitsState.dayGradeLiftBonus` | `number` (≥0) | canonical | Points paid once for Week grade and once for Perfect output when that grade is higher than yesterday. Default 25. 0 turns it off. Persist v21. |
| `HabitsState.weeklyGradeLiftBonus` | `number` (≥0) | canonical | Points paid once for this week’s weekly-habit grade and once for weekly output when that grade is higher than last week. Default 25. 0 turns it off. Persist v21. |
| `HabitsState.gradeUsePriority` / `outputUsePriority` / `goodDaysUsePriority` | `boolean` | canonical | Optional 50% floor blend of prioritized habits into grades / Good days. Persist v7. |
| `HabitsState.habitViewMode` | `"grid" \| "heatmap"` | canonical | Daily spreadsheet vs month-of-cells mosaic. Persist v7. |
| `HabitsState.habitSortMode` | `"default" \| "alphabetical" \| "created" \| "priority" \| "weeklyCompletion"` | canonical | Sidebar sort plate. Persist v10. |
| `HabitsState.sortHabitsByPriorityFlag` | `boolean` | canonical | Legacy; kept in sync with `habitSortMode === "priority"`. Persist v7 / migrated v10. |

---

## Tracking (`TimeEntry` / `TrackPen` / `TrackScope`) (`lib/time-entries.ts`, `lib/time-tracking-store.ts`)

Persisted in `brain2-timegrid-store` (Zustand persist **v12**), not `cogs-task-storage`. Time is stored as **minute-resolution intervals**, never slot arrays — `startMin` inclusive, `endMin` exclusive, both minutes past local midnight. Dates are local `YYYY-MM-DD`. Optional fields below need **no persist bump**: omitted means the previous single-pen, unnamed, no-Done-log behavior. v12 appends **iPhone Screen Time** (`iphone-screentime`), **iPhone Calls** (`iphone-calls`), and **iPhone Texts** (`iphone-texts`) without switching `activeScopeId`. v11 appends the **Screen Time** view (id `screentime`, category roots only) without switching `activeScopeId`. v10 folds infinite day/week into `infiniteScroll`. v9 adds hidden pens, untracked-gap notes, and confirmed Day Log events. Screen Time prefs live on `brain2-screentime-prefs`, not this blob.

| field | type | class | notes |
|---|---|---|---|
| `TimeEntry.penId` | `string` | canonical | The **primary** pen — the color the grid draws. Always present. |
| `TimeEntry.secondaryPenIds` | `string[]?` | canonical | Extra pens over the same minutes, same view. Never contains `penId` (`normalizeSecondaryPenIds`). **Not cosmetic**: `entryTagIds` unions the tags of every assigned pen, so the block feeds every habit / tag / operation / goal any of them fulfils. Omitted = primary only, which is what every pre-existing block means — **no migration needed**. Read through `assignedPenIds(entry)`, never by hand. |
| `TimeEntry.title` | `string?` | canonical | Optional display name for one block ("walk to the beach"). Affects **labels only** — counting still uses pens and tags. Blank/omitted falls back to the pen name via `entryDisplayName`. |
| `TimeEntry.variantIds` | `string[]?` | canonical | `PenVariant` ids. Several true at once over the same minutes (overlapping labels *inside* one pen). |
| `TimeEntry.tagIds` | `string[]?` | canonical | Tags on **this block only**, on top of whatever its pens always carry. |
| `TimeEntry.precision` | `"estimated" \| "definite"?` | canonical | Omitted = certain. `"estimated"` is assumed / reconstructed; Analytics can drop it. Same vocabulary as `HabitTimeEstimate.precision`. |
| `TimeEntry.spanId` | `string?` | canonical | Links the calendar-day slices of one block that crossed midnight. One logical event, two rows. |
| `TimeEntry.generatedBy` | `{ kind: "sleep" \| "screentime"; id: string }?` | canonical | Set when a record produced the block rather than a brush stroke. `id` is the local calendar day. Sleep sync and Screen Time sync each replace only their own kind+id, so re-deriving never eats hand-painted time. |
| `TimeEntry.project` / `notes` / `books` / `pages` | mixed | canonical | Detail fields. `project` also feeds the `{project}` action-format variable. Two blocks differing in any of these do not merge (`sameDetails`). |
| `TrackPen.parentId` | `string?` | canonical | The pen this one **counts as**, in the same view. Rollup is computed at read time from the tree (`lib/pen-tree.ts`), so nesting is retroactive and reversible and never rewrites paint. Cycles are blocked on write (`wouldCycle`) and tolerated on read. **Planned:** `parentIds: string[]` for parallel chains — see [`docs/COUNTS_AS.md`](./COUNTS_AS.md#planned-parallel-counts-as-chains). |
| `TrackPen.tags` | `string[]?` | canonical | `TrackTag` ids the pen **always** carries. Cross-scope; the join to Habits. Distinct from `parentId`, which is in-view rollup. |
| `TrackPen.actionFormats` | `PenActionFormat[]?` | canonical | `{ id, template }` — templates that name a Done-today row when a block is painted. Most specific template whose variables all resolve wins; **equal specificity ties on list order** (first listed). Empty/omitted = this pen does not log. Separate from habit tag links. See [`docs/PEN_ACTION_FORMATS.md`](./PEN_ACTION_FORMATS.md). |
| `PenActionFormat.id` / `template` | string | canonical | Placeholders `{minutes}` `{hours}` `{location}` `{project}` `{name}` etc. |
| `TrackPen.links` | `PenLink[]?` | canonical | Standing cross-scope implications ("Ian's House always means Social"). Only ever fills minutes the other scope left blank. |
| `TrackPen.variantLabel` / `variants` | string / `PenVariant[]` | canonical | What the variants answer ("Who?") and the options. |
| `TrackPen.lastUsedAt` | `number?` | canonical | Epoch ms of the last stroke. Drives **Recent** sort. Persist v7 backfills from existing paint. |
| `TrackScope.displayDepth` | `number \| null` | canonical | Which rung of the pen tree this view draws. `null` = Exact (the painted pen), the default. A rendering choice; never regroups stored time. |
| `TrackScope.depthLabels` | `string[]?` | canonical | Names for the **Show as** buttons (Country / Area / Place / Exact; Screen Time: Category / App / Exact; iPhone Calls / Texts: Who / Exact). Defaults per scope in `DEFAULT_DEPTH_LABELS`. |
| `TimeEntry.kind` | `"interval" \| "instant"?` | canonical | Omitted = interval (old vaults). `"instant"` is a discrete event at `startMin` with `endMin === startMin` (duration 0) — occupancy and untracked gaps ignore it. Sunrise, "smoked weed", "fell asleep". |
| `TimeEntry.startEventId` / `endEventId` | `string?` | canonical | An interval may name instants as its start or end ("smoked weed" starting "being high"). |
| `TimeEntry.splitAfter` | `boolean?` | canonical | Scissors seam on the left half. Same-pen adjacent blocks merge unless this is set. Omitted = merge as before. |
| `TrackPen.image` | `string?` | canonical | Optional photograph/orb URL. Tiles across that pen's grid cells as a mosaic; color remains the fallback. |
| `hiddenPenIds` | `Record<scopeId, string[]>` | canonical | Per-view hidden pens. Not a delete — paint stays; they leave the well. Persist v9. |
| `infiniteScroll` | `boolean` | canonical | One continuous strip (day rows + week bands). Persist v10 migrates `infiniteDay` / `infiniteWeek`. |
| `untrackedNotes` | `Record<string, string>` | canonical | Notes on Activity Log gaps, keyed `date\|scopeId\|startMin\|endMin`. Persist v9. |
| `confirmedEventIds` | `string[]` | canonical | Calendar events Day Log has confirmed into tracked blocks. Persist v9. |

Derived Done rows written from tracking are ordinary `Task`s with deterministic ids (`pen-action-<entry or span id>`, `LOGGED_ACTION_TYPE_ID`), so they are upserted rather than duplicated — see `lib/pen-action-sync.ts`.

---

## Cleanup candidates (PROPOSED — do NOT action yet)

Conservative list. Each item needs human confirmation before removal because the
data is user-owned, persisted, and partly a roadmap surface.

| field | location | evidence | recommendation |
|---|---|---|---|
| `Task.isSummary` | `lib/types.ts` L260 | Only occurrence is the declaration; no reads/writes in `components/**` or `lib/**`. | **Likely removable**, but it is a Brain2 Gantt placeholder. Confirm the Gantt feature is abandoned before removing; otherwise keep as documented placeholder. |
| `Task.parallelGroup` | `lib/types.ts` L262 | Declaration only; no usages. | Same as `isSummary` — needs human confirmation (Gantt concurrency feature). |
| `Task.riskFlag` | `lib/types.ts` L264 | Declaration only; no usages. | Same — Brain2 placeholder, needs confirmation. |
| `Task.definitionOfDone` | `lib/types.ts` L268 | Declaration only; referenced solely in roadmap markdown. | Same — perfectionism-guardrail placeholder; keep until that feature is cut. |
| `Task.taskDescription` (naming) | `lib/types.ts` L273 | Actively used, but the name collides conceptually with `description`/`title` and the `PointsEntry.taskDescription` / `data-source` field of the same name (unrelated). | **Do NOT remove** — in active use. Flag for a future *rename* (e.g. `body`/`detail`) to reduce confusion. Needs human confirmation. |
| `WeeklyTask.categoryId` | `lib/types.ts` L601 | Commented `deprecated — kept for data compat`. | Keep until a habit-store migration drops it; confirm no persisted habit data relies on it. |
| `IncrementalHabitLegacy.currentValues` / `weeklyIncrement` | `lib/types.ts` L588–591 | Pre-cadence multi-metric maps. Migrated in habits-store persist v3 via `lib/incremental-habits.ts`. | Keep optional until all local stores have run v3. |
| `TaskCompletion.incrementalValues` | `lib/types.ts` L612 | Legacy per-key climb logs. New completions write `value` only (`incrementalCompletionPayload`). | Keep as read fallback until v3 has run everywhere; then consider drop. |
| `priorityFormula` vs `priorityWeights` | `lib/task-store.ts` | Two parallel weighting systems persisted on the store: `priorityFormula` (4 weights, leftover from an older score helper) and `priorityWeights` (`PriorityWeights`, the transparent formula in `lib/priority.ts`). | Possible duplication of intent. Needs human confirmation on which is canonical before consolidating. |
| `TodoItem` overlap with `Task` | `lib/types.ts` L371–394 | `TodoItem` re-declares `scheduledWeek/Month/Year`, `daysPushed/weeksPushed/monthsPushed`, `hiddenFromTodo`, `rewardValue`, `estimatedDuration` that also live on `Task`. | Likely a separate view-model, not the persisted item. Verify whether `TodoItem` is still constructed anywhere or is itself dead before touching. Mark **needs human confirmation**. |

Not proposed for cleanup (explicitly keep): `entropy`, `cognitiveLoad`, `stage`,
`lists`, `context`, `pertEstimate` — all intentional per owner / in active use.

---

## Type ↔ Zod drift (`lib/types.ts` vs `lib/data/schemas.ts`)

`taskSchema`, `taskCategorySchema`, and `categoryFolderSchema` all use
`.passthrough()`, so "missing" fields are *allowed through unvalidated* rather
than rejected — but they get no runtime type checking on the data-access boundary
(backup/restore + import).

**On `Task` — declared in types, NOT explicitly in `taskSchema`** (passthrough only):
`actualDuration`, `context`, `allowPartialCompletion`,
`minimumChunkSize`, `scheduleable`, `why`, `consequences`, `daysPushed`,
`weeksPushed`, `monthsPushed`, `hiddenFromTodo`, `notes`, `parentTaskId`,
`isSummary`, `parallelGroup`, `riskFlag`, `pertEstimate`, `definitionOfDone`,
`completionReview`, `completedChunks`, `taskDescription`, `schedulingConstraints`,
`isRepeated`, `repeatSettings`, `icon`, `timeLogs`.

**On `ItemLink`** — ✅ **fixed.** `itemLinkSchema` now lists `stance` (a
`linkStanceSchema` enum over the five-level spectrum) and `weight`. This was
worse than the "unvalidated" framing suggested: unlike its neighbours,
`itemLinkSchema` is **strict**, not `.passthrough()`, so Zod was *stripping*
both fields rather than letting them through — a belief graph
(`lib/belief-strength.ts`) would have come back flat from a backup restore.
Regression tests in `lib/data/schemas.test.ts`.

**On `Subtask`** — ✅ **fixed.** `subtaskSchema` now lists `isMolecular` and
`context` (both used by `lib/molecular.ts`). This one is `.passthrough()`, so
nothing was being lost; they are now validated rather than merely tolerated.

**Entirely unvalidated types** (no Zod schema exists at all): `ItemTypeDefinition`
(+ `ItemTypeCapabilities`, `ItemTypeRule`, `ItemRuleCondition`, `ItemRuleAction`),
`AttributeDefinition`, `TimeLogEntry`, `TaskCompletionReview`, `PeriodReview`,
`CalendarEvent`, `DayPlan`, `MonthlyItem`, `WeeklyTask`, `Goal`, `ScheduleBox`.
Only `Task` / `TaskCategory` / `CategoryFolder` / `ItemLink` / `Subtask` /
`AttributeValue` have schemas today.

**Date handling (persistence, not Zod) — resolved.** `DATE_KEYS` in
`lib/task-store.ts` revives `createdAt`, `deadline`, `scheduledDate`,
`completedDate`, `missedAt`, `startedAt`, `completedAt`, `mustBeDoneAfter`,
`mustBeDoneBefore`, and now `date`. The reviver matches on the **key name at any
depth**, so nested `completionReview.completedAt` *is* revived as a `Date` — an
earlier version of this document claimed otherwise.

`completedChunks[].date` was the one real gap and now round-trips as a `Date`.
Adding `"date"` looks unsafe because `timeLogs[].date` holds a `"2026-06-20"` day
key that must stay a string, but it is not: the guard `ISO_DATE_RE` requires a
`T..:..:..` time component that a date-only key cannot match, so only real
timestamps are revived. Both directions are covered in
`lib/task-store.dates.test.ts`. Consumers should stay defensive regardless (most
already use `safeToDate` / `new Date(...)`); those call sites are correctness,
not redundancy, because backups and imports can carry either form.
