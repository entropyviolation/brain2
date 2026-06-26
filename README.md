# COGS — Cognitive Offloading and Getting Stuff Done

COGS is a personal **cognitive management system**: a single application that
captures the full range of a person's working thoughts (reminders, to-dos,
ideas, plans, activity/feeling logs, and reflections) and organizes them into a
small number of interconnected structures — an **Inbox**, **Lists** (categories
and folders), a **Scheduler/Calendar**, **Goals**, **Habits**, **Time
Tracking**, **Modules**, **Reviews**, and **Analytics**.

## The eventual vision

What exists in this repository today is an **early, working version** of a much
larger ambition. The long-term goal of COGS is to become a **revolutionary
personal knowledgebase and time-management tool** — one where a single, deeply
flexible **item** primitive composes into a mathematically rich, densely
interconnected network of **types, subtypes, categories, tags, attributes, and
lists**. Those structures combine to form a living, functioning model of your
ideas, tasks, plans, goals, next actions, habits, and routines — and crucially,
they let you track **how your plans actually matched reality** over time.

The aim is for COGS to do all of this at once:

- **A second brain.** Define your own item types ("Book", "Friend", "Project",
  "Idea") with custom attributes, link them together, and let categories, tags,
  and subtypes weave a dense network that mirrors how you actually think.
- **A planning and reflection engine.** Built-in **daily / weekly / monthly /
  quarterly / yearly reflections** assist planning, and the system continuously
  compares intentions against outcomes (plan-vs-reality).
- **A custom-module platform.** Users can compose extremely powerful, complex
  custom modules on top of the same data — turning COGS into whatever tool the
  moment demands.
- **A place to externalize everything.** Pour every idea and consideration into
  lists — reading lists, watch lists, vacation plans, decision matrices — then
  visualize, sort, and reason over them.
- **A self-tracking and analytics instrument.** Track yourself on any number of
  metrics at any time, then analyze that data to understand patterns and trends.

**Module platform (built):** the **Modules** tab is now a full place to compose
your own tools. Beyond single-card widgets, you can build full-screen
**workspaces** — mini-apps assembled from your own lists and a layout of bound
**views** (an editable spreadsheet, agenda, rollup summaries, a gamified
randomizer, a focus timer, checklists, a gallery, notes, plus specialized
**timeline**, **matcher**, **quiz**, **dashboard**, and **decision-matrix**
kinds). You can author per-module **workflows** ("Zapier for your data": a
trigger → conditions → actions that run on real item mutations) and **pop a
workspace out** into its own window. One-click **templates** scaffold the lists,
attribute schemas, seed data, views, and workflows for an **Itinerary Creator**,
a **Cleaning System**, a **Budget Tracker**, and a **Book Tasting** shelf — all on
the same `Item` / `ItemType` / attribute foundation, so the data also flows
through Lists, Scheduler, and Analytics. Reusable module **definitions**
(blueprints) can be saved, re-instantiated, and exported/imported.

**Google Sheets–style grids (built):** list/attribute data can be edited in a
spreadsheet display (`components/spreadsheet/SheetGrid.tsx`) — inline cells,
A1 column-letter headers + a row-number gutter, click-to-sort, free-text filter,
**drag + shift-click range selection** (with a Sum/Avg/Min/Max/Count summary
bar), **row & column resize**, freeze, a **fill handle** that copies down with
relative references, currency-aware totals, add-row/add-column, and **Delete** to
clear a range — available both as a Lists display mode and as a Module view.
Formulas come in two flavors: read-only column-level **formula** columns, and
**per-cell `=A1` formulas** (`=B2+C2`) typed into any cell. A1 evaluation +
fill-drag ref-shifting live in `lib/sheet-a1.ts` / `lib/sheet-eval.ts`; the
expression engine and cross-item formulas (`LOOKUP`/`COUNTIF`/`ROLLUP`/`IF`) in
`lib/formula.ts`.

**File & PDF attributes (built):** `file`/`multifile` attributes (`FileValue`)
attach documents to items; PDFs are text-extracted (`lib/file-extract.ts`, via an
Electron `pdf-parse` IPC handler with a graceful browser fallback) so they power
the Book Tasting matcher/quiz. Built-in **Book** and **Flight** item types and a
read-only external-data **connector** seam (weather stub, `lib/connectors.ts`)
also ship.

