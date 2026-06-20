# Spec → Code Mapping (COGS v2)

This document maps every section of `Cognitive_Management_System_Spec.docx`
("Personal Cognitive Management System / COGS v2") to the current codebase.

Legend:
- ✅ **Implemented** — present and broadly matches the spec.
- 🟡 **Partial** — exists but diverges from or under-delivers the spec.
- ⛔ **Missing** — not implemented yet.
- 🕓 **Deferred** — explicitly out of scope for v1 per the spec.

> Direction chosen for this rebuild: **incremental evolution** of the existing
> localStorage/Zustand + Electron app toward the spec (not a from-scratch
> rewrite). **Storage target:** **MongoDB** (replacing the spec's original SQLite
> recommendation) for a flexible document model, semantic/fuzzy/advanced search,
> and aggregation-based routing as the dataset grows relational. This file is the
> running checklist for that work.

Screenshots and per-screen write-ups: [`docs/screenshots/`](screenshots/).

---

## §1 Overview & Design Philosophy
Design intent only; no code. Guiding principles to honor going forward:
capture-first, one underlying "item" concept, progressive scheduling,
local-first/sync-ready, AI-ready-not-AI-dependent, everything reviewable.

## §2 System Architecture
- **Shape chosen by this repo:** Option B (Electron) + localStorage via Zustand
  `persist`, migrating toward **MongoDB** (local instance or Atlas) accessed from
  the Electron main process via IPC. See `electron/`, `README.md`.
- Module list (§2.2) maps to top-level tabs in `app/page.tsx` and
  `components/<Module>/` folders:
  **Home** | **Lists** | **Scheduler** | **Modules** | **Analytics**, plus
  global header widgets (**Review**, **Tracking**, Inbox, Bulk Add, Quick Add).

## §3 Data Storage & Sync — 🟡/⛔
- **Current:** ten Zustand stores → localStorage:
  `task-store` (`cogs-task-storage`), `event-store` (`cogs-event-storage`),
  `habits-store` (`cogs-habits-store`), `goals-store` (`cogs-goals-store`),
  `points-store` (`points-store`), `time-tracking-store` (`cogs-timegrid-store`),
  `reviews-store` (`cogs-reviews-store`), `modules-store` (`cogs-modules-store`),
  `lists-ui-store` (`cogs-lists-ui`), `theme-store` (`cogs-theme-store`).
- **Also persisted outside stores:** plan free-text (`lib/plan-text.ts` keys
  `dayPlan-*`, `weekPlan-*`, `monthPlan-*`); one-time import of legacy
  `weekly-habits-*` keys into `habits-store`.
- **Gap:** no **MongoDB** persistence layer yet (`cogs` database — collections for
  items, plans, habits, reviews, etc.), a numbered **schema migration** runner,
  or one-click **JSON export/import** of all data. None exist yet. This is the
  single largest architectural gap. MongoDB was chosen over the spec's SQLite
  recommendation for: schemaless/flexible documents (unified `Item` + custom
  attributes), text indexes and Atlas Search for **fuzzy search**, vector indexes
  for future **semantic search**, aggregation pipelines for **advanced search and
  routing**, and native BSON/JSON interchange.
- 🕓 Sync / multi-device / iOS PWA path is deferred by the spec.

## §4 Inbox / Capture
- §4.2 Quick Add — ✅ `components/quick-add.tsx`.
- §4.3 Bulk Add — ✅ `components/enhanced-bulk-add.tsx` (colon-category syntax,
  auto-creates categories, routes to inbox).
- §4.4 Clarification — 🟡 `components/inbox.tsx` (`TaskClarificationDialog`).
  Works, but still task-only (no type switching among task/note/event/log).
- §4.5 Inbox vs. review queue — 🟡 Inbox exists; Review header surfaces pending
  period reviews but a separate "needs attention" queue is not built.

