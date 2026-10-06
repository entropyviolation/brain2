# Architecture — reusable components and modularity

Assessment of the working tree: what is already a platform, what is duplicated
chrome, and how to make the code more modular without flattening the
Lists / module skins that [`DESIGN_STYLE.md`](DESIGN_STYLE.md) protects.

This is an analysis snapshot, not a commitment to extract everything listed. It
is subordinate to [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md), which states what
is shipped (compose and blueprints), the private-database rule, and the next
step (a hand-written manifest). This file is the refactor order for that.
What to *do next* (including UI waves that must not wait on this sequence) is
[`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md).
Pair with the live canvas
`~/.cursor/projects/Users-otherworld-brain2/canvases/modularity-architecture.canvas.tsx`.
Cursor keys that project folder by the checkout path. After the folder move
from `cogs copy` to `brain2`, the canvas files live with this workspace.

## North star

Brain2 is intended as a **living application** — a new type of software:
adaptable, alive, beautiful, cutting-edge, infinite. What exists for modules
is rung 0 (compose a workspace from lists and view kinds) and rung 1 (a
`ModuleDefinition` you can save, re-instantiate, and export as JSON). The
rule that matters now: a new module does not get a private database.
`module.config` holds bindings, layout, and preferences. House Cleaning
(`lib/house-cleaning.ts`, `module.config.houseCleaning`) and Trip Itinerary
(`lib/trip-itinerary.ts`, `module.config.tripItinerary`) are the two
existing violations, kept as debt, not the pattern to copy. See
[`MODULE_PLATFORM.md`](MODULE_PLATFORM.md). That rule decides what is worth
refactoring. A generic component library would make this ordinary. A dense
Item graph with feral rooms is the new thing. Structure is the content:
modules add relations and views, not a new kind of noun. A record stays at
its own order — observed, recorded, derived, inferred — and a higher label
never overwrites it
([`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md)).

## Verdict

**Domain modularity is split, not strong.** Three regimes coexist:

1. The **Item graph** — Lists, Docs, Scheduler, search, ingest, implied actions,
   Analytics. This is the brain, and it is good.
2. **Shadow databases (debt)** — `module.config.houseCleaning`
   (`lib/house-cleaning.ts`) and `module.config.tripItinerary`
   (`lib/trip-itinerary.ts`) keep their own record trees. A new module does
   not get one. These two sit beside the Item graph until their records move
   onto Items. Their skins can stay.
