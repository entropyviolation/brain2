# Architecture — reusable components and modularity

Assessment of the working tree: what is already a platform, what is duplicated
chrome, and how to make the code more modular without flattening the
Lists / module skins that [`DESIGN_STYLE.md`](DESIGN_STYLE.md) protects.

This is an analysis snapshot, not a commitment to extract everything listed. It
is subordinate to [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md), which states where
the platform is going; this file is the refactor order that gets there.
What to *do next* (including UI waves that must not wait on this sequence) is
[`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md).
Pair with the live canvas
`~/.cursor/projects/Users-otherworld-brain2/canvases/modularity-architecture.canvas.tsx`.
Cursor keys that project folder by the checkout path. After the folder move
from `cogs copy` to `brain2`, the canvas files live with this workspace.

## North star

Brain2 is intended as a **living application** — a new type of software:
adaptable, alive, beautiful, cutting-edge, infinite. Everything below serves
one goal that makes that possible: **any small app should be installable into
the brain** — see [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md). That goal, not
component reuse, decides what is worth refactoring. A generic component library
would make this ordinary. A dense Item graph with feral rooms is the new thing.
Structure is the content: modules add relations and views, not a new kind of
noun. A record stays at its own order — observed, recorded, derived, inferred —
and a higher label never overwrites it
([`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md)).

## Verdict

**Domain modularity is split, not strong.** Three regimes coexist:

1. The **Item graph** — Lists, Docs, Scheduler, search, ingest, implied actions,
   Analytics. This is the brain, and it is good.
2. **Shadow databases** — `module.config.houseCleaning` (`lib/house-cleaning.ts`)
   and `module.config.tripItinerary` (`lib/trip-itinerary.ts`) keep their own
   record trees *specifically so they do not flatten onto Lists/Items*. Those
   modules do **not** use the brain; they sit beside it.
3. **Field aliases** — `title` vs `description`
   ([`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md)), so "what is this called" has
   two answers before any module is written. This is the only remaining one:
   the old `category` / `categories` collision was resolved by renaming the
   fields to `Task.stage` (lifecycle bucket) and `Task.lists` (list
   membership), which are two real axes and stay two fields.

**UI reuse is uneven, and only some of that is a problem.** Lists' Win95 chrome
and Tidy's overlays *should* differ — that is the gold standard. The real
inconsistency is Home speaking modern-SaaS (rounded-full, shadow-sm pills in
`WeekNavigation`) while Lists speaks 1998.

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
own overlays, its own vocabulary, even a 2k-line component. Forcing `TidyView`
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

**Modularize the install/compose path** — manifests, definitions, templates, view
kinds, bridge grants, workflows. That is what makes variety infinite. Splitting
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

**19 persisted Zustand stores** all use `createCogsJSONStorage()` (historical
helper name; the product is **Brain2**). That
consistency is real, and merging stores is not the win. The missing piece is
naming the **transaction**: `habit-tracking-sync`, `sleep-sync`,
`work-session-store`, `points-store`, and `action-history`'s multi-vault
snapshots already form a cross-store graph that no layer owns. That graph is the
architecture; slicing a store file is not.

## Extractable components

Ranked by leverage, which is neither call-site count **nor running order** —
everything below `usePeriodCursor` is chrome and waits until step 9 of the
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

A generic `PeriodNavigator` with `variant="pill" | "outline" | "tracking"` is
explicitly **not** the goal: Habits' `WeekNavigation` is a `rounded-full`
`shadow-sm` SaaS pill, and a shared variant would canonize that as Brain2 style
against [`DESIGN_STYLE.md`](DESIGN_STYLE.md). Unify the *period*, not the chevrons.

### Do not extract

- **SheetGrid** into a generic data grid — it is the product.
- **Habit `task-grid`** with tracking paint grids — different models and CSS.
- **Lists Win95 chrome** into `components/ui/` — skin is the gold standard.
- **Module interiors** (Tidy, Trip, Film DNA) into Home/`ui/` — their *skins* are
  the point. Platform (manifests, definitions, templates, view kinds) is the
  reuse. This protects their CSS, not their private data shapes.
- **All stores into one store** — backup and persist keys assume slices.

## Split candidates (line counts approximate)

| Lines | File | Split along |
|------:|------|-------------|
| 2270 | `components/Modules/workspace/housecleaning/TidyView.tsx` | Optional local split only — this is a mini-app, not shared chrome |
| 2083 | `components/Modules/workspace/itinerary/TripActivitiesView.tsx` | Same: itinerary app interior; keep on the Item/list bus |
| 1839 | `lib/house-cleaning.ts` | Should not exist as a second model — migrate to Items ([`MODULE_PLATFORM.md`](MODULE_PLATFORM.md)) |
| 1423 | `components/ItemDetail/ItemDetailPopup.tsx` | Data seam is already shared (`useItemDetailDraft`); remaining delta is chrome density |
| 1404 | `components/spreadsheet/SheetGrid.tsx` | Selection, fill, formula bar, clipboard |
| 1318 | `ItineraryDocumentView.tsx` | Doc chrome vs day blocks |
| 1304 | `components/ItemDetail/ItemDetailPage.tsx` | Same — one surface with a density mode, not a second mirror |
| 1185 | `module-view-bodies.tsx` | One file per view kind |
| 1114 | `lib/types.ts` | The field problem itself; slice after `Item` is one type |
| 1095 | `components/Lists/enhanced-list-view.tsx` | Further orchestrator thinning |

## Pattern inconsistencies

1. **~388 `Button` vs ~426 raw `<button>`** — expected in module skins (Tidy);
   worth unifying only in Home / Lists / Scheduler chrome.
2. **shadcn Dialog vs custom overlays** — Focus and Tidy overlays are
   product-specific; don’t force them onto the shared Dialog.
3. **Period navigation** — three visual dialects *in the main app* for prev /
   Today / next.
4. **Settings** — global `SettingsDialog` plus Habits / Plan / Pen / Lists /
   Module / Operation settings shells.
5. **Item detail** — page and popup both ~1.3–1.4k lines. The *data* seam is
   already de-duplicated (`useItemDetailDraft`); what differs is chrome density.
6. **Four “grids”** — paint, agenda, habit spreadsheet, SheetGrid. Only
   time-grid and week-grid share a data model.

`components/ui/` is a thin, documented primitive set. Missing shadcn pieces
(form, calendar, chart) are intentional; Analytics uses **recharts** directly.

## Sequenced plan

Foundation before paint. Do not batch; after each step update colocated READMEs
(workspace rule).

This is the same sequence as [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md)
"How we get there from here" — the two lists are kept identical on purpose.
**Data first, chrome last.** The period cursor is early because it is shared
*data*; the paint hook, `confirm()`, and the ItemDetail density mode are late
because they are shared *chrome*, and harvesting chrome before the manifest
exists would freeze today's chrome as the platform's API.

1. **Canonical fields** ([`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md)). Types are
   the load-bearing wall. Dual names for "what this is called" get inherited by
   every module the platform will ever install. Scope is `title` vs
   `description` — `stage` / `lists` and `entropy` / `cognitiveLoad` are
   deliberate distinctions the owner has ruled **keep**. Migration-sensitive, so
   it is careful work — not later work.
