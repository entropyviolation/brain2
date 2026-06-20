# COGS — Cognitive Offloading and Getting Stuff Done

COGS is a personal **cognitive management system**: a single application that
captures the full range of a person's working thoughts (reminders, to-dos,
ideas, plans, activity/feeling logs, and reflections) and organizes them into a
small number of interconnected structures — an **Inbox**, **Lists** (categories
and folders), a **Scheduler/Calendar**, **Goals**, **Habits**, **Time
Tracking**, **Modules**, **Reviews**, and **Analytics**.

This repository implements **COGS v1**, evolved toward the **"COGS v2"
specification** (`Cognitive_Management_System_Spec.docx`). See
[`docs/SPEC_MAPPING.md`](docs/SPEC_MAPPING.md) for a section-by-section mapping of
the spec to the code, including what is implemented, partial, or deferred.

> **Documentation convention:** nearly every source file begins with a `/** ... */`
> header explaining its purpose and the spec section(s) it implements, and every
> major folder has a `README.md`. Start with this file, then `docs/SPEC_MAPPING.md`,
> then the folder README nearest the code you're reading.

---

## Tech stack

- **Next.js 15** (App Router) + **React 19**, exported as a fully static site
  (`output: "export"` → `out/`).
- **TypeScript**, **Tailwind CSS**, **shadcn/ui** (Radix-based primitives in
  `components/ui/`), **lucide-react** icons, **recharts** for Analytics.
- **Windows 95 skin** — global retro chrome via `app/win95.css` (`body.win95-app`);
  Lists panel adds its own Win98 file-manager layer (`components/Lists/filemanager98.css`).
- **Zustand** stores with `persist` middleware for state, currently backed by
  the browser's **localStorage** (migrating to **MongoDB** for a flexible
  document model, semantic/fuzzy/advanced search, and aggregation-based routing
  — see `docs/SPEC_MAPPING.md` §3).
- **Electron** desktop shell (`electron/`) that serves the static export via a
  custom `app://` protocol. The same build also runs as a plain web app.

## Architecture at a glance

```
Next.js (static export, all client-side)
        │  data persisted via Zustand + localStorage (today)
        │  (+ plan text keys, legacy habit import)
        │  planned: MongoDB via Electron IPC (cogs database)
        ▼
out/ (HTML/CSS/JS + public assets)
        │  loaded by
        ▼
Electron main process (electron/main.js)  →  desktop window
        │  planned: MongoDB connection + search indexes
        ▼
MongoDB (local mongod or Atlas) — flexible documents, text/vector search
```

There is **no server and no API layer today** — every feature runs in the
renderer and reads/writes localStorage through the Zustand stores in `lib/` (plus
a few direct localStorage helpers for plan text). The planned **MongoDB** layer
(via Electron IPC) will become the durable source of truth; Zustand will remain
the reactive UI cache.

### Application map

```
app/page.tsx
├── Header: Review | Tracking | Inbox | Bulk Add | Quick Add
└── Tabs
    ├── Home ────── Habits | Plan | To Do | Goals | Tracking
    ├── Lists ───── Win98 file manager (folders, lists, items, orb gallery)
    ├── Scheduler ─ Always → Year → Month → Week → Day funnel
    ├── Modules ─── User-composed widgets (list explorer, prompts, …)
    └── Analytics ─ Charts over tasks, habits, points, tracking, reviews
```

Selecting a task from **Lists** opens the full-screen task detail view
(`components/enhanced-task-detail.tsx`).

## Getting started

```bash
npm install --legacy-peer-deps   # react-day-picker peer-dep needs this flag
npm run dev                      # web dev server at http://localhost:3000
npm run electron:dev             # Next dev server + Electron window
npm run build                    # static export to out/
npm run electron:build           # package desktop installers into dist/
```

## Repository map

