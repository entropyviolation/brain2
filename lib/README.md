# `lib/` — Data model, state stores, and pure helpers

Everything that is **not** React UI: the TypeScript data model, Zustand stores
(persisted to localStorage today; see `docs/SPEC_MAPPING.md` §3 for the planned
**MongoDB** migration — flexible documents, semantic/fuzzy/advanced search, and
aggregation-based routing), and pure calculation/date/sync utilities.

## Zustand stores

| File | localStorage key | Purpose | Spec |
|------|------------------|---------|------|
| `task-store.ts` | `cogs-task-storage` | Tasks, categories, folders — the Inbox / Lists / Scheduler source of truth. Date-aware serialization, versioned migrations, `calculatePriorityScore`. | §4, §5, §6, §7 |
| `event-store.ts` | `cogs-event-storage` | Calendar `CalendarEvent`s. Seeded with demo events. | §7.5 |
| `habits-store.ts` | `cogs-habits-store` | Habit definitions (`WeeklyTask`), per-day completion data (`WeeklyData`), habit categories. Shared by Home Habits and Lists Daily Habits. One-time import from legacy `weekly-habits-*` keys. | §9 |
| `goals-store.ts` | `cogs-goals-store` | Goals with point rewards on completion. | §10 |
| `points-store.ts` | `points-store` | Points ledger (`PointsEntry[]`), day/week/month totals, possible-points projections. | §14 |
| `time-tracking-store.ts` | `cogs-timegrid-store` | TimeGrid scopes, pens, and logged intervals (Activity / Location / Mood). | §12 |
| `reviews-store.ts` | `cogs-reviews-store` | Period reviews (day/week/month/quarter/year) plus helpers for period keys, previous/next period, and carry-over prompts. | §13 |
| `modules-store.ts` | `cogs-modules-store` | User-composed Modules dashboard widgets (`{ id, type, title, config }`). | §8 |
| `lists-ui-store.ts` | `cogs-lists-ui` | Lists UI prefs: folder view mode, icon positions, orb gallery (hidden orbs, edit mode), auto-organize grid, uncategorized filter on All Items. | §6 |
| `theme-store.ts` | `cogs-theme-store` | User-customizable theme colors (points card, habit-type icons). | — |

## Pure helpers (no store)

| File | Purpose | Spec |
|------|---------|------|
| `types.ts` | Shared interfaces/enums: `Task`, `TodoItem`, `CalendarEvent`, `TaskCategory`, `CategoryFolder`, habits (`WeeklyTask`/`TaskType`/`WeeklyData`), scheduling, reviews, modules, attributes. Convergence target for the unified Item model (§5). | §5 |
| `calculations.ts` | Habit completion math: `calculateTaskPercentage`, `calculateDayPercentage`, `calculateDayPercentageAV` for all five habit types. | §9 |
| `date-utils.ts` | App-wide date helpers: `formatDateKey`, `formatLocalDateKey`, week/month/year keys, `getWeekStartDate`, `getWeekString`/`parseWeekString`, range formatting, `isToday`, safe date guards. | §7, §9 |
| `item-utils.ts` | Task/list helpers: schedule-level predicates, `createListItem` / `createNextActionItem`, attribute seeding, `resolveCompletionPoints` (default 1 or list **Points** attribute), singular labels, push-forward. | §5, §6, §7 |
| `habit-utils.ts` | Habit type normalization (`GOAL`/`TIME`/`COUNT` aliases), completion helpers. | §9 |
| `attribute-utils.ts` | Legacy attribute type normalization and value coercion; run from `task-store` migrate on load. | §5 |
| `plan-text.ts` | Read/write free-text plan areas (`dayPlan-*`, `weekPlan-*`, `monthPlan-*` localStorage keys today). Target: MongoDB `plans` collection. Used by Plan views and period reviews. | §7 |
| `folder-all-items.ts` | Per-folder **All Items** category (`__all-items__{folderId}`): ensure category exists, assign uncategorized items, folder drop helpers. | §6 |
| `scheduled-lists-sync.ts` | Keeps Next Actions smart lists and scheduled folder lists in sync (`na-smart-daily`, week/month/year buckets). | §6, §7 |
| `csv.ts` | Dependency-free CSV parser for Lists import (quoted fields, escaped quotes). | §6 |
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
- Completion points for Lists/Next Actions items: `resolveCompletionPoints()` in `item-utils.ts` (default **1**, or numeric **Points** list attribute).