**Second-brain & knowledge features (built):** a **global Cmd/Ctrl-K search**
palette (`components/Search/`) over all items; a force-directed **Graph** tab
(`components/Graph/KnowledgeGraph.tsx`) visualizing items and their typed
**links**; a consolidated **item detail** surface (`components/ItemDetail/`) with
tags, typed links, related items, and a rich-text/markdown body
(`components/Editor/`); **Set up Second Brain** (Source/Belief item types) and
full **JSON backup/restore** from the header **Settings** dialog
(`components/Settings/`); and self-tracking via a quick **metric logger**
(`components/Tracking/`).

**Planning & analytics depth (built):** the **Scheduler** adds dependency and
**Gantt/critical-path** views; **Analytics** adds Brain2 views — **calibration**
(estimate vs. actual), **streaks**, **plan-vs-reality**, **regret**, correlation,
and context-switch heatmaps; **Reviews** add a morning review and per-task
**post-mortems**; and a **Focus / Just-Start** mode (`components/Focus/`) breaks
paralysis with one smallest step + a short timer. These are backed by pure logic
in `lib/` and a nascent data layer (`lib/data/` with Mongo collections/sources +
JSON backup) and domain `lib/services/`.

**Eventual expansion** (not yet built): deeper computed-attribute editing UX and
Notion/Google-Docs–style document items on top of the rich-text body above
(in-grid **formula** columns and cross-item rollups already exist).

The sections below describe **what actually runs today** — the foundation those
ambitions are being built on. Treat the vision above as direction, and the rest
of this document as ground truth.

## What this repository is today

This repository implements **COGS v1**, evolved toward the **"COGS v2"
specification** (`Cognitive_Management_System_Spec.docx`). See
[`docs/SPEC_MAPPING.md`](docs/SPEC_MAPPING.md) for a section-by-section mapping of
the spec to the code, including what is implemented, partial, or deferred.

The groundwork for the bigger vision is already visible in the data model: a
unified **`Item`** type with user-definable **types** (`ItemTypeDefinition`),
free-form **tags**, typed **links** between items, and flexible per-item/per-list
**attributes** (`lib/types.ts`). Today most behavior still flows through the
built-in **task** type, but the seams for the densely networked, fully
customizable system above are deliberately in place.

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
- **Zustand** stores with `persist` middleware for state, backed by the browser's
  **localStorage**. This local store stays the offline-first source of truth;
  **MongoDB Atlas** becomes a future *cloud sync target* (not a replacement) behind
  an opportunistic `SyncingDataSource` — see [`docs/brain2_features_roadmap.md`](docs/brain2_features_roadmap.md)
  and `docs/SPEC_MAPPING.md` §3.
- **Electron** desktop shell (`electron/`) that serves the static export via a
  custom `app://` protocol. The same build also runs as a plain web app.

## Architecture at a glance

```
Next.js (static export, all client-side)
        │  COMPLETE local store via Zustand + localStorage (offline source of truth)
        │  (+ plan text keys, legacy habit import)
        ▼
out/ (HTML/CSS/JS + public assets)
        │  loaded by
        ▼
Electron main process (electron/main.js)  →  desktop window (thin shell)
        ┊  future: opportunistic background sync, best-effort
        ▼
MongoDB Atlas (cloud) — sync target behind SyncingDataSource/RemoteDataSource
```

There is **no server and no API layer today** — every feature runs in the
renderer and reads/writes localStorage through the Zustand stores in `lib/` (plus
a few direct localStorage helpers for plan text). The app is **offline-first**: the
local store remains the working source of truth. A future opportunistic
`SyncingDataSource` reconciles with **MongoDB Atlas** in the background when online
so multiple devices (including a future mobile app) converge — without ever
blocking offline use. See [`docs/brain2_features_roadmap.md`](docs/brain2_features_roadmap.md).

### Application map

```
app/page.tsx
├── Header: Review | Settings | Tracking | Inbox | Bulk Add | Quick Add   (+ global Cmd/Ctrl-K search)
└── Tabs
    ├── Home ────── Habits | Plan | To Do | Goals | Tracking
    ├── Lists ───── Win98 file manager (folders, lists, items, orb gallery, spreadsheet)
    ├── Scheduler ─ Always → Year → Month → Week → Day funnel (+ dependency / gantt)
    ├── Modules ─── User-built mini-apps (workspaces) + dashboard widgets
    ├── Graph ───── Force-directed knowledge graph over items + typed links
    └── Analytics ─ Charts + Brain2 views (calibration, streaks, plan-vs-reality, regret)
```