## §5 Item Data Model — 🟡 (most important refactor target)
- Current model: `lib/types.ts` `Task` (rich, but carries **duplicate fields**
  the spec wants merged: `category` vs `categories`, `entropy` vs
  `cognitiveLoad`, `context` vs tags). Separate interfaces for habits
  (`WeeklyTask`), events (`CalendarEvent`), time-grid intervals, reviews
  (`PeriodReview`), modules (`ModuleInstance`).
- **Gap vs §5.1–5.3:** no unified `Item` core (`id/type/title/body/status/
  categories/tags/links/rewardValue`). No generic `links` field; no `tags`
  distinct from `categories`; no `note`/`objective`/`review` item types.
- §5.4 Task fields — ✅ mostly present on `Task`.
- §5.5 Detail view — 🟡 `components/task-detail-popup.tsx` +
  `components/enhanced-task-detail.tsx` (consolidation pending).
- §5.6 Recurrence — 🟡 `Task.repeatSettings` exists in types; habit bridge
  is conceptual.

## §6 Next Actions / Lists — ✅/🟡
- Renamed **Lists** tab; Win98 file-manager UI — ✅
  `components/Lists/enhanced-category-view.tsx` + `filemanager98.css`.
- Folders, drag-and-drop, smart Home lists (Daily/Weekly/Monthly To-Do + Habits),
  four folder views (Icons/List/Details/Cards), four list display modes — ✅.
- Custom attributes per list (reorderable), CSV import, orb icons + gallery — ✅
  (`attribute-editor.tsx`, `lib/csv.ts`, `lib/orbs-manifest.ts`,
  `lib/lists-ui-store.ts`).
- Per-folder **All Items** uncategorized pool — ✅ `lib/folder-all-items.ts`.
- Category shape — ✅ `TaskCategory`; **Gap:** no `parentCategoryId` for nesting
  (§6.2).
- Completed view, settings, search — ✅.
- Points on complete — ✅ `resolveCompletionPoints()` in `lib/item-utils.ts`
  (default 1, or numeric **Points** list attribute).
- §6.5 "to schedule" as a **tag** (not category) — ⛔ tags don't exist yet.

## §7 Scheduler & Calendar — ✅/🟡
- Period funnel Always→Year→Month→Week→Day — ✅
  `components/Scheduler/enhanced-scheduler.tsx`.
- Calendar Month/Week/Day views — ✅ `components/Home/Plan/*`.
- §7.3 single source of truth — 🟡 scheduling fields shared via task-store;
  panels compute filtered lists independently (`lib/item-utils.ts` helpers).
- Persisted plan text — 🟡 saved via `lib/plan-text.ts` to localStorage (immediate
  save on edit in day/week/month views); target is MongoDB-backed plan documents
  (`plans` collection keyed by period).
  Plan text + `planReflection` shown in Reviews — ✅.
- §7.5 Events with linked checklist — 🟡 events exist (`CalendarEvent`,
  `event-store.ts`); generic linked-checklist not implemented.
- §7.6 Auto-scheduling — 🕓 deferred (constraint fields retained on `Task`).
- §7.7 Carry-over logic — 🟡 partial: Review dialog offers push-forward per task;
  no automatic end-of-period carry-over batch.