2. **One write door.** Consolidate on `task-store` as the single implementation
   with `taskRepository` as the only caller-facing seam (it already validates);
   workflows and implied actions keep subscribing through
   `dispatchItemMutation`. Adding a third API would make a sixth door, not one.
   Name the cross-store transaction that `habit-tracking-sync`, `sleep-sync`,
   `work-session`, `points`, and `action-history` already form implicitly.
3. **Period as data** — one `usePeriodCursor` (or a shell-level date) that
   Habits / To Do / Plan / Tracking / Reviews read. Chrome stays local: do **not**
   unify the three navs into `variant="pill"`, which would canonize Home's SaaS
   pill as the shared style.
4. **Bridges as data** — `ModuleBridgeGrant`, with the bridges that already
   exist informally (tracking tags, habit increments, points on completion,
   plan sync, ingest phrase claims) routed through it. Serializable,
   reviewable, revocable.
5. **The manifest** (rung 2), then **re-express the existing templates as
   manifests**. If Itinerary and Budget cannot be stated as manifests, the
   manifest is wrong — fix the manifest, not the template.
6. **Migrate the shadow databases** onto Items, stylesheets untouched. Tidy
   first; `tidy.css` changes by zero lines.
7. **Install wizard** (rung 3), manual mapping first, with the dry-run against
   a scratch snapshot built *before* any assist.
8. **LLM mapping assist** (rung 4), install-time only.
9. **Then** the small shared verbs, and only these: `usePaintStroke` (gesture
   math shared by the day and week Tracking grids, Tracking's look stays in
   Tracking), `confirm({ title, body, danger })` as a function skinned per
   surface, and **ItemDetail** as one surface with
   `density: "page" | "popover"` since the draft/mutator seam
   (`useItemDetailDraft`) is already shared. Call sites stay specific — a
   merge-lists confirm is not "Add Todo," and a generic `FormDialog` is how a
   product becomes Settings.exe.
10. **Optional:** split TidyView / TripActivities only if those files hurt the
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