Selecting a task from **Lists** (or Modules, Inbox, or global search) opens the
full-screen detail view (`components/enhanced-task-detail.tsx`, a barrel over the
consolidated `components/ItemDetail/`).

## Future direction

COGS is **offline-first and stays that way**. The full architectural plan lives in
[`docs/brain2_features_roadmap.md`](docs/brain2_features_roadmap.md); the highlights:

- **Offline-first, always.** Every client (web/desktop renderer and a future
  **mobile** app) keeps a **complete local store** that is the working source of
  truth offline (today: Zustand + `persist`). The app never requires the network.
- **Opportunistic cloud sync.** A future `SyncingDataSource` wraps the local store
  and, when online, reconciles with **MongoDB Atlas** in the background so devices
  converge. Conflict resolution starts as per-field last-write-wins (upgradeable to
  a sync engine: RxDB / PowerSync / Atlas Device Sync). Sync is best-effort and
  never blocks offline use.
- **Shared `@cogs/core` package.** A future monorepo extraction holding the data
  model (`lib/types.ts`), Zod schemas, the `DataSource` interface, domain services,
  and pure logic (search, needs-attention, links, link-graph, scheduling) — shared
  by web, desktop, and mobile.
- **Future mobile app** (Expo / React Native) consuming `@cogs/core` + a local
  cache + the same syncing remote data source.
- **External connectors** (read-only providers, starting with **weather**) feed
  widgets: fetched when online, cached locally with a TTL, degrading gracefully
  offline. Deliberately **not** on the user-data sync path.
- **Electron main becomes a thin shell** (optionally a connector/cache host), not
  the source of truth. The existing IPC + Mongo scaffolding is repurposed as the
  **remote/sync** side rather than a desktop-local datastore.

## Getting started

```bash
npm install --legacy-peer-deps   # react-day-picker peer-dep needs this flag
npm run dev                      # web dev server at http://localhost:3000
npm run electron:dev             # Next dev server + Electron window
npm run build                    # static export to out/
npm run electron:build           # package desktop installers into dist/
npm test                         # vitest unit + integration tests
npm run test:e2e                 # Playwright (Lists flows; starts dev server)
```

## Repository map

| Path | What lives here | README |
|------|-----------------|--------|
| `app/` | Next.js App Router entry: layout, single page, global + Win95 CSS | [`app/README.md`](app/README.md) |
| `components/` | All React UI — modules, dialogs, shared widgets | [`components/README.md`](components/README.md) |
| `components/Home/` | Home dashboard (Habits, Plan, ToDo, Goals, Tracking) | [`components/Home/README.md`](components/Home/README.md) |
| `components/Completion/` | Global task-completion popup (objective/goal contributions + multipliers) | [`components/Completion/README.md`](components/Completion/README.md) |
| `components/Lists/` | Lists file manager — orchestrator, hooks, views, dialogs (`components/Lists/README.md`) | [`components/Lists/README.md`](components/Lists/README.md) |
| `components/Scheduler/` | Period scheduling funnel + dependency/gantt views | [`components/Scheduler/README.md`](components/Scheduler/README.md) |
| `components/Modules/` | Composable dashboard modules + workspaces | [`components/Modules/README.md`](components/Modules/README.md) |
| `components/Graph/` | Knowledge/link graph over items + typed links | [`components/Graph/README.md`](components/Graph/README.md) |
| `components/Analytics/` | Metrics, charts + Brain2 views | [`components/Analytics/README.md`](components/Analytics/README.md) |
| `components/ItemDetail/` | Consolidated item/task detail (page + popup) | [`components/ItemDetail/README.md`](components/ItemDetail/README.md) |
| `components/Editor/` | Rich-text/markdown body editor | [`components/Editor/README.md`](components/Editor/README.md) |
| `components/Search/` | Global Cmd/Ctrl-K search palette | [`components/Search/README.md`](components/Search/README.md) |
| `components/Settings/` | Backup/restore + Second Brain setup | [`components/Settings/README.md`](components/Settings/README.md) |
| `components/Focus/` | Just-Start anti-paralysis mode | [`components/Focus/README.md`](components/Focus/README.md) |
| `components/Icons/` | Shared icon system + orb picker | [`components/Icons/README.md`](components/Icons/README.md) |
| `components/Tracking/` | Quick self-tracking metric logger | — |
| `components/Reviews/` | End-of-period review ritual (header) + post-mortems | [`components/Reviews/README.md`](components/Reviews/README.md) |
| `components/spreadsheet/` | Reusable Google-Sheets-style editable grid | [`components/spreadsheet/README.md`](components/spreadsheet/README.md) |
| `components/ui/` | shadcn/ui primitives (Button, Dialog, Tabs, …) | [`components/ui/README.md`](components/ui/README.md) |
| `lib/` | Data model types, Zustand stores, pure helpers | [`lib/README.md`](lib/README.md) |
| `lib/data/` | Nascent data layer: `DataSource` sources, Mongo collections/schemas, JSON backup | [`lib/data/mongo/README.md`](lib/data/mongo/README.md) |
| `lib/services/` | Domain services (completion, review, scheduling) | — |
| `electron/` | Desktop shell: main process + preload | [`electron/README.md`](electron/README.md) |
| `docs/` | Spec→code mapping and screen write-ups | [`docs/README.md`](docs/README.md) |
| `docs/screenshots/` | PNG captures + per-screen `.txt` write-ups (52 views) | [`docs/screenshots/README.md`](docs/screenshots/README.md) |
| `public/` | Static assets: orb PNGs (`orbs-removebackground/`), fonts, icons, link connectors | — |
| `hooks/` | Shared React hooks (`use-toast`, `useIsMobile`); module hooks live in subfolders (e.g. `components/Lists/hooks/`) | [`hooks/README.md`](hooks/README.md) |
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

