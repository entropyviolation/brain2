# `components/` — All React UI

Every React component in COGS lives here. Top-level files are cross-cutting dialogs and shared widgets; each subfolder is one **module** surfaced from the main tab bar in `app/page.tsx`.

## Top-level tabs (from `app/page.tsx`)

| Tab | Folder | Purpose |
|-----|--------|---------|
| Home | `Home/` | Dashboard: habits, plan, to-do, goals, tracking |
| Lists | `Lists/` | Win98-style file manager for lists, folders, and items |
| Scheduler | `Scheduler/` | Progressive period funnel (Always → Year → Month → Week → Day) + dependency/gantt views |
| Modules | `Modules/` | User-built mini-app **workspaces** (Itinerary / Cleaning / Budget templates + custom views) and dashboard widgets |
| Graph | `Graph/` | Force-directed knowledge graph over all items and their typed `links` |
| Analytics | `Analytics/` | Charts and summaries over tasks, habits, points, tracking, reviews, plus Brain2 views |

The global header (all tabs) also renders: **Review** (`Reviews/`), **Settings** (`Settings/SettingsDialog.tsx` — backup/restore + Second Brain setup), **Tracking** (`cognitive-state.tsx` → TimeGrid), **Inbox**, **Bulk Add**, and **Quick Add**. A global **Cmd/Ctrl-K** search palette (`Search/`) and the global **completion popup** (`Completion/`, fires on every task completion) are mounted app-wide.

## Subfolders

| Folder | Module |
|--------|--------|
| `Home/` | Home dashboard and its Habits / Plan / ToDo / Goals (Objectives + Goals) / Tracking sub-views |
| `Completion/` | Global task-completion popup — fires on every completion to capture objective/goal contributions + multipliers |
| `Lists/` | Lists file manager (formerly "Next Actions") — orchestrator + `hooks/`, `views/`, `dialogs/`, `list-content/`, `navigation/`, `toolbar/`, `attributes/`, `lib/` subfolders |
| `Scheduler/` | Period scheduling funnel + `DependencyGraph` / `GanttView` (critical path) |
| `Modules/` | Module platform — full-screen workspaces (`workspace/`) + dashboard widgets |
| `Analytics/` | Metrics and charts, including Brain2 views (calibration, streaks, plan-vs-reality, regret, correlations, context-switch heatmap) |
| `Graph/` | `KnowledgeGraph` (top-level tab) + reusable `LinkGraph` over typed item links |
| `ItemDetail/` | Consolidated item/task detail — full-screen page (`ItemDetailPage`) + popup (`ItemDetailPopup`), shared `useItemDetailDraft`, tag/link/related-items panels |
| `Editor/` | Rich-text/markdown body editor (`RichTextEditor`) + `markdown.ts` serialization, `editor.css` |
| `Focus/` | `JustStartMode` — ADHD anti-paralysis overlay (one smallest step + 2-minute timer) |
| `Search/` | `GlobalSearch` Cmd/Ctrl-K command palette + `useGlobalSearchHotkey` |
| `Settings/` | `SettingsDialog` header entry — `BackupRestore` (full app JSON backup/restore) + Second Brain setup |
| `Reviews/` | End-of-period review ritual (header dropdown) + `MorningReview`, `PostMortemDialog` |
| `Tracking/` | `MetricLogger` — quick self-tracking metric capture |
| `Icons/` | Shared icon system — `Icon`, `OrbPicker`, `icon-registry`, barrel `index.ts` |
| `spreadsheet/` | Reusable Google-Sheets-style editable grid (`SheetGrid`) used by Lists + Module spreadsheet views |
| `ui/` | shadcn/ui primitives used across modules |

## Top-level files

| File | Purpose |
|------|---------|
| `quick-add.tsx` | Single-field capture → new inbox task |
| `enhanced-bulk-add.tsx` | Multi-line capture with optional `Category:` syntax |
| `inbox.tsx` | Inbox dialog + per-task clarification flow |
| `cognitive-state.tsx` | Header **Tracking** button; opens `TimeGrid` in a dialog (name kept for wiring compatibility) |
| `task-detail-popup.tsx` | Barrel → `ItemDetail/ItemDetailPopup.tsx` (`TaskDetailPopup`); compact modal detail used by Scheduler, Plan, ToDo, Lists |
| `enhanced-task-detail.tsx` | Barrel → `ItemDetail/ItemDetailPage.tsx` (`EnhancedTaskDetail`); full-screen detail when a task is selected from Lists |

## Data stores (see `lib/`)

Components read/write Zustand stores (localStorage-backed) — the offline-first
source of truth. A future opportunistic `SyncingDataSource` reconciles with
**MongoDB Atlas** in the background (not a replacement for the local store) and a
shared `@cogs/core` package will hold this data layer for web/desktop/mobile (see
`docs/SPEC_MAPPING.md` §3 and [`docs/ROADMAP.md`](../docs/ROADMAP.md)). Plan text
still uses interim localStorage helpers via `plan-text.ts`:

| Store | Used by |
|-------|---------|
| `task-store` | Lists, Scheduler, Plan, ToDo, Inbox, Modules |
| `habits-store` | Home Habits, Lists Daily Habits, Analytics |
| `goals-store` | Home Goals |
| `event-store` | Plan panel, Actual Day View |
| `points-store` | Points stats, completions across app |
| `time-tracking-store` | TimeGrid, Analytics Tracking tab |
| `reviews-store` | Reviews header, Analytics Reviews tab |
| `modules-store` | Modules panel |
| `item-type-store` | Item type registry (built-in `task` + user-defined types; Second Brain setup) |
| `lists-ui-store` | Lists UI prefs (folder view, icon positions, orb gallery) |

A growing pure-logic layer in `lib/` (e.g. `search`, `links`, `link-graph`,
`graph-layout`, `calibration`, `streaks`, `plan-vs-reality`, `critical-path`,
`priority`, `needs-attention`, `decision-matrix`) and a `lib/data/` data layer
(`DataSource` sources + Mongo collections/schemas + JSON `backup`) and
`lib/services/` (completion / review / scheduling) back these components.

## Notes

- `task-detail-popup.tsx` and `enhanced-task-detail.tsx` are now thin re-export barrels; the real implementations are consolidated under `components/ItemDetail/`.
- Lists module hooks live in `components/Lists/hooks/` (not top-level `hooks/`).
- Deleted/removed from tree: `NextActions/`, top-level `Tracking/` (the current `Tracking/` is the new `MetricLogger`), `theme-provider.tsx`, `daily-review.tsx`, many unused `ui/` primitives.
- See each subfolder's `README.md` for file-level detail.
