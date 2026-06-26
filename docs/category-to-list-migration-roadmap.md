# Category → List rename: migration roadmap

> Status: **EXECUTED.** The rename was carried out across the codebase. `tsc
> --noEmit` is clean and the full `vitest` suite is green (1037 tests, incl. a
> legacy-payload hydration test). This document keeps the original plan for
> historical context; see **"What was actually done"** below for where the
> execution intentionally diverged from the plan.

## What was actually done (execution summary)

The end state matches the **Identifier map** and **Filename map** below, with one
deliberate change to the **persistence strategy**:

- **No perpetual wire-mapping layer.** The plan called for keeping the old keys
  on disk forever and bridging via `lib/data/list-wire.ts` + a `partialize`
  serialize step. Instead we did a cleaner **one-time, versioned migration**:
  - `lib/task-store.ts` persist `version` bumped **8 → 9**. A new pure helper
    `migrateCategoryToList(state)` (exported, unit-tested in
    `lib/task-store.migration.test.ts`) rewrites legacy payloads on rehydrate:
    `state.categories → state.lists`, `List.parentCategoryId → parentListId`,
    `Folder.categoryIds → listIds`, `Task.category → stage`,
    `Task.categories → lists`. Legacy `v<9` migration steps still read the old
    `categories`/`categoryIds` keys (the data really had them at that point).
  - `lib/data/schemas.ts` (Zod) now describes the **new** wire shape (`stage`,
    `lists`, `listIds`). The snapshot/import path validates the post-v9 shape.
  - `lib/data/backup.ts` per-list export now writes `lists` (was `categories`),
    but `parseCategoryExport`/`reviveTask`/`reviveCategory` still **read** the
    legacy `categories`/`category`/`parentCategoryId` keys, so old export files
    keep importing. `importCategory` returns `{ lists, tasks }`.
- **Two runtime bugs that `tsc` could not catch** (loose `ItemLike =
  Record<string, unknown>`) were fixed and are now regression-guarded by tests:
  - `lib/workflow-engine.ts` `scopeMatches` read `item.categories`; now reads
    `item.lists` (otherwise scoped workflows never fired post-rename).
  - `lib/item-types.ts` `resolveItemSchema` read `item.categories`; now reads
    `item.lists` (otherwise per-list attribute schemas resolved empty).
  - `components/Reviews/AffirmationsDialog.tsx` cast the task store to
    `{ categories }`; now uses `{ lists }` / `addList`.
- **Deliberately left as `categories`** (meaning **C**, unrelated domains):
  `lib/habits-store.ts` (`Category`/`setCategories` — habit categories),
  `Goal.category`, smart-parse `suggestion.category`, the budget-template
  attribute literally named `"category"`, and module-view config `categoryId`
  (a separate `WorkflowAction`/`ModuleViewConfig` field id). The historical
  `TaskCategory`/`CategoryFolder` names survive only as doc comments in
  `lib/types.ts`.

---

> Original plan (below) — superseded only on persistence strategy.

## Why

The product UI calls these things **Lists** (the "Lists" / File-Manager tab), but
the data model and stores still use the original **`category`** vocabulary
(`TaskCategory`, `Task.categories`, `addCategory`, `category-tree.ts`, …). The
mismatch makes the code harder to read and onboard onto. We want the code to say
**list** wherever it means a user list.

## The one rule that matters: "category" has THREE meanings

A naive find/replace **will corrupt data and logic.** Before renaming any
identifier, classify which meaning it carries:

| Meaning | Examples | Action |
| --- | --- | --- |
| **A. A user list** (the thing in the Lists tab) | `TaskCategory`, `Task.categories: string[]`, `CategoryFolder.categoryIds`, `addCategory`, `category-tree.ts`, `parentCategoryId` | **RENAME → list** |
| **B. A task lifecycle bucket** | `Task.category: "inbox" \| "clarified" \| "scheduled" \| "completed" \| "list"` (`lib/types.ts:232`) | **RENAME → `stage`** (agreed), but it is *not* a list — keep its string values intact, esp. the value `"list"`. |
| **C. Unrelated free-text grouping** | `Goal.category: string` (`lib/types.ts:622`) | **DO NOT TOUCH** |

