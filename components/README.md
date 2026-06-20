# `components/` — All React UI

Every React component in COGS lives here. Top-level files are cross-cutting dialogs and shared widgets; each subfolder is one **module** surfaced from the main tab bar in `app/page.tsx`.

## Top-level tabs (from `app/page.tsx`)

| Tab | Folder | Purpose |
|-----|--------|---------|
| Home | `Home/` | Dashboard: habits, plan, to-do, goals, tracking |
| Lists | `Lists/` | Win98-style file manager for lists, folders, and items |
| Scheduler | `Scheduler/` | Progressive period funnel (Always → Year → Month → Week → Day) |
| Modules | `Modules/` | User-composed widgets (list explorer, writing prompts, etc.) |
| Analytics | `Analytics/` | Charts and summaries over tasks, habits, points, tracking, reviews |

The global header (all tabs) also renders: **Review** (`Reviews/`), **Tracking** (`cognitive-state.tsx` → TimeGrid), **Inbox**, **Bulk Add**, and **Quick Add**.

## Subfolders

| Folder | Module |
|--------|--------|
| `Home/` | Home dashboard and its Habits / Plan / ToDo / Goals / Tracking sub-views |
| `Lists/` | Lists file manager (formerly "Next Actions") — orchestrator + `hooks/`, `views/`, `dialogs/`, `list-content/` subfolders |
| `Scheduler/` | Period scheduling funnel |
| `Modules/` | Composable dashboard modules |
| `Analytics/` | Metrics and charts |
| `Reviews/` | End-of-period review ritual (header dropdown) |
| `ui/` | shadcn/ui primitives used across modules |

## Top-level files

| File | Purpose |
|------|---------|
| `quick-add.tsx` | Single-field capture → new inbox task |
| `enhanced-bulk-add.tsx` | Multi-line capture with optional `Category:` syntax |
| `inbox.tsx` | Inbox dialog + per-task clarification flow |
| `cognitive-state.tsx` | Header **Tracking** button; opens `TimeGrid` in a dialog (name kept for wiring compatibility) |
| `task-detail-popup.tsx` | Compact modal task detail (Scheduler, Plan, ToDo, Lists) |
| `enhanced-task-detail.tsx` | Full-screen task editor when a task is selected from Lists |

## Data stores (see `lib/`)

Components read/write Zustand stores today (localStorage-backed); the planned
**MongoDB** layer will become the durable source of truth while Zustand remains
the reactive UI cache (see `docs/SPEC_MAPPING.md` §3). Plan text still uses
interim localStorage helpers via `plan-text.ts`:

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
| `lists-ui-store` | Lists UI prefs (folder view, icon positions, orb gallery) |

## Notes

- `task-detail-popup.tsx` and `enhanced-task-detail.tsx` are two detail views; consolidation is a future target.
- Lists module hooks live in `components/Lists/hooks/` (not top-level `hooks/`).
- Deleted/removed from tree: `NextActions/`, `Tracking/` (top-level), `theme-provider.tsx`, `daily-review.tsx`, many unused `ui/` primitives.
- See each subfolder's `README.md` for file-level detail.