## §8 Home Dashboard — ✅/🟡
- Tabbed dashboard (Habits/Plan/To-Do/Goals/**Tracking**) + top bar — ✅
  `components/Home/home-dashboard.tsx`, `app/page.tsx`.
- **Today's Progress** quickview (to-do + habit completion) — ✅
  `daily-progress-quickview.tsx` (replaces old Quick Actions card).
- Points stats — ✅ `components/Home/points-stats.tsx`.
- §8.4 To-Do tiers + Q/I + overdue — ✅ `components/Home/ToDo/todo-panel.tsx`.
- §8.7 Review entry points — 🟡 Review button in global header with pending badge;
  no dashboard banners yet.

## §9 Habit Tracker — ✅/🟡
- Five habit types, week/day grid, daily/weekly/monthly frequency tabs,
  per-day/per-week % — ✅ `components/Home/Habits/*`, `lib/calculations.ts`.
- Shared store — ✅ `lib/habits-store.ts` (Home + Lists Daily Habits read/write
  the same data).
- §9.4 completion records keyed by ISO/local date — ✅ (`WeeklyData` keyed by
  date string). **Gap:** not a DB record; habits are `WeeklyTask`, not a unified
  `Habit` item.
- §9.5 Streaks — ⛔ not computed/shown (Analytics heatmap shows daily % only).

## §10 Goals & Objectives — 🟡
- Goals tab — 🟡 `components/Home/Goals/goals-tracker.tsx` with persisted
  `lib/goals-store.ts` and point rewards on completion.
- **Gap:** no `Objective` entity, no goal↔objective↔action linking, no
  multi-horizon objectives, no milestone (`custom-range`) objectives.

## §11 Modules — 🟡 (spec §8 extension)
- User-composed dashboard widgets — ✅ `components/Modules/modules-panel.tsx`,
  `lib/modules-store.ts` (list-explorer, writing-prompt, random-task,
  list-summary, analytics-stat).

## §12 Tracking / Activity Log — 🟡
- TimeGrid minute painter — ✅ `lib/time-tracking-store.ts` +
  `components/Home/Tracking/time-grid.tsx`; header **Tracking** button opens the
  same grid in a dialog (`cognitive-state.tsx`).
- Scopes (Activity/Location/Mood) with configurable pens — ✅.
- **Gap vs §12.2/12.4:** interval shape differs from spec's `LogEntry`
  (no `nextPlanned`, no structured geo, no `source` field). Not a unified
  `log` Item. Old `tracking-store.ts` / slider form removed.

## §13 Reviews — 🟡
- Period reviews — 🟡 `components/Reviews/reviews.tsx` + `lib/reviews-store.ts`.
  Supports day/week/month/quarter/year with carry-over prompts, gratitude,
  reflection questions, saved plan text, and `planReflection`.
- **Gap:** no `spawnedItems`, no scheduled prompting beyond header badge,
  no task post-mortems (§13.7), although `TaskCompletionReview` type exists.

## §14 Points, Rewards & Regret — 🟡
- Points ledger — ✅ `lib/points-store.ts` (task/habit/goal completions,
  day/week/month totals + possible).
- List completion points — ✅ `resolveCompletionPoints()` (default 1 or **Points**
  attribute).
- **Gap:** objective point sources; configurable multipliers (urgency/consistency);
  retroactive adjustment.
- §14.4 Regret accrual — ⛔ not implemented.

## §15 Analytics — 🟡
- Real charts — 🟡 `components/Analytics/enhanced-analytics.tsx` now uses
  recharts: habit heatmap + completion bars, points trends, TimeGrid
  distribution, saved reviews browser.
- **Gap vs spec's eight v1 views:** plan-vs-reality, cognitive-state trends,
  category performance, and several others not yet built as dedicated views.
- §15.3 predictive analytics — 🕓 deferred.

## §16 AI-Readiness — 🕓
No AI features required for v1. Keep timestamps/structured types/free-text fields
and a generic `links` mechanism so an AI layer can be added later.

## §17 V1 Scope & Build Order
The spec's suggested build order remains a good sequence. Export/import (§3.2)
should land first.

## §18 Resolved Contradictions
Reference notes; no code.

---

## Highest-leverage next steps (incremental path)
1. **§3** Storage abstraction + one-click JSON export/import over all stores,
   then wire MongoDB via the Electron main process (local `mongod` or Atlas;
   text/vector indexes for search roadmap).
2. **§5** Add `tags`, generic `links`, and `parentCategoryId` (additive) before
   consolidating duplicate fields.
3. **§14/§7.7** Regret accrual + automatic carry-over (small, high value).
4. **§15** Remaining Analytics views (plan-vs-reality, category performance, …).
5. **§10/§13** Flesh out Objectives and full Reviews cadence (spawned items,
   post-mortems, scheduled prompts).