| Path | What lives here | README |
|------|-----------------|--------|
| `app/` | Next.js App Router entry: layout, single page, global + Win95 CSS | [`app/README.md`](app/README.md) |
| `components/` | All React UI — modules, dialogs, shared widgets | [`components/README.md`](components/README.md) |
| `components/Home/` | Home dashboard (Habits, Plan, ToDo, Goals, Tracking) | [`components/Home/README.md`](components/Home/README.md) |
| `components/Lists/` | Lists file manager (folders, attributes, orb gallery) | [`components/Lists/README.md`](components/Lists/README.md) |
| `components/Scheduler/` | Period scheduling funnel | [`components/Scheduler/README.md`](components/Scheduler/README.md) |
| `components/Modules/` | Composable dashboard modules | [`components/Modules/README.md`](components/Modules/README.md) |
| `components/Analytics/` | Metrics and charts | [`components/Analytics/README.md`](components/Analytics/README.md) |
| `components/Reviews/` | End-of-period review ritual (header) | [`components/Reviews/README.md`](components/Reviews/README.md) |
| `components/ui/` | shadcn/ui primitives (Button, Dialog, Tabs, …) | [`components/ui/README.md`](components/ui/README.md) |
| `lib/` | Data model types, Zustand stores, pure helpers | [`lib/README.md`](lib/README.md) |
| `electron/` | Desktop shell: main process + preload | [`electron/README.md`](electron/README.md) |
| `docs/` | Spec→code mapping and screen write-ups | [`docs/README.md`](docs/README.md) |
| `docs/screenshots/` | PNG captures + per-screen `.txt` write-ups (9 views) | [`docs/README.md`](docs/README.md) |
| `public/` | Static assets: orb PNGs (`orbs-removebackground/`), fonts, icons, link connectors | — |
| `hooks/` | Reserved for shared hooks (currently README only) | [`hooks/README.md`](hooks/README.md) |
| `out/` | Built static export (generated by `npm run build`) | [`out/README.md`](out/README.md) |

### Home subfolders

| Path | README |
|------|--------|
| `components/Home/Habits/` | [`README.md`](components/Home/Habits/README.md) |
| `components/Home/Plan/` | [`README.md`](components/Home/Plan/README.md) |
| `components/Home/ToDo/` | [`README.md`](components/Home/ToDo/README.md) |
| `components/Home/Goals/` | [`README.md`](components/Home/Goals/README.md) |
| `components/Home/Tracking/` | [`README.md`](components/Home/Tracking/README.md) |

## Data layer (summary)

Ten Zustand stores in `lib/` persist to **localStorage** today. The planned
**MongoDB** `cogs` database (via Electron IPC) will become the durable source of
truth — flexible documents, text/vector search indexes, and aggregation pipelines
for advanced search and routing. Key store examples:

| Store | Key | Used for |
|-------|-----|----------|
| `task-store` | `cogs-task-storage` | Tasks, categories, folders |
| `habits-store` | `cogs-habits-store` | Habit definitions + weekly completion data |
| `time-tracking-store` | `cogs-timegrid-store` | TimeGrid scopes, pens, intervals |
| `reviews-store` | `cogs-reviews-store` | Period reviews |
| `lists-ui-store` | `cogs-lists-ui` | Lists UI prefs, orb gallery |

Plan free-text uses interim `plan-text.ts` helpers (`dayPlan-*`, `weekPlan-*`,
`monthPlan-*` keys); target is MongoDB `plans` collection. Full file-by-file
detail: [`lib/README.md`](lib/README.md).

## Status vs. the v2 spec (summary)

**Implemented in some form:** Inbox / Quick Add / Bulk Add; **Lists** board with
Win98-style folders, custom attributes, orb icons, CSV import, and per-folder All
Items; Scheduler period funnel (Always→Year→Month→Week→Day); Home dashboard
(Habits / Plan / To Do / Goals / Tracking); five habit types with shared
`habits-store`; TimeGrid tracking (header + Home Tracking tab); period **Reviews**
with plan text and reflection; **Modules** dashboard; points on task/habit/goal
completion; Analytics charts.

**Not yet matching the spec** (tracked in `docs/SPEC_MAPPING.md`): MongoDB storage
layer (flexible documents, text/vector search indexes) + JSON export/import +
schema migrations (§3), unified Item data model with de-duplicated fields (§5),
full Goals→Objectives modeling (§10), complete Reviews cadence set (§13), Regret
accrual (§14), the eight real Analytics views (§15), and full carry-over logic
(§7.7).