A dozen-plus Zustand stores in `lib/` persist to **localStorage** — the complete,
offline-first source of truth (including the newer `module-definitions`,
`workflows-store`, and `item-type-store`). The future **MongoDB Atlas** `cogs` database is a
*cloud sync target* (reached via a `RemoteDataSource`/`SyncingDataSource`, not the
durable store) — flexible documents, text/vector search indexes, and aggregation
pipelines for advanced search and routing. See [`docs/brain2_features_roadmap.md`](docs/brain2_features_roadmap.md).
Key store examples:

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
with plan text and reflection (plus morning review and per-task post-mortems);
**Modules** platform (user-buildable full-screen **workspaces** with bound
spreadsheet/agenda/summary/randomizer/timer/checklist/gallery/notes/decision-matrix/
timeline/matcher/quiz/dashboard views, authored **workflows** that run on item
mutations, **pop-out** windows, reusable **definitions**, plus templates for
Itinerary / Cleaning / Budget / Book Tasting, and dashboard widgets);
**spreadsheet** display (v3: range select, fill handle, per-cell `=A1` + formula columns, row/column resize) for lists; **file/PDF**
attributes, built-in **Book**/**Flight** item types, and a **connector** seam;
all-time **Objectives** (prioritizable per period with custom point multipliers)
+ quantifiable **Goals** that serve them, with a global **completion popup** that
captures objective/goal contributions on every task completion; points on
task/habit/goal completion (with stacking objective multipliers); a
force-directed **Graph** over items + typed links; **global Cmd/Ctrl-K search**;
consolidated **ItemDetail** with tags/links/rich-text body; **Second Brain** item
types + **JSON backup/restore** (header Settings); Scheduler dependency/gantt
views; and Analytics charts plus Brain2 views (calibration, streaks,
plan-vs-reality, regret).

**Not yet matching the spec** (tracked in `docs/SPEC_MAPPING.md`): a durable
**MongoDB** storage layer (flexible documents, text/vector search indexes) wired
behind the nascent `lib/data/` sources + schema migrations (§3), unified Item data
model with de-duplicated fields (§5), auto-progress / penalties on the
Goals→Objectives model (§10),
complete Reviews cadence set (§13), the full set of spec Analytics views (§15), and
fully automatic carry-over logic (§7.7).

**Toward the long-term vision** (beyond the current spec — see "The eventual
vision" above): first-class **user-defined item types/subtypes** as a primary
workflow (not just task behavior) and a denser web of **type ↔ category ↔ tag ↔
attribute ↔ link** relationships. The **custom-module platform** (workspaces +
workflows + templates), **spreadsheet-style grid displays with formula columns**,
and **file/PDF attributes** are now built; still ahead is a fuller
**document-type item** with a Notion / Google Docs–style editor. The unified
`Item`/`ItemTypeDefinition`/`links`/`attributes` primitives in `lib/types.ts` are
the foundation for all of these.