3. **Field aliases** — `title` vs `description`
   ([`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md)), so "what is this called" has
   two answers before any module is written. This is the only remaining one:
   the old `category` / `categories` collision was resolved by renaming the
   fields to `Task.stage` (lifecycle bucket) and `Task.lists` (list
   membership), which are two real axes and stay two fields.

**UI reuse is uneven, and only some of that is a problem.** Lists' Win95 chrome
and Tidy's overlays *should* differ — that is the gold standard. Habits speaks
the same milled fascia: `WeekNavigation` is `habit-chrome-btn` keys
(`components/Home/Habits/week-navigation.tsx` — previous, Today with `is-on`
on the current period, the engraved range, next). Raised metal lives in
`habit-chrome.css` under `.hab95`. [`DESIGN_STYLE.md`](DESIGN_STYLE.md) says
to protect that chrome. Do not restyle it.

The right end-state is not a generic component library. It is:

- One **world write** path that undo, persist, workflows, and future sync all
  observe. Today there are five doors: store actions, `taskRepository`,
  `dispatchItemMutation`, implied actions, workflows. Note that
  `lib/services/item-mutation-service.ts` is workflow *wiring* — it does not own
  writes, so "one path through `lib/services/`" is not the end-state.
- One **period cursor** as shared *data*, so Habits / To Do / Plan / Tracking /
  Reviews agree on "the day." Shared time is leverage; shared chevrons are not.
- One **persist** adapter (`lib/persist-storage.ts`) — already true.
- One **ingest** pipeline (`lib/ingest/`) — already true.
- **Modules as lenses on Items** with feral skins and declared bridges.

## Modules are separate in *look*, never in *meaning*

A module's interior is allowed to be its own piece of software: its own CSS, its
own overlays, its own vocabulary, even a long component. Forcing `TidyView`
onto `Button` or `PeriodNavigator` would destroy the thing that makes it feel
like a real application. Sharing `SheetGrid` or `AttributeSchemaEditor` when a
view *is* a spreadsheet or a schema editor is ordinary reuse.

What a module may **not** have is its own ontology. `module.config` is for
bindings, layout, and preferences. The moment a module stores *records* there, it
leaves the graph: Lists cannot show a Tidy subarea, ingest cannot start a stuck
session, Analytics cannot reason about an itinerary day. `lib/house-cleaning.ts`
and `lib/trip-itinerary.ts` are the two current violations, and they are tracked
as debt in [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md), not as the pattern.

**Operations is the model to copy:** an operation is a `Task` whose shape lives
in `categories` / `panels` / `trackingTagIds` attributes. Same composition idea,
zero private storage. Tidy should be that aggressive.

**Modularize the compose and blueprint path** — definitions, templates, view
kinds, workflows — and, as the next platform step, a hand-written manifest
and bridge grants. That is what makes variety infinite. Splitting
`TidyView` into more files does not.

The extract list below applies to **Home, Lists, Scheduler, Analytics,
ItemDetail** — the shared brain UI — not to every module view.

## What is already excellent

| Area | Why it is the pattern to copy |
|------|-------------------------------|
| `lib/ingest/` | Parse → apply → executor. Telegram is a channel, not UI. |
| `lib/persist-storage.ts` | Every Zustand persist key goes through one guarded adapter + hub. |
| `components/spreadsheet/` | `SheetGrid` + popout used by Lists and Modules; A1 eval in `lib/`. |
| `components/Lists/` | Orchestrator + `hooks/`, `views/`, `dialogs/`, `toolbar/`, `attributes/`. |
| `components/Home/Tracking/` | Pens, sleep, tags, dialogs; math in `lib/time-entries.ts` / `tracking-summary.ts`. |
| `components/Search/`, `Completion/` | Small, app-shell mounted. |
| `lib/services/` | Completion / mutation / scheduling above repositories. |
| `electron/` | Thin shell; data stays in the renderer. |

**Persisted Zustand stores** use `createCogsJSONStorage()` (historical
helper name; the product is **Brain2**). The catalog is
[`lib/README.md`](../lib/README.md). That
consistency is real, and merging stores is not the win. The missing piece is
naming the **transaction**: `habit-tracking-sync`, `sleep-sync`,
`work-session-store`, `points-store`, and `action-history`'s multi-vault
snapshots already form a cross-store graph that no layer owns. That graph is the
architecture; slicing a store file is not.

## Extractable components

Ranked by leverage, which is neither call-site count **nor running order** —
everything below `usePeriodCursor` is chrome and waits until step 7 of the
sequenced plan. The shared *verbs*
(time, gesture, confirmation) are worth extracting; shared *chrome* mostly is
not — see the deferred list under the sequenced plan.

| Candidate | Priority | Pull from | Consumers |
|-----------|----------|-----------|-----------|
| `usePeriodCursor` (period as **data**, chrome stays local) | High | `WeekNavigation`, `TodoPeriodNav`, inline chevrons, Tracking/Plan dates | Habits, To Do, Tracking day/week/log, Plan day/week/month, Scheduler, Reviews |
| `usePaintStroke` (gesture math only, not `PaintGridChrome`) | High | Shared stroke/selection logic | `time-grid.tsx`, `week-grid.tsx` |
| `confirm()` as a **function**, skinned per surface | Medium | Repeated Dialog + footer | Lists merge confirms, destructive actions |
| `ItemDetail` density mode (`page` \| `popover`) | Medium | Popup/page chrome delta | `ItemDetailPage`, `ItemDetailPopup` |
| `DayAgendaShell` | Low | Date chrome around `AgendaGrid` | Plan day-view + Tracking actual-day-view |

A generic `PeriodNavigator` is explicitly **not** the goal. Habits'
`WeekNavigation` is milled `habit-chrome-btn` keys on the Habits fascia.
A shared pill variant would flatten that chrome, which
[`DESIGN_STYLE.md`](DESIGN_STYLE.md) says to protect. Unify the *period*, not the chevrons.

### Do not extract

- **SheetGrid** into a generic data grid — it is the product.
- **Habit `task-grid`** with tracking paint grids — different models and CSS.
- **Habits chrome** (`habit-chrome.css`, including `WeekNavigation`'s
  `habit-chrome-btn` keys) — [`DESIGN_STYLE.md`](DESIGN_STYLE.md) protects this
  fascia. Do not restyle it into a shared control.
- **Lists Win95 chrome** into `components/ui/` — skin is the gold standard.
- **Module interiors** (Tidy, Trip, Film DNA) into Home/`ui/` — their *skins* are
  the point. Platform (manifests, definitions, templates, view kinds) is the
  reuse. This protects their CSS, not their private data shapes.
- **All stores into one store** — backup and persist keys assume slices.

## Split candidates

| File | Split along |
|------|-------------|
| `components/Modules/workspace/housecleaning/TidyView.tsx` | Optional local split only — this is a mini-app, not shared chrome |
| `components/Modules/workspace/itinerary/TripActivitiesView.tsx` | Same: itinerary app interior; keep on the Item/list bus |
| `lib/house-cleaning.ts` | Should not exist as a second model — migrate to Items ([`MODULE_PLATFORM.md`](MODULE_PLATFORM.md)) |
| `components/ItemDetail/ItemDetailPopup.tsx` | Data seam is already shared (`useItemDetailDraft`); remaining delta is chrome density |
| `components/spreadsheet/SheetGrid.tsx` | Selection, fill, formula bar, clipboard |
| `ItineraryDocumentView.tsx` | Doc chrome vs day blocks |
| `components/ItemDetail/ItemDetailPage.tsx` | Same — one surface with a density mode, not a second mirror |
| `module-view-bodies.tsx` | One file per view kind |
| `lib/types.ts` | The field problem itself; slice after `Item` is one type |
| `components/Lists/enhanced-list-view.tsx` | Further orchestrator thinning |

## Pattern inconsistencies

1. **shadcn `Button` and raw `<button>`** — expected in module skins (Tidy);
   worth unifying only in Home / Lists / Scheduler chrome.
2. **shadcn Dialog vs custom overlays** — Focus and Tidy overlays are
   product-specific; don’t force them onto the shared Dialog.
3. **Period navigation** — three visual dialects *in the main app* for prev /
   Today / next.
4. **Settings** — global `SettingsDialog` plus Habits / Plan / Pen / Lists /
   Module / Operation settings shells.
5. **Item detail** — page and popup. The *data* seam is
   already de-duplicated (`useItemDetailDraft`); what differs is chrome density.
6. **Four “grids”** — paint, agenda, habit spreadsheet, SheetGrid. Only
   time-grid and week-grid share a data model.

`components/ui/` is a thin, documented primitive set. Missing shadcn pieces
(form, calendar, chart) are intentional; Analytics uses **recharts** directly.

## Sequenced plan

Foundation before paint. Do not batch; after each step update colocated READMEs
(workspace rule).

This is the same sequence as [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md)
"How we get there from here" — steps 1–7 match on purpose. The optional file
split below is only in this doc. **Data first, chrome last.** The period
cursor is early because it is shared *data*; the paint hook, `confirm()`, and
the ItemDetail density mode are late because they are shared *chrome*, and
harvesting chrome before the manifest exists would freeze today's chrome as
the platform's API. Rung 3 (install wizard), rung 4 (LLM mapping), rung 5
(share), and the sixth workflow law (CY-10) are **UNBUILT**. They are the
appendix in [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md), not the next edit.

1. **Canonical fields** ([`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md)). Types are
   the load-bearing wall. Dual names for "what this is called" get inherited by
   every module the platform will ever install. Scope is `title` vs
   `description` — `stage` / `lists` and `entropy` / `cognitiveLoad` are
   deliberate distinctions the owner has ruled **keep**. Migration-sensitive, so
   it is careful work — not later work.
