# Canonical Data Fields — Analysis Snapshot

> **Status: analysis only (Phase 5c).** This is a read-only catalog of the COGS
> data model as it exists today. **No code, types, or schemas were changed to
> produce this document.** Its purpose is to give a future, careful field-cleanup
> pass an authoritative map of what exists, what is canonical, what is
> legacy/duplicate, and what is derived/computed. The model is sensitive
> (localStorage-persisted user data + a planned MongoDB migration), so nothing
> here should be actioned without the per-field confirmation noted in the
> "Cleanup candidates" section.

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

Every domain entity is converging on `Item` (spec §5). Built-in subtypes (e.g.
`Task`) extend it. The base fields are optional during the v1→v2 migration; the
store migration (`migrateTasksToItems`, version 7) backfills `type`/`title`/
`tags`/`links`.

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `id` | `string` | canonical | yes | yes (`taskSchema`) | Primary key. MongoDB plan: `id → _id` (`lib/data/mongo/collections.ts`). |
| `type` | `ItemType` | canonical | yes | yes (optional) | Discriminator; defaults to `"task"` in migration. Built-ins: task/habit/event/goal/note. |
| `title` | `string?` | canonical | yes | yes (optional) | Canonical display label. **Mirrors `Task.description`** during transition — see drift note. |
| `createdAt` | `Date` | canonical | yes (Date-revived) | yes | In `DATE_KEYS`; rehydrated to `Date`. |
| `tags` | `string[]?` | canonical | yes | yes (optional) | Free-form, normalized via `normalizeTag` (`lib/links.ts`). Backfilled to `[]`. |
| `links` | `ItemLink[]?` | canonical | yes | yes (optional) | Typed relations; see `ItemLink` table. Backfilled to `[]`. |
| `attributes` | `Record<string, AttributeValue>?` | canonical | yes | yes (optional) | Flexible schema-driven values keyed by `AttributeDefinition.id`. |

---

## `Task` (fields added on top of `Item`) (`lib/types.ts`)

`Task` redeclares `id`, `createdAt`, and `attributes` (identical to `Item`); those
are omitted below. Everything on `Task` persists to `cogs-task-storage`.

### Intentional distinctions — **KEEP (do NOT treat as cleanup candidates)**

These look like duplicates but are deliberate per the project owner (see the
header comment in `lib/types.ts` and `docs/SPEC_MAPPING.md` §5). Flagged here so a
future cleanup does not collapse them.

| field | type | class | notes |
|---|---|---|---|
| `entropy` | `number?` (0–1) | canonical — **keep** | Display-only uncertainty/messiness signal. **NOT** a duplicate of `cognitiveLoad`. |
| `cognitiveLoad` | `number?` (1–3) | canonical — **keep** | Feeds the priority formula (`calculatePriorityScore`, `lib/priority.ts`). Distinct purpose from `entropy`. |
| `category` | `"inbox" \| "clarified" \| "scheduled" \| "completed" \| "list"` | canonical — **keep** | Built-in **task lifecycle bucket** (single value). Intentionally NOT a generalized `status`. |
| `categories` | `string[]` | canonical — **keep** | **List membership** — which lists the task belongs to; drives attribute inheritance + scheduling. Different axis from `category`. |

### Core / lifecycle

| field | type | class | persisted? | Zod? | notes |
|---|---|---|---|---|---|
| `description` | `string` | canonical | yes | yes | Primary task text. `title` mirrors this. |
| `completed` | `boolean` | canonical | yes | yes | Completion gate; triggers points award in `updateTask`. |
| `icon` | `string?` | canonical | yes | no (passthrough) | Orb path or data URL for Lists "File Manager". |
| `notes` | `string?` | canonical | yes | no | Free text; indexed by `lib/search.ts`. |
| `taskDescription` | `string?` | canonical | yes | no | "Detailed description" distinct from `description`; edited in ItemDetail, read by search/LinkPicker. Naming is confusing but in active use. |

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
| `completedChunks` | `{ date: Date; duration: number; notes? }[]?` | canonical | yes (chunk `date` NOT in `DATE_KEYS`) | no | Used by `plan-vs-reality.ts`, `calibration.ts`. ⚠️ inner `date` not in `DATE_KEYS`; round-trips as string. |
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
| `completionReview` | `TaskCompletionReview?` | canonical | yes (`completedAt` NOT in `DATE_KEYS`) | no | Post-mortem; written by `completion-service.ts`, read by Analytics/calibration. ⚠️ nested `completedAt` rehydrates as string. |

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
| `definitionOfDone` | `string?` | **placeholder** | yes | no | Perfectionism guardrail. **No reads/writes found** (only mentioned in `docs/brain2_features_roadmap.md`). Cleanup candidate. |

---

## `ItemLink` (`lib/types.ts`) — typed relations

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
| `uri` | `string` | canonical | yes | yes | **Data URL today.** Same field reused for a future Electron file-store path / blobRef. |
| `size` | `number?` | canonical | yes | yes | Bytes (optional). |
| `extractedText` | `string?` | canonical | yes | yes | Optional searchable/indexed text. |

## `TaskCategory` (lists) (`lib/types.ts`)

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
| `displayedAttributes` | `string[]?` | canonical | yes | no | |
| `itemLabel` | `string?` | canonical | yes | no | Singular item label. |
| `detailPanels` | `ItemDetailPanel[]?` | canonical | yes | no | |