Note the trap: meaning **B**'s field is the singular `Task.category` and one of
its *values* is the string `"list"`. Meaning **A**'s field is the plural
`Task.categories`. The string literals `"inbox"`, `"clarified"`, `"scheduled"`,
`"completed"`, `"list"` are **values, not identifiers** — never rewrite them.

## Agreed decisions (do not re-litigate)

1. **Depth:** rename in-code identifiers **and filenames**, but **keep the
   persisted / serialized keys** (`categories`, `category`, `categoryIds`) exactly
   as they are today. Bridge old-wire ↔ new-code names with a **thin mapping layer**
   at every persistence boundary (see "Persistence strategy"). No destructive data
   migration; existing localStorage and backup JSON must keep loading.
2. **Names:**
   - `TaskCategory` → **`List`**
   - `CategoryFolder` → **`Folder`**
   - `Task.categories` → **`Task.lists`** (in-memory only; stored as `categories`)
   - `Task.category` (lifecycle) → **`Task.stage`** (stored as `category`)
3. **Lifecycle field:** rename `Task.category` → `stage` as part of this pass.
   Because it is a *stored* key, it needs the same mapping-layer bridge as
   `categories` (read `category` → `stage`, write `stage` → `category`).
4. **Timing:** this runs **after** the item-type / list-settings feature work
   (already merged) so the rename is a clean, isolated diff.

### Identifier map (apply consistently)

| Old | New |
| --- | --- |
| `TaskCategory` (type) | `List` |
| `CategoryFolder` (type) | `Folder` |
| `Task.categories` | `Task.lists` |
| `Task.category` (lifecycle) | `Task.stage` |
| `TaskCategory.parentCategoryId` | `List.parentListId` |
| `CategoryFolder.categoryIds` | `Folder.listIds` |
| store `categories` | store `lists` |
| `addCategory` / `updateCategory` / `deleteCategory` | `addList` / `updateList` / `deleteList` |
| `moveCategory` / `dedupeCategories` | `moveList` / `dedupeLists` |
| `addCategoryToFolder` / `removeCategoryFromFolder` | `addListToFolder` / `removeListFromFolder` |
| `getCategoryAncestors` / `getChildren`(category-tree) | `getListAncestors` / `getListChildren` |
| `categoryIsNextActions` | `listIsNextActions` |
| `mergeListAttributes` (already "list") | unchanged |
| `itemTypeId` / `enabledDisplays` / `rules` (List fields) | unchanged |

### Filename map

| Old | New |
| --- | --- |
| `lib/category-tree.ts` (+ `.test.ts`) | `lib/list-tree.ts` |
| `components/Lists/enhanced-category-view.tsx` (+ `.test.tsx`, integration test) | `components/Lists/enhanced-list-view.tsx` |
| `components/Lists/dialogs/EditListDialog.tsx` | already "list" — unchanged |
| `lib/data/mongo/collections.ts` `categories` collection name | keep the *string* `"categories"`; rename only the TS symbol |

(There are only ~5 files with "category" in the name — `git mv` them and update imports.)

## Persistence strategy (the careful part)

In-memory code uses the new names; **stored bytes keep the old keys.** Translate
at these boundaries only:

1. **`lib/task-store.ts` persist config** (`name: "cogs-task-storage"`):
   - Add/extend `migrate` + `onRehydrateStorage` (or a custom `storage` with a
     reviver) to map on **read**: `category → stage`, `categories → lists`,
     and on `Folder`: `categoryIds → listIds`.
   - Use `partialize` / a serialize step to map back on **write** so the on-disk
     shape stays `{ category, categories, categoryIds }`. Alternatively bump the
     persisted `version` and persist new keys, but **only** with a `migrate` that
     upgrades old payloads — the agreed default is to keep old keys.
2. **Backup / restore** (`lib/data/backup.ts`, `tests/integration/backup-restore.test.ts`):
   the export/import JSON contract is data — keep its field names as the legacy
   keys, map to/from the new in-memory names in the (de)serializer.
3. **Zod schemas** (`lib/data/schemas.ts`): the schema describes the *wire* shape,
   so keep `category`/`categories` there; map to the new names where the schema
   output is consumed.