2. **One write door.** Implementation is `task-store`. UI and ingest call
   `useTaskStore` directly. `taskRepository` is the validating seam for
   services and sync (completion, scheduling, habit-done, sleep, pen actions,
   work sessions, implied actions). It is not what most screens call.
   Workflows and implied actions keep subscribing through
   `dispatchItemMutation`.
   Name the cross-store transaction that `habit-tracking-sync`, `sleep-sync`,
   `work-session`, `points`, and `action-history` already form implicitly.

   **New writes.** `commitItemEdit` and `applyLinkedEffects`
   (`lib/commit-item-edit.ts`) are the door for new code. `commitItemEdit`
   validates through `taskRepository`, writes with the store's existing update,
   and that update dispatches the same patch through `dispatchItemMutation`
   (known fields and unknown attribute keys, previous and next on one
   `item-activity` line, optional order `observed` | `recorded` | `derived` |
   `inferred`). Existing `useTaskStore` calls stay. `applyLinkedEffects` is
   opt-in — kind `habit` | `night` | `session` calls the ripple that already
   exists (`syncTrackedHabits`, `syncSleepNight`, `stopWorkingOnOperation`).
   It is not part of a rename, and `commitItemEdit` does not call it.
3. **Period as data** — one `usePeriodCursor` (or a shell-level date) that
   Habits / To Do / Plan / Tracking / Reviews read. Chrome stays local: do **not**
   unify the navs into one shared control. Habits' milled `habit-chrome-btn`
   keys stay Habits chrome.
