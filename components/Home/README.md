# `components/Home/` — Home Dashboard

The Home tab is the default screen each session. It combines a header row (date, points, today's progress, review banner), a **Needs Attention** queue card, and five sub-tabs: **Habits**, **Plan**, **To Do**, **Goals**, and **Tracking**.

## Files

| File | Purpose |
|------|---------|
| `home-dashboard.tsx` | Container: date card, `PointsStats`, `DailyProgressQuickview`, review banner, `NeedsAttention` card, the five sub-tabs, and a shared `TaskDetailPopup` |
| `home-review-banner.tsx` | Surfaces due end-of-period reviews (§8.7); links to header Review dropdown |
| `points-stats.tsx` | All Time / Today / This Week / This Month points cards with progress bars (`lib/points-store` + `lib/task-store`) |
| `daily-progress-quickview.tsx` | Header card showing today's to-do and daily-habit completion (% done, items left) |
| `NeedsAttention.tsx` | Read-only triage card: surfaces tasks that have slipped or are stuck (overdue / blocked / unclarified / stale), grouped by reason with badges. Reads `taskRepository.getAll()`, runs the pure `getNeedsAttention` selector from `lib/needs-attention.ts`, and routes row clicks to the dashboard's `TaskDetailPopup` via `onOpenItem`. Collapsible; performs no mutations. See `NeedsAttention.notes.md`. |

## Shared date

The dashboard uses `lib/use-current-date.ts` for a single **selected day** shared by the header, points, progress, Plan panel, Day Log, and daily habit grid. The date advances at local midnight; main and Tracking sub-tabs persist in `localStorage`.

## Subfolders

| Folder | Sub-view |
|--------|----------|
| `Habits/` | Daily / weekly / monthly habit tracker |
| `Plan/` | Month / Week / Day calendar + plan text |
| `ToDo/` | Tier-based day/week/month to-do |
| `Goals/` | All-time **Objectives** (prioritizable per period) + quantifiable **Goals** that serve them, plus a Direction report |
| `Tracking/` | TimeGrid life tracker + actual day log |

## Layout

```
┌─────────────────────────────────────────────────┐
│ Review banner (when due)                        │
├─────────────────────────────────────────────────┤
│ Date + PointsStats          │ Today's Progress  │
├─────────────────────────────────────────────────┤
│ Habits │ Plan │ To Do │ Goals │ Tracking       │
├─────────────────────────────────────────────────┤
│           (active sub-view)                     │
└─────────────────────────────────────────────────┘
```

## Stores

| Sub-view | Primary store(s) |
|----------|------------------|
| Habits | `lib/habits-store.ts` |
| Plan | `lib/task-store.ts`, `lib/event-store.ts`, plan text via `lib/plan-text.ts` (localStorage) |
| To Do | `lib/task-store.ts` |
| Goals | `lib/goals-store.ts` |
| Tracking | `lib/time-tracking-store.ts`, `lib/task-store.ts`, `lib/event-store.ts` |

The header **Needs Attention** card reads from `lib/task-store.ts` (via `lib/data/task-repository.ts`) and derives its rows with the pure selector in `lib/needs-attention.ts` (+ `lib/needs-attention.test.ts`).

See each subfolder's `README.md` for file-level detail.