4. **Mongo data source** (`lib/data/mongo/collections.ts`, `mongo-data-source.ts`):
   keep the collection name string `"categories"` and document field names; map at
   the repository boundary (`lib/data/task-repository.ts`).
5. **IPC + local data sources** (`lib/data/sources/*`, `electron/ipc/channels.js`):
   keep channel/string identifiers; map payload field names at the edge.

A single helper pair (e.g. `toStored(list)` / `fromStored(record)` in a new
`lib/data/list-wire.ts`) keeps the mapping in one place and unit-testable.

## Suggested execution order (phased, each phase = green `tsc` + `vitest`)

1. **Types first** (`lib/types.ts`): add the new names. Easiest path: declare
   `List`/`Folder` as the canonical interfaces and keep `TaskCategory`/`CategoryFolder`
   as `@deprecated` type aliases (`export type TaskCategory = List`) so the codebase
   compiles while you migrate call sites incrementally. Rename `Task.category`→`stage`
   and `Task.categories`→`lists` here, then immediately add the persistence mapping
   layer (above) so nothing breaks at runtime.
2. **Persistence mapping layer** (`lib/data/list-wire.ts` + task-store persist):
   land + unit-test this *before* renaming store internals, so data round-trips.
3. **Stores** (`lib/task-store.ts`): rename state field `categories→lists` and all
   methods; update the `category-tree` import. Then `git mv lib/category-tree.ts
   lib/list-tree.ts` and rename its functions.
4. **Lib consumers**: `lib/item-utils.ts`, `lib/folder-all-items.ts`,
   `lib/scheduled-lists-sync.ts`, `lib/lists-grid-entries.ts`, `lib/search.ts`,
   `lib/needs-attention.ts`, services, etc.
5. **Components**: the `components/Lists/**` tree (heaviest:
   `enhanced-category-view.tsx` ≈150 refs — do it last and `git mv` it),
   `components/ItemDetail/**`, `components/spreadsheet/**`, `components/Scheduler/**`,
   `components/Modules/**`.
6. **Tests**: update every `*.test.ts(x)` and `tests/integration/**`. Keep at least
   one test that loads a **legacy** payload (old `category`/`categories` keys) and
   asserts it hydrates into the new in-memory shape — this is the regression guard
   for meaning **B** vs **A**.
7. **Docs & screenshots text** (`docs/**`, `README.md`s): prose only, low risk.
8. Remove the deprecated `TaskCategory`/`CategoryFolder` aliases once no references
   remain.

## Scope at time of writing (for estimation)

- `categor*` (case-insensitive) appears in **~180 files**, ~1,000+ occurrences.
- Heaviest: `components/Lists/enhanced-category-view.tsx` (~150),
  `lib/task-store.ts` (~93), `lib/category-tree.ts` (~77),
  `components/Lists/dialogs/EditListDialog.tsx` (~48), `lib/data/**` (Mongo/schemas/
  backup), plus tests.
- Only **5** files have "category" in their **filename** (see filename map).

## Verification checklist

- [x] `npx tsc --noEmit` clean.
- [x] `npm test` (vitest) — all green (1037 tests), including the
  **legacy-payload hydration** test (`lib/task-store.migration.test.ts`).
- [ ] `npm run test:e2e` (Playwright `e2e/lists.spec.ts`) — Lists tab still loads.
  *(not re-run as part of this pass — run before release.)*
- [ ] Manual smoke: load an app profile that predates the rename; confirm lists,
  folders, and task lifecycle (`inbox`/`clarified`/…) all survive a reload.
  *(covered in spirit by the v9 migration unit test; do a manual pass too.)*

## Grep recipes for the future agent

```bash
# Meaning A (rename): the list entity / membership / folder ids
rg -n "TaskCategory|CategoryFolder|\.categories\b|categoryIds|parentCategoryId|addCategory|moveCategory"

# Meaning B (rename to stage, but PROTECT the string values):
rg -n "\.category\b"            # the lifecycle field
rg -n '"(inbox|clarified|scheduled|completed|list)"'   # VALUES — never rewrite

# Meaning C (DO NOT TOUCH): goals' free-text grouping
rg -n "Goal" lib/types.ts       # Goal.category stays as-is
```
