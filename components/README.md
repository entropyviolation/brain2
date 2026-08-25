# `components/` — All React UI

Every React component in COGS lives here. Top-level files are cross-cutting dialogs and shared widgets; each subfolder is one **module** surfaced from the main tab bar in `app/page.tsx`.

## Top-level tabs (from `app/page.tsx`)

| Tab | Folder | Purpose |
|-----|--------|---------|
| Home | `Home/` | Dashboard: habits, plan, to-do, goals, tracking |
| Lists | `Lists/` | Win98-style file manager for lists, folders, and items |
| Docs | `Docs/` | WYSIWYG document workspace over `note` items (fonts, images, PDF ingest) |
| Scheduler | `Scheduler/` | Progressive period funnel (Always → Year → Month → Week → Day) + dependency/gantt views |
| Operations | `Operations/` | Directed enterprises: phases, heatmap, to-do-next, post-mortem |
| Modules | `Modules/` | User-built mini-app **workspaces** (Itinerary / Cleaning / Budget / Book Tasting / Film DNA templates + custom views) and dashboard widgets |
| Analytics | `Analytics/` | Charts and summaries over tasks, habits, points, tracking, reviews, plus Brain2 views |

The global header (all tabs) also renders: **Review** (`Reviews/`), **Settings** (`Settings/SettingsDialog.tsx` — backup/restore + Second Brain setup), **Tracking** (`cognitive-state.tsx` → TimeGrid), **Inbox**, **Bulk Add**, **From Notes** (`notes-ingest.tsx` — Apple Notes ingest on the Mac desktop app), and **Quick Add**. A global **Cmd/Ctrl-K** search palette (`Search/`) and the global **completion popup** (`Completion/`, fires on every task completion) are mounted app-wide.

## Subfolders

| Folder | Module |
|--------|--------|
| `Home/` | Home dashboard and its Habits / Plan / ToDo / Goals (Objectives + Goals) / Tracking sub-views |
| `Completion/` | Global task-completion popup — fires on every completion to capture objective/goal contributions + multipliers |
| `Lists/` | Lists file manager (formerly "Next Actions") — orchestrator + `hooks/`, `views/`, `dialogs/`, `list-content/`, `navigation/`, `toolbar/`, `attributes/`, `lib/` subfolders |
| `Docs/` | Docs tab — `DocsPanel` + `DocumentEditor` over `note` items |
| `Scheduler/` | Period scheduling funnel + `DependencyGraph` / `GanttView` (critical path) |
| `Operations/` | Operation workspaces (phases, heatmap, log, to-do-next) |
| `Modules/` | Module platform — full-screen workspaces (`workspace/`, incl. itinerary + filmrecs views) + dashboard widgets |
| `Analytics/` | Metrics and charts, including Brain2 views (calibration, streaks, plan-vs-reality, regret, correlations, context-switch heatmap) |
| `ItemDetail/` | Consolidated item/task detail — full-screen page (`ItemDetailPage`) + popup (`ItemDetailPopup`), shared `useItemDetailDraft`, tag/link/related-items panels |
| `Editor/` | Rich-text/markdown body editor (`RichTextEditor`) + `markdown.ts` serialization, `editor.css` |
| `Focus/` | `JustStartMode` — ADHD anti-paralysis overlay (one smallest step + 2-minute timer) |
| `Search/` | `GlobalSearch` Cmd/Ctrl-K command palette + `useGlobalSearchHotkey` |
| `Settings/` | `SettingsDialog` header entry — `BackupRestore` (full app JSON backup/restore) + Second Brain setup; live sync is parked (see `LiveSync/`) |
| `LiveSync/` | Parked continuous live sync host — no-op until a semi-mobile live sync component lands |
| `Mobile/` | Sideloadable Home + Lists shell (`/mobile`); manual hub pull only while live sync is paused |
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
| `notes-ingest.tsx` | From Notes — date range, title+body preview, parse/skip; bulk-add (`ListName:` then items) or park full text on **notes to ingest** |
| `inbox.tsx` | Inbox dialog + per-task clarification flow |
| `cognitive-state.tsx` | Header **Tracking** button; opens `TimeGrid` in a dialog (name kept for wiring compatibility) |
| `task-detail-popup.tsx` | Barrel → `ItemDetail/ItemDetailPopup.tsx` (`TaskDetailPopup`); compact modal detail used by Scheduler, Plan, ToDo, Lists |
| `enhanced-task-detail.tsx` | Barrel → `ItemDetail/ItemDetailPage.tsx` (`EnhancedTaskDetail`); full-screen detail when a task is selected from Lists |