4. **Bridges as data** — `ModuleBridgeGrant`, with the bridges that already
   exist informally (tracking tags, habit increments, points on completion,
   plan sync, ingest phrase claims) routed through it. Serializable,
   reviewable, revocable.
5. **The manifest** (rung 2), then **re-express the existing templates as
   manifests**. If Itinerary and Budget cannot be stated as manifests, the
   manifest is wrong — fix the manifest, not the template.
6. **Migrate the shadow databases** onto Items, stylesheets untouched. Tidy
   first; `tidy.css` changes by zero lines.
7. **Then** the small shared verbs, and only these: `usePaintStroke` (gesture
   math shared by the day and week Tracking grids, Tracking's look stays in
   Tracking), `confirm({ title, body, danger })` as a function skinned per
   surface, and **ItemDetail** as one surface with
   `density: "page" | "popover"` since the draft/mutator seam
   (`useItemDetailDraft`) is already shared. Call sites stay specific — a
   merge-lists confirm is not "Add Todo," and a generic `FormDialog` is how a
   product becomes Settings.exe. This waits on the manifest (rung 2).
8. **Optional:** split TidyView / TripActivities only if those files hurt the
   people editing *that* mini-app. Do not pull them into `components/ui/`.

Deferred on purpose: `ChartCard`, `CalendarHeatmap`, `GradeBreakdownShell`,
`PostMortemForm`, `AttributeSchemaForm`, `Button`-vs-`<button>` counts. A habit
mosaic and a context-switch intensity map are different sentences; a morning
review and an operation debrief are different ceremonies; list attributes and the
type registry have different lifetimes. Share **field widgets and focus/keyboard
behavior**, not component identity.

Platform work that *does* belong with “make modules modular”: the manifest,
bridge grants, definition export/import, templates, view-kind registry,
bound-list contracts, workflows. That is how infinite variety stays possible
without forking the brain.

## Efficiency (what actually matters)

These are the same items as the sequenced plan, not a separate wish list — that
is the point. Extracting chrome does not appear here because it does not move
any of them.

- **One world write** that can undo / persist / sync as a single transaction
  (plan step 2). Undo already snapshots several vaults; persist already no-ops
  identical payloads. The gap is that nobody owns the boundary.
- **Selectors**, so a workspace tab does not subscribe to every task.
- **Do not remount** Tidy (or any mini-app) when switching chrome tabs.
- Fewer **god-components** re-rendering entire workspaces.
- One **ItemDetail** with a density mode instead of two drifting surfaces.
- Keep **formula.ts** vs **sheet-eval.ts** layered; do not merge engines.
- Do not add react-hook-form; a generic form layer is not on the path.

## Beauty

Match [`DESIGN_STYLE.md`](DESIGN_STYLE.md): vintage machine, living contents,
one impossible motion. Do not freeze shared chrome as a Windows dialog.
Shared components take **variants**, they do not restyle Lists or Tidy toward
default shadcn. Genius is a dense Item network with a small set of verbs —
not a wall of identical cards. That density-plus-feral-rooms is how the app
stays a **new type of software** instead of a pretty admin tool.