## `CategoryFolder` (`lib/types.ts`)

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
`color`, `builtin`, `attributes`, `defaultAttributeValues`, `displayedAttributes`,
`detailPanels`, `capabilities`, `rules`) with companion types `ItemTypeCapabilities`,
`ItemTypeRule`, `ItemRuleCondition`, `ItemRuleAction`. **No Zod schema** and the
type-creation/management UI is not built yet (`docs/SPEC_MAPPING.md` long-term
vision). This is a forward-looking seam, not legacy — keep, but it is currently
unvalidated and lightly used.

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
`registerItemMutationDispatcher`, and `dispatchItemMutation`. `lib/task-store.ts`
fires `create` / `update` / `complete` events (best-effort `changedAttrs` on
update) from `addTask` / `updateTask`. Default dispatcher is `null` → no behavior
change today; a throwing dispatcher never breaks the originating mutation. No Zod
schema for the module/workflow types yet (forward-looking, unvalidated).

---

## Cleanup candidates (PROPOSED — do NOT action yet)

Conservative list. Each item needs human confirmation before removal because the
data is user-owned, persisted, and partly a roadmap surface.

| field | location | evidence | recommendation |
|---|---|---|---|
| `Task.isSummary` | `lib/types.ts` L260 | Only occurrence is the declaration; no reads/writes in `components/**` or `lib/**`. | **Likely removable**, but it is a Brain2 Gantt placeholder (`docs/brain2_features_roadmap.md`). Confirm the Gantt feature is abandoned before removing; otherwise keep as documented placeholder. |
| `Task.parallelGroup` | `lib/types.ts` L262 | Declaration only; no usages. | Same as `isSummary` — needs human confirmation (Gantt concurrency feature). |
| `Task.riskFlag` | `lib/types.ts` L264 | Declaration only; no usages. | Same — Brain2 placeholder, needs confirmation. |
| `Task.definitionOfDone` | `lib/types.ts` L268 | Declaration only; referenced solely in roadmap markdown. | Same — perfectionism-guardrail placeholder; keep until that feature is cut. |
| `Task.taskDescription` (naming) | `lib/types.ts` L273 | Actively used, but the name collides conceptually with `description`/`title` and the `PointsEntry.taskDescription` / `data-source` field of the same name (unrelated). | **Do NOT remove** — in active use. Flag for a future *rename* (e.g. `body`/`detail`) to reduce confusion. Needs human confirmation. |
| `WeeklyTask.categoryId` | `lib/types.ts` L458 | Commented `deprecated — kept for data compat`. | Keep until a habit-store migration drops it; confirm no persisted habit data relies on it. |
| `TaskType.TIME` / `TaskType.COUNT` | `lib/types.ts` L436–437 | Commented `legacy — treated as GOAL`. | Keep (enum values may exist in persisted habit data); fold in a habit migration later. |
| `priorityFormula` vs `priorityWeights` | `lib/task-store.ts` L47–54 | Two parallel weighting systems persisted on the store: `priorityFormula` (4 weights, used by `calculatePriorityScore`) and `priorityWeights` (`PriorityWeights`, the newer transparent formula in `lib/priority.ts`). | Possible duplication of intent. Needs human confirmation on which is canonical before consolidating. |
| `TodoItem` overlap with `Task` | `lib/types.ts` L371–394 | `TodoItem` re-declares `scheduledWeek/Month/Year`, `daysPushed/weeksPushed/monthsPushed`, `hiddenFromTodo`, `rewardValue`, `estimatedDuration` that also live on `Task`. | Likely a separate view-model, not the persisted item. Verify whether `TodoItem` is still constructed anywhere or is itself dead before touching. Mark **needs human confirmation**. |

Not proposed for cleanup (explicitly keep): `entropy`, `cognitiveLoad`,
`category`, `categories`, `context`, `pertEstimate` — all intentional per owner /
in active use.

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

**On `ItemLink`** — `itemLinkSchema` omits `stance` and `weight` (both are real,
actively-used fields). These vanish from any *strict* (non-passthrough) validation
context. **Recommend adding** when the model is next touched.

**On `Subtask`** — `subtaskSchema` omits `isMolecular` and `context` (both
actively used by `lib/molecular.ts`). **Recommend adding.**

**Entirely unvalidated types** (no Zod schema exists at all): `ItemTypeDefinition`
(+ `ItemTypeCapabilities`, `ItemTypeRule`, `ItemRuleCondition`, `ItemRuleAction`),
`AttributeDefinition`, `TimeLogEntry`, `TaskCompletionReview`, `PeriodReview`,
`CalendarEvent`, `DayPlan`, `MonthlyItem`, `WeeklyTask`, `Goal`, `ScheduleBox`.
Only `Task` / `TaskCategory` / `CategoryFolder` / `ItemLink` / `Subtask` /
`AttributeValue` have schemas today.

**Date-handling drift (persistence, not Zod):** `DATE_KEYS` in `lib/task-store.ts`
revives only `createdAt`, `deadline`, `scheduledDate`, `mustBeDoneAfter`,
`mustBeDoneBefore`. Nested `Date` fields typed as `Date` in `lib/types.ts` —
`completedChunks[].date` and `completionReview.completedAt` — are **NOT** in
`DATE_KEYS`, so after a persist round-trip they come back as ISO **strings**, not
`Date` objects. Consumers should treat them defensively (most already use
`safeToDate`/`new Date(...)`). Flag for the cleanup pass.