## From Notes (Apple Notes ingest)

Header **From Notes** (`notes-ingest.tsx`). **Mac desktop app only** — it talks to Notes.app over Electron IPC (`window.desktop.fetchAppleNotes`) so iCloud-synced iPhone notes and On My Mac notes can be listed. The first run may prompt macOS Automation permission for Notes.

Flow:

1. Pick a **date range** (dialog opens immediately; listing shows a spinner).
2. **Parse / skip** each note. The card shows the **title plus a content preview** (snippet fetched per card, not the whole library).
3. For each parsed note: freely edit **bulk-add** syntax (`ListName:` then items), or **Save for later ingestion**.
4. Parked notes go in an auto-created Lists folder **iPhone Notes Ingest**, list **notes to ingest**, with the **full note body** (not title-only). Bulk-add writes real items onto the named lists.
5. Apple Note ids that were already bulk-added or parked are **skipped** on later runs (`appleNoteId` on items + `cogs-apple-notes-ingested-ids`).

Helpers: `lib/apple-notes.ts`. Native reader: `electron/apple-notes.js` + `electron/apple-notes.jxa` (modes `preview` / `snippet` / `bodies`).

## Data stores (see `lib/`)

Components read/write Zustand stores (localStorage-backed) — the offline-first
source of truth. A future opportunistic `SyncingDataSource` reconciles with
**MongoDB Atlas** in the background (not a replacement for the local store) and a
shared `@cogs/core` package will hold this data layer for web/desktop/mobile (see
`docs/SPEC_MAPPING.md` §3 and [`docs/ROADMAP.md`](../docs/ROADMAP.md)). Plan text
still uses interim localStorage helpers via `plan-text.ts`:

| Store | Used by |
|-------|---------|
| `task-store` | Lists, Scheduler, Plan, ToDo, Inbox, Modules, From Notes ingest |
| `habits-store` | Home Habits, Lists Daily Habits, Analytics |
| `goals-store` | Home Goals |
| `event-store` | Plan panel, Actual Day View |
| `points-store` | Points stats, completions across app |
| `time-tracking-store` | TimeGrid, Analytics Tracking tab |
| `reviews-store` | Reviews header, Analytics Reviews tab |
| `modules-store` | Modules panel |
| `item-type-store` | Item type registry (built-in `task` + user-defined types; Second Brain setup) |
| `lists-ui-store` | Lists UI prefs (folder view, icon positions, orb gallery) |

A growing pure-logic layer in `lib/` (e.g. `search`, `links`,
`graph-layout`, `calibration`, `streaks`, `plan-vs-reality`, `critical-path`,
`priority`, `needs-attention`, `decision-matrix`) and a `lib/data/` data layer
(`DataSource` sources + Mongo collections/schemas + JSON `backup`) and
`lib/services/` (completion / review / scheduling) back these components.

## Notes

- `task-detail-popup.tsx` and `enhanced-task-detail.tsx` are now thin re-export barrels; the real implementations are consolidated under `components/ItemDetail/`.
- Lists module hooks live in `components/Lists/hooks/` (not top-level `hooks/`).
- Deleted/removed from tree: `NextActions/`, top-level `Tracking/` (the current `Tracking/` is the new `MetricLogger`), `theme-provider.tsx`, `daily-review.tsx`, many unused `ui/` primitives.
- See each subfolder's `README.md` for file-level detail.
