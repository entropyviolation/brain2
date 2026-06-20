# COGS Repository Tree

> **Interactive tree:** open **[`docs/tree.html`](tree.html)** in your browser (double-click the file, or *Open with Live Preview*). Click folders to expand, click any row for a detail panel with notes and ideas.

Plain-text tree: [`tree.txt`](tree.txt) · Spec checklist: [`SPEC_MAPPING.md`](SPEC_MAPPING.md)

---

## Jump to

| | | |
|---|---|---|
| [README.md](#readme-md) | [app/](#app) | [components/](#components) |
| [lib/](#lib) | [electron/](#electron) | [hooks/](#hooks) |
| [docs/](#docs) | [public/](#public) | [scripts/](#scripts) |
| [config](#config) | [App map](#app-map) | [Spec gaps](#spec-gaps) |

**Components sub-views:** [Home](#home) · [Lists](#lists) · [Scheduler](#scheduler) · [Modules](#modules) · [Analytics](#analytics) · [Reviews](#reviews) · [ui/](#ui)

---

<a id="readme-md"></a>

## README.md

**What:** COGS — personal cognitive management (Inbox, Lists, Scheduler, Goals, Habits, Tracking, Modules, Reviews, Analytics).

**Stack:** Next.js 15 static export, React 19, Zustand + localStorage (→ MongoDB), Electron, Win95 skin.

**Quick note:** Start here → `SPEC_MAPPING.md` → nearest folder README. Source files have `/**` headers too.

**Could add:** MongoDB storage (flexible documents, search indexes), unified Item model (see [Spec gaps](#spec-gaps)).

---

<a id="app"></a>

## app/

Next.js App Router entry — one static page, global CSS, retro shell. No API routes.

| File | Purpose |
|------|---------|
| `layout.tsx` | Root layout — fonts, `globals.css`, `win95.css`, `body.win95-app` |
| `page.tsx` | Header + 5 tabs; full-screen task detail when selected from Lists |
| `globals.css` | Tailwind + CSS variables |
| `win95.css` | Global Win95 bevels, tabs, scrollbars |
| `loading.tsx` | Route loading boundary (renders `null`) |

**Quick note:** Header = Review · Tracking · Inbox · Bulk Add · Quick Add.

**Could add:** Route segments if the app splits beyond one page.

→ [`app/README.md`](../app/README.md)

---

<a id="components"></a>

## components/

All React UI. Top-level files = cross-cutting widgets; subfolders = tab modules.

### Top-level files

| File | Purpose |
|------|---------|
| `quick-add.tsx` | Single-field capture → inbox |
| `enhanced-bulk-add.tsx` | Multi-line capture; `Category:` syntax |
| `inbox.tsx` | Inbox + clarification flow |
| `cognitive-state.tsx` | Header **Tracking** → TimeGrid dialog |
| `task-detail-popup.tsx` | Compact modal detail |
| `enhanced-task-detail.tsx` | Full-screen detail from Lists |

**Could add:** Merge the two detail views (spec §5.5). Remove stray `Untitled-1.py`.

→ [`components/README.md`](../components/README.md)

---

<a id="home"></a>

### Home/

Default tab — date, points, progress + **Habits · Plan · To Do · Goals · Tracking**.

| Area | Key file | Store(s) |
|------|----------|----------|
| Root | `home-dashboard.tsx`, `points-stats.tsx`, `daily-progress-quickview.tsx` | points, task |
| [Goals/](#home-goals) | `goals-tracker.tsx` | `goals-store` |
| [Habits/](#home-habits) | `habit-tracker.tsx`, `task-grid.tsx`, … | `habits-store` |
| [Plan/](#home-plan) | `plan-panel.tsx`, `month/week/day-view.tsx`, … | task, event, plan-text |
| [ToDo/](#home-todo) | `todo-panel.tsx` | `task-store` |
| [Tracking/](#home-tracking) | `time-grid.tsx`, `actual-day-view.tsx` | time-tracking, task |

→ [`components/Home/README.md`](../components/Home/README.md)

<a id="home-goals"></a>

#### Home/Goals/

Manual goal tracking with period, category, point rewards.

**Could add:** Objective trees, auto-linked progress (§10).

<a id="home-habits"></a>

#### Home/Habits/

Five habit types × daily/weekly/monthly. Shared with Lists daily habits.

**Could add:** Streak display, habit trend charts.

<a id="home-plan"></a>

#### Home/Plan/

Month/week/day calendar, drag-drop, events, plan text (localStorage).

**Could add:** Auto carry-over (§7.7), MongoDB plan documents.

<a id="home-todo"></a>

#### Home/ToDo/

Day/week/month execution — tier sort, Q/I flags, push forward.

<a id="home-tracking"></a>

#### Home/Tracking/

TimeGrid (15-min pens) + Day Log (plan vs actual).

**Could add:** Analytics plan-vs-reality view.

---

<a id="lists"></a>

### Lists/

Win98 file manager — folders, lists, attributes, orb gallery, CSV import.

**Stores:** `task-store`, `lists-ui-store`, `habits-store`, `folder-all-items`

**Could add:** Bulk attribute editing, richer attribute types.

→ [`components/Lists/README.md`](../components/Lists/README.md)

<a id="scheduler"></a>

### Scheduler/

Period funnel: **Always → Year → Month → Week → Day**.

**Could add:** Auto-scheduling (§7.6), event-linked checklists.

→ [`components/Scheduler/README.md`](../components/Scheduler/README.md)

<a id="modules"></a>

### Modules/

Composable widgets: list-explorer, writing-prompt, rules, analytics-stat, …

**Could add:** Map/location module, streak widget.

→ [`components/Modules/README.md`](../components/Modules/README.md)

<a id="analytics"></a>

### Analytics/

Five tabs: Overview, Habits heatmap, Points, Tracking pie, Reviews.

**Could add:** “Where I've been on a map”, plan-vs-reality, eight spec §15 views.

→ [`components/Analytics/README.md`](../components/Analytics/README.md)

<a id="reviews"></a>

### Reviews/

Header Review dropdown — day/week/month/quarter/year ritual.

**Could add:** Full §13 cadence, needs-attention queue (§4.5).

→ [`components/Reviews/README.md`](../components/Reviews/README.md)

<a id="ui"></a>

### ui/

shadcn/ui primitives: button, dialog, tabs, table, … (18 files kept).

→ [`components/ui/README.md`](../components/ui/README.md)

---

<a id="lib"></a>

## lib/

Data model, 10 Zustand stores, pure helpers. Not React UI.

### Stores

| File | Key | Purpose |
|------|-----|---------|
| `task-store.ts` | `cogs-task-storage` | Tasks, categories, folders |
| `event-store.ts` | `cogs-event-storage` | Calendar events |
| `habits-store.ts` | `cogs-habits-store` | Habits + completions |
| `goals-store.ts` | `cogs-goals-store` | Goals |
| `points-store.ts` | `points-store` | Points ledger |
| `time-tracking-store.ts` | `cogs-timegrid-store` | TimeGrid |
| `reviews-store.ts` | `cogs-reviews-store` | Period reviews |
| `modules-store.ts` | `cogs-modules-store` | Module widgets |
| `lists-ui-store.ts` | `cogs-lists-ui` | Lists UI prefs |
| `theme-store.ts` | `cogs-theme-store` | Theme colors |

### Helpers

`types.ts` · `calculations.ts` · `date-utils.ts` · `item-utils.ts` · `habit-utils.ts` · `attribute-utils.ts` · `plan-text.ts` · `folder-all-items.ts` · `scheduled-lists-sync.ts` · `csv.ts` · `remove-background.ts` · `orbs-manifest.ts` · `utils.ts`

**Could add:** MongoDB + schema migrations + JSON export/import (§3). Unified `Item` in `types.ts` (§5).

→ [`lib/README.md`](../lib/README.md)

---

<a id="electron"></a>

## electron/

Desktop shell — dev: `localhost:3000`; prod: `app://` → `out/`.

| File | Purpose |
|------|---------|
| `main.js` | Main process, BrowserWindow, static file serving |
| `preload.js` | `window.desktop` API |

**Could add:** MongoDB connection lifecycle + IPC (§3).

→ [`electron/README.md`](../electron/README.md)

---

<a id="hooks"></a>

## hooks/

Reserved for shared React hooks (`use-toast`, `use-mobile` documented in README).

**Could add:** Move hooks here; extract Zustand selectors.

→ [`hooks/README.md`](../hooks/README.md)

---

<a id="docs"></a>

## docs/

| File | Purpose |
|------|---------|
| `SPEC_MAPPING.md` | Spec → code checklist (✅ 🟡 ⛔ 🕓) |
| `tree.txt` | Plain `tree` command output |
| `tree.md` | This file — clickable index |
| `tree.html` | **Interactive** expand + detail panel |
| `screenshots/` | 9 PNG + `.txt` write-ups per view |

Re-capture screenshots: `node scripts/capture-screenshots.mjs` (with `npm run dev` running).

→ [`docs/README.md`](README.md)

---

<a id="public"></a>

## public/

| Path | Purpose |
|------|---------|
| `fonts/` | W95FA, MS Sans Serif |
| `icons/` | Folder, list, briefcase icons |
| `linkconnectors/` | Lists tree connector SVGs |
| `orbs-removebackground/` | 1000+ orb PNGs |
| `velvetscrolltile.png` | Lists scroll texture |

---

<a id="scripts"></a>

## scripts/

| File | Purpose |
|------|---------|
| `capture-screenshots.mjs` | Automated docs screenshots |
| `background-remover.py` | Orb background removal helper |

---

<a id="config"></a>

## Config & lockfiles

`components.json` · `next.config.mjs` · `package.json` · `tailwind.config.ts` · `tsconfig.json` · `vitest.config.ts` · lockfiles

---

<a id="app-map"></a>

## App map

```
app/page.tsx
├── Header: Review | Tracking | Inbox | Bulk Add | Quick Add
└── Tabs
    ├── Home ────── Habits | Plan | To Do | Goals | Tracking
    ├── Lists ───── Win98 file manager
    ├── Scheduler ─ Always → Year → Month → Week → Day
    ├── Modules ─── composable widgets
    └── Analytics ─ charts
```

Lists task select → `enhanced-task-detail.tsx` (full screen).

---

<a id="spec-gaps"></a>

## Spec gaps (highest impact)

| Area | Status | Next step |
|------|--------|-----------|
| Storage | 🟡 localStorage | MongoDB + schema migrations + JSON export (§3) |
| Item model | 🟡 split types | Unified `Item` in `types.ts` (§5) |
| Goals | 🟡 manual | Objectives, auto progress (§10) |
| Analytics | 🟡 5 tabs | 8 spec views + map/location ideas (§15) |
| Carry-over | 🟡 via Reviews | Automatic period carry-over (§7.7) |
| Regret | ⛔ missing | Regret accrual (§14) |

Full detail → [`SPEC_MAPPING.md`](SPEC_MAPPING.md)

---

## Regenerate plain tree

```bash
tree -I 'node_modules|out|dist|.git' > docs/tree.txt
```

Then update [`tree.html`](tree.html) node data if structure changed.
