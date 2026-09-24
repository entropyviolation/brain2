# BRAIN2 Repository Tree

A clickable, annotated index of the repository. Pairs with the plain-text
[`tree.txt`](tree.txt) (raw `tree` output) and the spec checklist
[`SPEC_MAPPING.md`](SPEC_MAPPING.md).

> Where to start: root [`README.md`](../README.md) → [`SPEC_MAPPING.md`](SPEC_MAPPING.md)
> → the nearest folder `README.md`. Where it is going:
> [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md) (installable modules on one Item
> graph). Look and feel: [`DESIGN_STYLE.md`](DESIGN_STYLE.md)
> (Lists is the gold standard); moodboard steal-brief [`DESIGN_REFS.md`](DESIGN_REFS.md).
> Nearly every source file also opens with a
> `/** ... */` header describing its purpose and spec section.

---

## Jump to

|                         |                          |                            |
| ----------------------- | ------------------------ | -------------------------- |
| [README.md](#readmemd)  | [app/](#app)             | [components/](#components)  |
| [lib/](#lib)            | [electron/](#electron)   | [hooks/](#hooks)           |
| [docs/](#docs) · [designrefs/](#designrefs) | [public/](#public) | [scripts/](#scripts) |
| [e2e/ · tests/](#tests) | [config](#config--lockfiles) | [App map](#app-map)    |
| [Spec gaps](#spec-gaps-highest-impact) |           |                            |

**Components sub-views:** [top-level](#top-level-files) · [Home](#home) · [Docs](#docs-top-level-tab) · [Lists](#lists) · [Scheduler](#scheduler) · [Modules](#modules) · [Analytics](#analytics) · [Reviews](#reviews) · [Settings / Item Types](#settings--focus) · [UiNames](#names-overlay) · [spreadsheet](#spreadsheet) · [ui/](#ui)

---

## README.md

**What:** **BRAIN2** (prose: Brain2) — a **living perfect second brain**. Item
captured once, then connected and used in as many rooms as possible.
**Analytics is the heart** (collection, presentation, analysis, next tools).
Inbox, Lists, Scheduler, Goals, Habits, Tracking, Modules, Reviews.

**Stack:** Next.js 15 static export, React 19, TypeScript, Tailwind + shadcn/ui,
recharts, Zustand + `persist` → localStorage (→ MongoDB), Electron, Win95/Win98 skin.

**Vision seam:** unified `Item` + user-definable `ItemTypeDefinition`, free-form
`tags`, typed `links`, flexible attributes (`lib/types.ts`). New list items
default to generic `item`; Task is the hardcoded work surface. Catalog types
(Book, Furniture, …) own their detail views.

→ [`README.md`](../README.md)

---

## app/

Next.js App Router entry — one static client page, global CSS, retro shell. Trip
maps / weather / places call public APIs from the browser (`lib/city-search.ts`,
`lib/weather-client.ts`, `lib/places-search.ts`); no App Router API routes are
required for the static Electron export. Repeat lookups share `lib/api-cache.ts`.

| File          | Purpose                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `layout.tsx`  | Root layout — Karla font, `globals.css` + `win95.css` + module chrome CSS (incl. Modules `modules-chrome.css`) + `baby-animal-nest.css` + `shell-chrome.css` + `ui-names.css` + `chrome-patina.css` + `pcb-backdrop.css`, `ChromePatina`, `PcbBackdrop`, `body.win95-app`, metadata, global `CompletionPopupHost` + `UiNamesHost` |
| `page.tsx`    | Pinned mill title bar (`AppHeader`, stays on item detail) + 7 lazy tabs; `initWorkflowEngine` on mount (workflows + implied actions); `EnhancedTaskDetail` fills the desk below the pin bar |
| `page.test.tsx` | Pin bar stays mounted with item detail |
| `globals.css` | Tailwind base/components/utilities + theme CSS variables                       |
| `win95.css`   | Global Win95 bevels, tabs, scrollbars, pixel font (`body.win95-app` specificity so Tailwind HMR cannot unskin). `--chrome-face` is the one gunmetal; `--w95-*` alias it; `--w95-desktop` aliases `--pcb-desk`. **Navy `#000080` text-field focus** (never WebKit orange). Tracking `.trk95` / `.trk-desktop` restore gray muted text on the white field. |
| `chrome-patina.css` | Remaps module chrome aliases onto `--chrome-*` (`body.win95-app` specificity); Settings dual-thumb slider |
| `chrome-patina.tsx` | Writes the live gunmetal on load, on set-point change, and once a minute |
| `pcb-backdrop.css` | Photoreal PCB desktop plates + veil/grain; Settings chip grid |
| `pcb-backdrop.tsx` | Stamps `data-pcb-mode` / `data-pcb-ink` from `theme-store.pcbMode` |
| `loading.tsx` | Route loading boundary (renders `null`; panels use Suspense)                   |

**Pinned mill title bar:** BRAIN2 caption + friend jewel · Review · Settings · Tracking · Names (latch) · Inbox · Ingest · Metrics · Bulk Add · From Notes · Phone Notes · Quick Add (+ Cmd/Ctrl-K search).

→ [`app/README.md`](../app/README.md)

---

## components/

All React UI. Top-level files = cross-cutting widgets; subfolders = tab modules.
Most components have a co-located `*.test.tsx`.

### Top-level files

| File                       | Purpose                                       |
| -------------------------- | --------------------------------------------- |
| `AppHeader.tsx`            | Pinned mill title bar (BRAIN2 caption + friend jewel + groupboxes; System **Names** latch; mounts optional **now** between System and Capture) |
| `header-now-box.tsx`       | Optional **now** well — live Working session clocks (Stop / Pause↔Resume); absent when idle |
| `append-log.tsx`           | Shared append-log composer (Submit + List/Bulk/Latest) |
| `shell-chrome.css`         | Full-width sticky mill fascia for `.b2-shell` (Friend / Review / System / optional now / Capture) |
| `quick-add.tsx`            | Single-line capture: colon paths, live chips, optional Inbox |
| `enhanced-bulk-add.tsx`    | Multi-line capture; `list:` / `folder: list:` headers; optional Inbox |
| `capture-shorthand.tsx`    | Shared Inbox checkbox + shorthand help        |
| `notes-ingest.tsx`         | From Notes — date range, parse/skip, bulk-add (`Folder: List:` creates a folder) or park full text on **notes to ingest** |
| `iphone-notes-store.tsx`   | Phone Notes — queue of Telegram Shortcut dumps and unmatched texts on **iPhone Notes Store** / **Parked** (AirDrop `Dump iPhone Notes to Brain2.shortcut`) |
| `ingest-log-dialog.tsx`    | Header **Ingest** — phone-message log (Telegram / simulate) |
| `inbox.tsx`                | Inbox walk (selected only, newest first) + rename/discard + recent lists + points + select/deselect all + delete |
| `cognitive-state.tsx`      | Header **Tracking** → TimeGrid dialog         |
| `baby-animal-nest.tsx`     | **Today's friend** in the header brand well (photo, chat button, Gallery; details on the photograph) |
| `friend-details.tsx`       | Friend instrument entry (lace portrait, bond tubes, tabs, equalizer, mission card, journal). Pieces in `friend-details/` |
| `friend-mission-sheet.tsx` | Mission sheet: task opens item detail on top; accept / decline ladder |
| `baby-animal-gallery.tsx`  | Friend gallery: pack naming, request, shuffle among cards, confirm-before-delete (also Settings) |

### Names overlay

**Names overlay** (`components/UiNames/`): first `data-ui-mode`. Store `lib/ui-names-store.ts`. Host in `app/layout.tsx`; nameplate portals to `document.body` at z-index 310 so it sits on dialogs. Help / Inspect would reuse the same kernel and `data-ui-docs` paths to living READMEs.
→ [`components/UiNames/README.md`](../components/UiNames/README.md)

The two detail views are consolidated under
[`ItemDetail/`](../components/ItemDetail/README.md): both share load/draft state
and the category/dependency/tag/link mutators via `useItemDetailDraft`. Tabs and
chrome come from `resolveDetailView` (item type + list overlays + capabilities);
Task chrome is not the default for generic list items.

→ [`components/README.md`](../components/README.md)

---

### Home

Default tab — date + hidable overview squares (points, progress, review, optional affirmation/weather) + **Habits · Plan · To Do · Goals · Tracking**. The strip is shared by every sub-tab.

| Area                        | Key files                                                                                      | Store(s)                       |
| --------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------ |
| Root                        | `home-dashboard.tsx`, `home-overview.tsx`, `home-widgets-menu.tsx`, `home-widget-dialog.tsx`, `home-award-tile.tsx`, `home-screen-pet.tsx`, `home-next-tile.tsx`, `home-day-lamp.tsx`, `home-days-until.tsx`, `home-solar-tile.tsx`, `home-tracking-tile.tsx`, `home-glance-tiles.tsx`, `home-day-stats.ts`, `weather-instrument.tsx`, `points-stats.tsx`, `daily-progress-quickview.tsx`, `home-review-banner.tsx` | points, task, reviews, events, sleep, `home-widgets-store`, `home-weather-store`, `home-days-until-store`, `sun-times-store`, time-tracking |
| [Goals/](#homegoals)        | `goals-tracker.tsx`                                                                            | `goals-store`                  |
| [Habits/](#homehabits)      | `habit-tracker.tsx`, `task-grid.tsx`, `habit-row-name.tsx`, `habit-heatmap.tsx`, `habit-sort-control.tsx`, `habit-led-lamp.tsx`, `percent-led.tsx`, `percent-led-bar.tsx`, `habit-percent-readout.tsx`, `habit-grid.css`, `habit-chrome.css`, `habit-gems.tsx`, `gem-picker.tsx`, `habits-control-panel.tsx`, `exemption-wand-button.tsx`, `willpower-gems.tsx`, `noble-gas-tube.tsx`, `grade-breakdown-dialog.tsx`, `output-grade-breakdown-dialog.tsx`, `good-days-dialog.tsx`, `priority-math.tsx`, `period-habit-list.tsx`, `week-navigation.tsx`, `daily-task-form*.tsx`, `habit-form-dialog.css`, `settings-dialog.tsx` | `habits-store`, `time-tracking-store` (auto-fill tags) |
| [Plan/](#homeplan)          | `plan-panel.tsx`, `plan-chrome.css`, `plan-theme.ts`, `plan-gem-mode.ts`, `plan-gem-mode-toggle.tsx`, `plan-gem-day.ts`, `plan-gem-day-body.tsx`, `plan-chip.tsx`, `plan-capacity.ts`, `plan-text-log.tsx`, `month/week/day-view.tsx`, `agenda-grid.tsx`, `planned-tasks-sidebar.tsx`, `use-plan-rail-drag.ts`, `planned-action-dialog.tsx`, `event-dialog.tsx`, `paste-events-dialog.tsx`, `settings-dialog.tsx` | task, event, planned-action, plan-text, sleep-sync, unsaved-changes |
| [ToDo/](#hometodo)          | `todo-panel.tsx`, `todo-filters.tsx`, `todo-prefs.ts`, `todo-chrome.css`, `TodoTable.tsx`, `AddTodoDialog.tsx`, `DoneTodoSection.tsx`, `MissedTodoSection.tsx`, `AddDoneDialog.tsx`, `CompletionTimeLine.tsx`, `todo-utils.ts` | `task-store`, `todo-prefs` (`cogs-todo-prefs`) |
| [Tracking/](#hometracking)  | `time-grid.tsx`, `cell-size-keys.tsx`, `fill-range-control.tsx`, `empty-blocks.ts`, `week-grid.tsx`, `infinite-strip.tsx`, `infinite-window.ts`, `pen-palette.tsx`, `pen-mode-bar.tsx`, `tracking-tool-mode.ts`, `tracking-tools-tray.tsx`, `tool-detail.tsx`, `pen-swatches.tsx`, `trk-instrument.tsx`, `trk-time-markers.tsx`, `other-scope-hint.tsx`, `screentime-empty-hint.tsx`, `tracking-chrome.css`, `depth-control.tsx`, `tracking-activity-log.tsx`, `log-activity-dialog.tsx`, `now-time-button.tsx`, `actual-day-view.tsx`, `daylog-week.tsx`, `daylog-week.css`, `confirm-planned-dialog.tsx`, `tracking-view-settings-dialog.tsx`, `tracking-day-notes.tsx`, `tracking-undo.ts`, `pen-settings-dialog.tsx`, `pen-parent-picker.tsx`, `pen-chain-visual.tsx`, `pen-action-format-editor.tsx`, `entry-dialog.tsx`, `block-pen-section.tsx`, `secondary-pens-field.tsx`, `tracking-tags-panel.tsx`, `tracking-tags-well.css` | time-tracking, task, event     |

Shared **selected day** via `lib/use-current-date.ts` (persists across refresh / tab switches; advances at local midnight only while that cursor is still today).

→ [`components/Home/README.md`](../components/Home/README.md)

#### Home/Goals/
All-time **Objectives** (prioritizable per period with custom point multipliers)
+ quantifiable **Goals** (`count | boolean | numerical`, period kinds incl. custom
ranges) that each serve ≥1 objective, plus the **Direction** report. Files:
`goals-tracker.tsx` (milled fascia: CRT title, period lamps, recessed lists;
title jewel also sits at photograph size on the desktop under the window),
`ObjectivesPanel.tsx`, `ObjectiveDetailDialog.tsx`, `GoalsContainer.tsx`,
`DirectionReport.tsx`. 26 default objectives + example goals
seeded on first load. Multiplier/priority math in `lib/goals-store.ts` +
`lib/objectives.ts`.
**Could add:** auto-linked progress, penalty amounts on missed objectives (§10).

#### Home/Habits/
Five habit types (boolean, goal, text, climb; TIME/COUNT alias GOAL) × daily/weekly/monthly **frequency**.
Climb **cadence** is independent: **weekly +** (fixed week goal; Monday bump after ≥4 hits) or **daily +** (last log + increment; a drop still lowers tomorrow’s target). Rules in `lib/incremental-habits.ts`; logs on `TaskCompletion.value`.
Shared `habits-store` persist **v16** with Lists Daily Habits. `migrateHabitsState` keeps tasks across version bumps. 15 default daily habits (chess match + puzzle as Daily +; meditate Weekly +; Book implied actions target **Read at least 10 pages per day**, `task-9`).
Add/edit uses a Win95 window (`habit-form-dialog.css`) with **Gem**, **Priority** pin/mute, Climb cadence tiles, **Delete habit** on edit, and a readable **Add Habit** button. **New habit** lives in the Habits Tab Control Panel on every tab. Daily **Heatmap View** rocker (`habitViewMode`) is a jewelry mosaic in the light sheet; **Sort Habits** custom plate sits above grouped heatmap/hide rockers (`lib/habit-sort.ts`). Grade / Good-day dialogs can apply a 50% floor for prioritized habits.
Daily grid is compact (`habit-grid.css`: far-left inset gem/edit, wrapping title with streak/`×N` under it, recessed panel-lamp Yes/No cells — **Small LEDs** 15px or fill-cell, quiet 10-pip loading channel or numeric LED totals, optional **Day View** today+% list, name column capped so day columns grow, current day a **solid** mint fill). Home → Habits Daily wraps in `.hab95` (`habit-chrome.css`): milled fascia console (CRT **Habits** title, Daily/Weekly/Monthly bay with power lamps, period nameplate, metal Settings / New habit), phosphor points, **noble-gas glass tubes** for Week / Span grade and Perfect output (`noble-gas-tube.tsx`; plasma clipped to percent; discharge hue from `gradeTubeColor` / `outputGradeTubeColor`; **Willpower gems** stay a crystal pinned at the control panel foot with collected habit gems), analog cockpit rockers (Heatmap View / Day View / Hide Completed Today / Loading Bar / **Small LEDs**), milled Habits Tab Control Panel (Physics enlarges Willpower gems). Clickable **Week grade** and **Perfect output** each open a scrollable raw/curved breakdown with their own **tolerance** and tube color. **Good day streak** and **Good days in the last month** sit side by side in that control panel. Layout: [`components/Home/Habits/README.md`](../components/Home/Habits/README.md#daily-layout--chrome-intent).
Streaks live on Analytics → Streaks (`lib/streaks.ts` + derived climb targets), not on the Habits grid.
Daily Goal / Yes-No habits can **auto-fill from Tracking**: link TimeGrid tags in Add/Edit Habit and tagged minutes land on that day (`lib/habit-tracking.ts`; `manualValue` / `trackedValue` stay separate so the sync is idempotent). Auto-filled cells show a clock glyph and a blue border.
**Could add:** streak chips on the Habits grid, habit trend charts, auto-fill for climb habits.

#### Home/Plan/
Milled fascia calendar (`.plan95` in `plan-chrome.css`: CRT title, Month/Week/Day
bay with power lamps, period nameplate, metal action keys). Month/week/day views,
drag-drop scheduling, event chips (`plan-chip.tsx`), **append log**
(`plan-text-log.tsx` + `lib/plan-text.ts` + shared `lib/append-log.ts`). Compact
month squares. Optional Plan-only Dark latch (`plan-theme.ts`, `#plan-chrome-toggles`).
Optional **Gem and trinket** mode (`plan-gem-mode.ts`, same toggle row; default off)
shows completed habits/list items as gems/orbs on **past** Month days only.
Period nameplate (metal prev/next/today — violet fill in dark),
navy field focus, nested milled rail/desktop wells. Sidebar capacity line
(`plan-capacity.ts`) is planned minutes vs that day’s waking window. Month / week /
day rails share `planned-tasks-sidebar.tsx` (search/sort/filter, period add,
incomplete period habits + gems). **Add Event** is a bounded Win95 dialog
(`.plan95-dialog` ~30.5rem, navy caption, title-bar ×, milled Cancel + Create); dirty close uses the house
unsaved-changes guard. **Add Plan** writes a timed planned action on the selected day
(`planned-action-dialog.tsx`, dashed linen chip — not an event). **Paste Events**
(`paste-events-dialog.tsx` + `lib/parse-event-text.ts`) bulk-creates from itinerary
text. Multi-day all-day events span their date range. `agenda-grid.tsx` shared with
Tracking Day Log.
**Could add:** Auto carry-over (§7.7), MongoDB plan documents.

#### Home/ToDo/
Day/week/month execution lists — tier sort (A+…D), overdue, push forward.
Orchestrator (`todo-panel.tsx`) + **Show / Sort / Pace** (`todo-filters.tsx`,
Available now + WIP cap in `todo-prefs.ts`) + pure `todo-utils.ts` +
`TodoTable`/`AddTodoDialog`. The title jewel is also the desktop plate under
the window (`.todo-desk-plate` in `todo-chrome.css`). `lib/available-tasks.ts` is the unmet-dep predicate.
**Done** (`DoneTodoSection.tsx` + `AddDoneDialog.tsx`) includes Tasks, implied-action
logs, habit logs, and Operation **Working on this now** sessions (`worked on {name}`).
Each row shows the clock window and duration the work took (`CompletionTimeLine.tsx`);
values the app derived rather than observed
are marked `~` + **est.** and can be confirmed or corrected in place
(`lib/estimated-values.ts`, `lib/services/completion-time-service.ts`).
**Missed opportunities** (`MissedTodoSection.tsx`) is the too-late twin of Done:
same clear-from-open-list behavior, files on Next Actions **Missed Opportunities**
instead of Completed, no points.
**Could add:** duration rollups per day, est.-only filter.

#### Home/Tracking/
TimeGrid (`time-grid.tsx`, minute-accurate intervals, Activity / Location / Mood /
Company views; **1m/5m/10m/15m/30m** cell size on the grid chrome via `cell-size-keys.tsx`
(active key navy inset + phosphor cap); **Fill** via `fill-range-control.tsx` +
`empty-blocks.ts` (longest empty gap; chronological arrows; double-click clocks);
**now + sunrise/sunset**
lines via `trk-time-markers.tsx` — horizontal in day view, like Plan agenda /
Day Log; discrete events stay vertical ticks; do not remove; **Infinite scroll** on the grid toolbar via `infinite-strip.tsx`
(double-click a day tile / week band to open that paged span)
+ `infinite-window.ts`) + Activity Log
(`tracking-activity-log.tsx`, Log activity — optional name/notes/discrete events —
untracked-gap **+** and notes + Done this day) + Day Log (`actual-day-view.tsx` +
`daylog-week.tsx`, local Day \| Week agenda; click a planned ghost to confirm via
`confirm-planned-dialog.tsx`) + day-notes **append log**.
**Cmd/Ctrl-Z** (`tracking-undo.ts`) pops `lib/action-history.ts` while this tab or the header Tracking dialog is open (text fields keep native undo).
Win95 Tracking window (`tracking-chrome.css`); the palette is a panel inside that
frame (Show as / Sort / Expand↔Conceal / New pen on the palette rail, then a two-column `.trk-pen-tools-row`: `.trk-pen-tray`
with selected swatch + search + one-line beads (Expand unwraps; caption Conceal while open) on a photographed plate **while Draw is
selected** (spacer when it is not, so `.trk-tools-rail` stays far right), steel plates for selected/detail copy,
`.trk-tool-detail` jewel + how-to under the paint throws, and `.trk-tools-tray` with milled **Draw** / **Erase** / **Scissors** jewel radios;
**Hide** / **View** / **Tags** sit in a top **Look** well (`.trk-latches-well`) next to SHOW AS / SORT. Erase/Scissors hide the
tray), then `.trk-grid-rail` (`pen-mode-bar.tsx`: Activity / Location / Mood / Company / Screen Time / iPhone Screen Time / iPhone Calls / iPhone Texts / … plus **Log activity** on Time Grid / Day Log; Activity Log uses its own `.trk-period` latch)
immediately above `.trk-plot-bezel` (`TrkChromeStack` + `TrkPlotBezel`: TIME/DIV + Cell + Fill on one strip, growing white plot), pens as beads on the tray
(default Cat traces; View settings → Pen tray),
selected pen as a large swatch + name + **Settings**, **View** settings
(`tracking-view-settings-dialog.tsx`), **Sort** Recent / A–Z / Tree
(`lib/pen-sort.ts`). An unused view (one Default pen) no longer becomes the
saved view — persist v8. `other-scope-hint.tsx` still lives for tests but is
**not mounted** on Time Grid / week / Activity Log / Day Log (no **Show Activity (Nh)** banner on those views). Pens nest (`parentId`,
`lib/pen-tree.ts`); **Show as** picks display depth. Blocks may be assumed
(`precision`). Shared searchable palette + view-mode bar above the three Tracking sub-tabs.
A block can take a **display name** of its own ("walk to the beach" on a block
of *walking*) and carry **several pens with one primary** — the grid draws the
primary's color, and the secondaries still feed every tag, habit, operation and
goal they belong to (`assignedPenIds`, `block-pen-section.tsx`,
`secondary-pens-field.tsx`). The block editor shows those associated colors
first; **add pen color** unfolds the catalog.
**Counts as** in pen settings is a searchable picker that can create the parent
it needs (`pen-parent-picker.tsx`) plus a colored, navigable chain diagram
(`pen-chain-visual.tsx`) — see [`COUNTS_AS.md`](COUNTS_AS.md). A pen can also
carry **default action formats** (`pen-action-format-editor.tsx`) that name a
Done-today row from a painted block — see
[`PEN_ACTION_FORMATS.md`](PEN_ACTION_FORMATS.md).
Pens carry cross-scope **tags** (`pen-settings-dialog.tsx`, `tracking-tags-panel.tsx`)
and a single block can carry extra tags of its own (`entry-dialog.tsx`) — four hours
at the zoo counting as Exercise without every zoo visit doing so forever. Tagged
minutes auto-fill any daily habit that links the tag
(`lib/tracked-time.ts` → `lib/habit-tracking.ts` → `lib/habit-tracking-sync.ts`).
Opening a block also shows **Also happening** (`companion-section.tsx`): what every
other scope says about those minutes, and one click to fill in what they are missing
— *Ian's House* 1–5pm attached to *Social* with the guest list ticked off inline, as
a one-off or as a standing rule on the pen (`lib/entry-links.ts`). Attachments only
ever fill minutes the other scope left blank.
**Working on this now** (`working-now-strip.tsx`) and **Working on right now**
(`pen-color-now-strip.tsx`) sit in `.trk-now-module` under the Tracking view
switcher (before the chrome stack). The Operations strip starts a session that
paints the same grid. Sleep is painted on the Time Grid or typed in the
block editor / Morning Review — there is no **Sleep this day** form
(`lib/sleep-log.ts` → `lib/sleep-store.ts` → `lib/sleep-sync.ts`). Logged nights
are painted onto the grid when Tracking mounts, after both persist vaults
hydrate, so Analytics cannot show hours the Time Grid never drew. A From/To fill
that crosses midnight continues onto the next morning as one `spanId` block. Sleep
painted straight onto the grid is read back into the log (`lib/sleep-inference.ts`),
and Analytics → Sleep reflects it either way.
**Could add:** per-tag trends over a week/month.

---

### Completion (global)

`Completion/CompletionPopupHost.tsx` + `CompletionDialog.tsx` — mounted once in
`app/layout.tsx`. Subscribes to the completion event bus (`lib/completion-events.ts`,
emitted by `task-store.updateTask`) so a popup appears on **every** task completion.
Captures objective/goal contributions (searchable lists), advances goals, and awards the stacking
objective point multipliers (1.5× default; prioritized objectives use a custom
multiplier). Footer **Undo** reopens the task as still to-do (and drops that day's
base points); **Skip** keeps the win without a contribution; **Save** records one.
→ [`components/Completion/README.md`](../components/Completion/README.md)

---

### Docs (top-level tab)

WYSIWYG document workspace over `note` items (`components/Docs/`): folder sidebar,
auto-save, Google Fonts, images, PDF ingest. Helpers: `lib/doc-html.ts`,
`doc-links.ts`, `google-fonts.ts`, `image-resize.ts`, `pdf-to-html.ts`.

→ [`components/Docs/README.md`](../components/Docs/README.md)

---

### Lists

Win98 file manager — folders, lists, items via `task-store`. New rows default to
generic `item` (or `list.itemTypeId`). Smart lists, custom attributes, orb gallery,
CSV import, spreadsheet display. List settings overlay extra/hidden detail panels
and implied-action rules. **UI gold standard** (velvet + orbs cabinet; milled
Explorer frame in `filemanager98.css`):
[`DESIGN_STYLE.md`](DESIGN_STYLE.md).

**Entry:** `enhanced-list-view.tsx` (orchestrator) composing subfolders:

| Subfolder       | Contents                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| `hooks/`        | `useListsNavigation`, `useListsSearch`, `useListsDragDrop`, `useListsSelection`, `useListsTaskActions` |
| `navigation/`   | `FolderTree.tsx`, `BreadcrumbNav.tsx`                                     |
| `views/`        | `FolderViewIcons.tsx` + test, `FolderViewList/Details/Cards.tsx`, `SearchResultsView.tsx` |
| `list-content/` | `ListContentPanel/Default/Checklist/Icons/Details/Spreadsheet.tsx`, `SheetFullscreen.tsx`, `AllViewCheckboxFilter.tsx`, `ListMissedButton.tsx` |
| `dialogs/`      | `New/Edit List & Folder`, `InFoldersEditor`, `ConnectedListsEditor`, `ChecklistViewSettings` (view-mode host), `DefaultViewSettings`, `DetailsViewSettings`, `ListRulesEditor`, `CsvImportDialog`, `OrbPickerDialog` |
| `attributes/`   | `AttributeSchemaEditor`, `AttributeSettingsDialog`, `AttributeValueField`, `AttributeValuesEditor`, `helpers.ts` |
| `toolbar/`      | `ListsToolbar.tsx`, `ToolbarSearch.tsx`, `ViewModeControls.tsx`           |
| `lib/`          | `icon-utils.tsx`, `velvet-icon-grid.ts` (pack-to-width), `lists-location-choice.ts` (clear search on folder nav) |

**Top-level:** `attribute-editor.tsx` (barrel), `settings-dialog.tsx`, `list-picker.tsx` + `list-picker.css`,
`daily-habits-list.tsx`, `open-target.ts`, `constants.ts`, `types.ts`, `filemanager98.css`,
[`FOLDER_ALL_ITEMS.md`](../components/Lists/FOLDER_ALL_ITEMS.md).

**Helpers:** `lib/lists-grid-entries.ts`, `lib/string-utils.ts`, `lib/folder-all-items.ts` ([`FOLDER_ALL_ITEMS.md`](../components/Lists/FOLDER_ALL_ITEMS.md)), `lib/folder-membership.ts` (list↔folder filing; [`LIST_FOLDERS.md`](../components/Lists/LIST_FOLDERS.md)), `lib/scheduled-lists-sync.ts`, `lib/archive-lists.ts` (Completed / Missed Opportunities membership), `lib/checklist-checkbox-vars.ts`, `lib/spreadsheet-catalog.ts` (Spreadsheet columns; [`SPREADSHEET.md`](../components/Lists/SPREADSHEET.md)), `lib/details-columns.ts` (Details table columns; [`DETAILS.md`](../components/Lists/DETAILS.md)), `lib/default-view-prefs.ts` (Default reading-row chrome; [`DEFAULT_VIEW.md`](../components/Lists/DEFAULT_VIEW.md)), `lib/list-links.ts` (connected-list membership; [`LIST_LINKS.md`](../components/Lists/LIST_LINKS.md)), `lib/module-lists.ts`, `lib/module-list-import.ts` (Tidy/Trip → nested Module Lists items; [`MODULE_LISTS.md`](../components/Lists/MODULE_LISTS.md))

**Stores:** `task-store`, `lists-ui-store`, `habits-store`

**Tests:** `__tests__/`, `hooks/__tests__/`, `navigation/__tests__/`, `dialogs/__tests__/`, `e2e/lists.spec.ts`, `e2e/item-types-detail.spec.ts`

**Could add:** Bulk attribute editing, richer attribute types, nested categories (`parentCategoryId`, §6.2).

→ [`components/Lists/README.md`](../components/Lists/README.md)

---

### Scheduler

Period funnel: **Always → Year → Month → Week → Day**. Split into orchestrator + tabs.

| File                    | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `enhanced-scheduler.tsx` | Orchestrator — Win95 window, view modes, period tabs       |
| `scheduler-chrome.css`  | `.sch95` furniture (same family as Lists / Tracking)       |
| `scheduler-utils.ts`    | Pure logic — filtering, sort, period queries, grid builders (`lib/available-tasks` for unmet deps) |
| `GanttView.tsx` / `DependencyGraph.tsx` | Timeline / precedence documents (orbs, not editable) |
| `SchedulerTaskItem.tsx` | Draggable orb task row                                     |
| `PeriodCell.tsx`        | Droppable bucket — reserved one-line furniture when empty  |
| `PeriodFunnelTab.tsx`   | Generic Year/Month/Week tab                               |
| `AlwaysTab.tsx`         | Always list + filters + overview boxes                    |
| `DayTab.tsx` / `DayAgenda.tsx` | Day sidebar + 24-hour drop-to-hour agenda          |
| `SchedulerFilters.tsx`  | Collapsible Filters & Sort                                 |

Tasks appear only if in a **scheduleable** list (`TaskCategory.scheduleable !== false`).
**Could add:** Auto-scheduling (§7.6), event-linked checklists.

→ [`components/Scheduler/README.md`](../components/Scheduler/README.md)

---

### Operations

A little graphic tool for any project — its work, ideas, data, and progress
(trip, paid job, magazine, house…). Nothing is assumed to be trip-shaped.
Milled **command-center** chrome (`operations-chrome.css`: CRT title, engraved
nameplates, raised metal keys, equal-fill panel keys): a landing board that
groups operations under their free-form **categories** (an op can hold several),
with a category checkbox filter, sort, and **Show archived** (completed
`done` and inactive `paused` / `abandoned` stay hidden until then), then
`OperationWorkspace`, whose tab strip is built from the **panels that operation
has switched on** in its **Settings** dialog — Home (locked), To do, Phases,
Parts, Timeline, Locations, Plan, Resources, Log, plus the Queue rail. Settings
can delete the operation after **Are you sure?**. Presets (Standard / Blank /
Trip / Project / Paid job) shape a new operation in one click. **To do** embeds
the Lists content panel over a real per-operation list (`lib/operation-lists.ts`)
and also lists phase steps and part tasks. **Parts** (`lib/operation-parts.ts`,
`PartsPanel.tsx`) are formulas: a kind such as Issue → Article, or a plain Room,
each instance its own page, ideas that are not tasks, and glance metrics.
**Working on this now** (workspace menubar) logs a live session into To Do Done,
Tracking minutes, and tagged daily habits (`lib/operation-work-session.ts`).

→ [`components/Operations/README.md`](../components/Operations/README.md)

---

### Modules

Composable widget dashboard + a full user-buildable **workspace** "mini-app"
platform: bind lists, compose views, author **workflows** (Zapier-style rules),
and **pop out** a module into its own window.

| File                       | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `modules-panel.tsx`        | Orchestrator — widget grid + workspace launcher + add/configure/remove |
| `modules-chrome.css`       | Catalog (`.mod95`) + opened workspace window (`.mod95-ws`) |
| `module-helpers.ts`        | Pure helpers + `MODULE_META`, `MODULE_VIEW_KINDS` registry, rule/stat options |
| `module-bodies.tsx`        | `ModuleCard` + per-type widget bodies (analytics, list summary, writing prompt, list explorer, random task, rules) |
| `ModuleConfigDialog.tsx`   | Add/configure widget form                                     |
| `workspace/ModuleBuilderDialog.tsx` | New-module chooser: build from scratch, saved definitions, or one-click templates |
| `workspace/ModuleWorkspace.tsx` | Full-screen mini-app — tabbed views, drag-reorder, Settings/Workflows/Pop-out, plan-sync |
| `workspace/ModulePopoutView.tsx` | Standalone module render for `/popout/?module=<id>` |
| `workspace/module-popout.ts` | `/popout/?module=<id>` routing + `openModulePopout` |
| `workspace/ModuleSettingsDialog.tsx` / `ModuleListsPanel.tsx` | Edit a `ModuleDefinition` (name, bound lists, views, plan-sync) |
| `workspace/ModuleViewEditor.tsx` | Compose one bound view (spreadsheet/checklist/agenda/…/doc/itinerary-doc/trip-map/film-dna) |
| `workspace/module-view-bodies.tsx` | `ModuleViewBody` switch + per-kind render bodies; `Timer` writes `timeLogs` on complete |
| `workspace/module-view-bodies.timer.test.tsx` | Focus-timer complete → mocked `timeLogs` helper, or a one-step item prompt |
| `workspace/itinerary/*` | Trip Plan doc, printable itinerary, activities map, city/place suggest, checklists |
| `workspace/filmrecs/*` | Film DNA Lab view + poster cards |
| `workspace/housecleaning/*` | Tidy house-cleaning mini-app (`house-cleaning` view + scoped CSS) |
| `workspace/gradsearch/*` | GradSearch program explorer (`grad-search` view, bundled catalog, shadow-DOM port of the standalone app) |
| `workspace/WorkflowBuilder.tsx` / `WorkflowStepEditor.tsx` | Author per-module workflows (trigger → conditions → actions) |

**Templates:** `lib/module-templates.ts` builds one-click mini-apps — **Itinerary**
(Plan `doc` + printable `itinerary-doc` + Activities `trip-map` + City Places +
plan-sync workflow; migrate via `lib/itinerary-migrate.ts`), **Budget**
(optional-inclusion rollup dashboard),
**Book Tasting** (PDF→book `matcher` + `quiz`), **Film DNA Lab** (`film-dna`
shelves / Watch / Blend / Letterboxd import), **House Cleaning App** (Tidy:
self-contained `house-cleaning` view), and **GradSearch** (single `grad-search`
explorer over the bundled catalog — no lists) — each scaffolding lists +
attribute schemas + seed items + bound views + seeded workflows. `lib/module-plan-sync.ts`
pushes finalized dated module items into the Plan;
`lib/book-match.ts` scores PDF→book matches;
`lib/itinerary-assemble.ts` / `lib/trip-itinerary.ts` build printable day blocks;
`lib/city-search.ts` (Open-Meteo) + `lib/places-search.ts` + `lib/trip-directions.ts`
pin places and estimate distances on the map (TTL-cached in `lib/api-cache.ts`).

**Workflows:** authored rules live in `lib/workflows-store.ts` and run via the
engine (`lib/workflow-engine.ts`) wired to task mutations by
`lib/services/item-mutation-service.ts` (`initWorkflowEngine` on client mount).
The same service also runs type/list **implied actions** (`logAction` /
`incrementHabit`).
Specialized view kinds: **`matcher`**, **`quiz`**, **`dashboard`**,
**`timeline`**, **`doc`**, **`itinerary-doc`**, **`trip-map`**, **`film-dna`**,
**`house-cleaning`**, **`grad-search`**
(alongside **`decision-matrix`** / **`kanban`**).

**Stores:** `modules-store` (instances; persist v2), `module-definitions`
(reusable blueprints), `workflows-store`.

**Where this is heading:** modules become **installable** — paste a small `.tsx`
app and a wizard ports its state onto Items, registers its views, and grants
explicit bridges into Tracking / Habits / points / schedule / ingest (a cheap LLM
does the mapping once, at install time). Two current views break that rule by
keeping private records on `module.config` (`houseCleaning`, `tripItinerary`).
Those trees are **projected** into Module Lists (`lib/module-list-import.ts`) so
chores and trip days appear as nested lists; two-way Item writes remain the
target. See [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md).

→ [`components/Modules/README.md`](../components/Modules/README.md)

---

### Analytics

**Heart of the app** — mass personal data collected, presented, analyzed, and
turned into the next instrument. Chart → Lists keeps a finding a living item.

Win95 **title bar + status bar** on Lists furniture (`.fm98.an95`). Interior is a
light instrument studio: Karla only, ink on `#c0c0c0` nested wells, range chips
(7 / 14 / 30 / 90 **or** custom inclusive from–to), left studio index
(Behavior / Time / Accuracy / Meta / Library). Phosphor traces for line series.
Interpretive tabs show **n** and watermark a thin window. Empty charts keep the
frame and one sentence. Chart → Lists jump. **Item Types** is a first-class
Library view. Settings still **edits** types. Always add tooltips and a
one-sentence instruction per view.

| File | Purpose |
|------|---------|
| `enhanced-analytics.tsx` | Window: title, studio range/nav/canvas, status |
| `AnalyticsNav.tsx` | Studio index (`role="tab"`; last view per group) |
| `analytics-tabs.ts` | Views in five groups + `ANALYTICS_TAB_HELP` |
| `studio-kit.tsx` | Mosaic, pie, treemap, hour×day, density, readouts, phosphor trace, split bar, Win95 `StudioCheck`, `?` help |
| `studio-plots.tsx` / `studio-plot-stats.ts` | Horizon, ridgeline, violin, alluvial, beeswarm, slopegraph, UpSet, hour×pen, Cleveland cycle, sparkline |
| `hour-day.ts` / `observatory-findings.ts` / `signal-stats.ts` | Occupancy grid + hour×pen + weekday cycle, Pearson findings, entropy/Gini/HHI/Markov/survival |
| `Observatory.tsx` / `CrossSection.tsx` | Landing findings + linked density |
| `HabitsView.tsx` / `PointsView.tsx` / `StreaksWidget.tsx` / `VelocityView.tsx` | Behavior canvases |
| `TrackingAnalytics.tsx` / `SleepAnalytics.tsx` / `ScreenTimeView.tsx` / `CircadianView.tsx` / `PlacesView.tsx` / `MoodFieldView.tsx` / `DiversityView.tsx` / `TransitionsView.tsx` / `TextPipelineView.tsx` | Time canvases |
| `PlanVsReality.tsx` / `CalibrationView.tsx` / `CycleView.tsx` / `RegretView.tsx` / `GoalsAnalytics.tsx` | Accuracy canvases |
| `SpectrumView.tsx` | Autocorr + periodogram + sleep CV |
| `ItemTypesLibrary.tsx` / `ListsAreasView.tsx` / `AttributesView.tsx` / `LibraryCuts.tsx` | Library (types, lists sized by count + HHI, tags, stages, weight) |
| `analytics-range.ts` + store / `chart-frame.tsx` / `open-in-lists.ts` | Shared window, honesty frames, Lists jump |
| `analytics-chrome.css` | Milled range/index chrome + studio interior (title/status stay Lists) |

| Group | Views |
|-------|-------|
| **Behavior** | Habits · Streaks · Points · Velocity · Reflection · Reviews · Overcommit |
| **Time** | Tracking (pie + mosaic + weekday/weekend; drill lists/edits blocks) · Sleep · Circadian · Places · Mood field · Diversity · Transitions · Context Switch · Operations |
| **Accuracy** | Plan vs Reality · Calibration · Cycle (survival of open items) · Regret · Goals |
| **Meta** | Observatory · Cross-section · Metrics · Correlation · Spectrum |
| **Library** | Item Types · Lists & areas · Attributes · Tags · Stages · Weight |

→ [`components/Analytics/README.md`](../components/Analytics/README.md)

---

### Reviews

Header Review dropdown (not a tab) — day/week/month/quarter/year ritual: unfinished
items, **assumed times**, summary, gratitude, plan reflection, reflection questions,
next plans. Due badge when a period is unreviewed; saved reviews browse in Analytics.
**Assumed times** (`AssumedTimesSection.tsx`, day/week/month only) lists the period's
completions whose time the app autogenerated — habit rates, painted Tracking minutes,
"finished just now", that night's bedtime, the day anchor — each with its basis, correctable inline or
accepted in bulk (`lib/estimated-values.ts` → `lib/services/completion-time-service.ts`).
Helpers: `lib/pending-reviews.ts`. **Post-mortems:** `PostMortemDialog.tsx` +
`lib/services/completion-service.ts` capture per-task satisfaction/resistance/focus.
**Spoken affirmations:** `MorningReview.tsx`'s Speak them button opens
`AffirmationsDialog.tsx` (stacks above), which picks 5 random lines from the Lists
"affirmations" list (case-insensitive; older "Affirmations" still matches) and gates "Next" on a *confident vocal delivery* — mic streamed
via `hooks/useVocalConfidence.ts` and scored by the research-grounded analyzer in
`lib/vocal-confidence.ts` (loudness · steadiness · conviction · full delivery; list
helpers in `lib/affirmations.ts`).
**Could add:** Full §13 cadence, spawned items.

→ [`components/Reviews/README.md`](../components/Reviews/README.md)

---

### Settings / Focus

- `Settings/SettingsDialog.tsx` (header) — **Data profile** (Live vs Demo,
  `DataProfileField.tsx`) first, then **Window gray**, **Desktop**
  (`PcbBackdropField` — teal plus five photographed plates; `theme-store.pcbMode`) +
  **Home location** (Plan sunrise/sunset,
  default San Diego) + **Default time of day** (`Settings/DayAnchorField.tsx` —
  the finish time assumed for work logged against a day that already ended,
  default 9:00 PM) + full app **backup/restore**
  (`Settings/BackupRestore.tsx` → `lib/data/backup.ts`) + **Set up Second Brain**
  (seeds Source/Belief item types via `item-type-store.seedSecondBrainTypes`) +
  **Manage Item Types** (`components/ItemTypes/`). Settings
  still exposes confirm-gated manual hub push/pull (`MobileSyncPanel`) and
  **Message ingest** (`MessageIngestPanel` — Telegram pairing, grocery pin,
  always-on hub, shortcuts, iPhone Notes / Screen Time / Call / Text Shortcut AirDrop, cheat-sheet, simulate message + scan; see [`MESSAGE_INGEST.md`](MESSAGE_INGEST.md)) +
  **Screen Time** (`ScreenTimePanel` — ActivityWatch URL, lookback, Sync now).
- `ItemTypes/ItemTypeList.tsx` + `ItemTypeEditor.tsx` — create/edit/delete user
  **item types**: attribute schema, capabilities (gate detail tabs), detail
  panels/layout, implied-action rules, recipe/hint cards. System types locked;
  catalog types (Book, Furniture, …) editable.
- `Focus/JustStartMode.tsx` — ADHD anti-paralysis overlay: one smallest molecular
  step + 2-minute timer; launched from the To-Do panel.
- `Search/GlobalSearch.tsx` — Cmd/Ctrl-K command palette over `lib/search.ts`.

---

### spreadsheet

`SheetGrid.tsx` — Google-Sheets-style inline-editable grid over items. Columns
come from `lib/spreadsheet-catalog.ts` (on-this-list attributes, vault attrs,
built-in fields). Add-column lives in `AddColumnDialog.tsx` (associated attrs
first, then vault, or create + assign-to-all). Keyboard arrows/Tab/Enter/
type-to-replace/Escape are wired through `lib/spreadsheet-keys.ts`. Header menu
offers Sort, **Attribute settings** (existing schema editor for that attr id;
name / built-in fields stay disabled), insert / move, and Hide. Hide writes
`List.sheetConfig.columnIds` (same picker as Spreadsheet view mode settings)
without destroying the attribute. Per-list layout
is `List.sheetConfig` (`columnIds`, sort, filter, freeze, widths). Headers are
centered with reserved sort-caret slots (`sheet-chrome.css`). Blanks sort last.
Column widths persist at `sheetConfig.columnWidths`. Lists
**Spreadsheet** display (`components/Lists/SPREADSHEET.md`) and Module workspace
spreadsheet views share the grid. Lists can lift that same instance into an
in-app Win95 maximized child window (not OS fullscreen; not `/popout/?sheet=`).

The serializable view shape (`SheetViewConfig`) lives in
`lib/spreadsheet-contract.ts`; the engine is `lib/sheet-a1.ts`,
`lib/sheet-eval.ts`, `lib/spreadsheet-keys.ts`, and `lib/spreadsheet-catalog.ts`.
Column math stays in `lib/spreadsheet-utils.ts`.

---

### ui

shadcn/ui primitives (18 kept): alert, badge, button, card, checkbox, collapsible,
dialog, dropdown-menu, input, label, progress, select, separator, switch, table,
tabs, textarea, tooltip — plus `unsaved-changes-guard.tsx` / `unsaved-changes.css`
(house dirty-close confirm). Unused defaults removed; Analytics uses recharts directly.

→ [`components/ui/README.md`](../components/ui/README.md)

---

## lib/

Data model, Zustand stores (localStorage today → MongoDB), pure helpers. Not React UI.

### Stores

localStorage keys are **`brain2-*`**. Historical **`cogs-*`** keys are a lossless alias so existing vaults hydrate. The product is **BRAIN2** / **Brain2**.

| File                     | Key                       | Purpose                    |
| ------------------------ | ------------------------- | -------------------------- |
| `task-store.ts`          | `cogs-task-storage`       | Item records (`tasks[]`); persist v12 honest `type` |
| `event-store.ts`         | `cogs-event-storage`      | Calendar events            |
| `planned-action-store.ts` | `brain2-planned-actions` | Day-agenda planned actions (not events) |
| `habits-store.ts`        | `cogs-habits-store` (v15) | Habits + completions; `migrateHabitsState` never drops `tasks` or present tube/LED colors; gems; sort |
| `goals-store.ts`         | `cogs-goals-store`        | Objectives (prioritized + multipliers) + Goals |
| `points-store.ts`        | `points-store`            | Points ledger              |
| `time-tracking-store.ts` | `brain2-timegrid-store`     | TimeGrid views/pens/intervals/parents/precision; persist **v11** appends Screen Time without switching the active view; persist v8 reopens a painted view when the saved view is empty; data writes are Cmd/Ctrl-Z undoable |
| `day-notes-persist.ts`   | `brain2-tracking-day-notes` | Tracking day-notes append log (submit-stamped; hub-synced on this small key) |
| `pen-tree.ts` | Parent/child rollup and display-depth options for Tracking pens |
| `pen-sort.ts` | Palette order: Recent / A–Z / Tree; last-used from paint |
| `pen-action-format.ts` | Turns a painted block into a Done-today title: template variables, most-specific-match selection, deterministic row id. Pure |
| `pen-action-sync.ts` | Store bridge for the above — upserts/removes the `pen-action-*` Done row as blocks are painted, retimed, relocated, or deleted; never overwrites a title the user edited |
| `work-session-store.ts`  | `cogs-work-session`       | Live Operations "working on this now" pointer |
| `pen-color-session-store.ts` | `brain2-pen-color-session` | Live pen-color "working on right now" pointer |
| `reviews-store.ts`       | `cogs-reviews-store`      | Period reviews             |
| `modules-store.ts`       | `cogs-modules-store`      | Module widgets + workspace views (persist v2) |
| `module-definitions.ts`  | `cogs-module-definitions` | Reusable module blueprints (`ModuleDefinition`) |
| `workflows-store.ts`     | `cogs-workflows-store`    | Authored per-module workflows (rules) |
| `item-type-store.ts`     | `cogs-item-types-store`   | Item type registry (system Task/Item/Note/Operation re-seeded; catalog Book/Furniture/Resource/Shopping/Flight persist). Persist v2 `migrate` keeps older snapshots. |
| `lists-ui-store.ts`      | `cogs-lists-ui`           | Lists UI prefs, orb gallery |
| `home-widgets-store.ts`  | `cogs-home-widgets`       | Home overview square visibility + order (persist v4) |
| `home-weather-store.ts`  | `cogs-home-weather`       | Home weather widget city + beach (Settings city is fallback) |
| `home-days-until-store.ts` | `cogs-home-days-until`  | Days Until date + label |
| `home-weather.ts`        | rain copy, advisories, human forecast, place sanitize |
| `home-widgets.ts`        | catalog / sanitize / 3-stop Habits gradient for the Home strip |
| `home-glances.ts`        | Night well, Harvest leftover, and Inbox mill faces |
| `solar-remainder.ts`     | Solar remainder phases for the Home sun tile |
| `tracking-presence.ts`   | Current vs last-known Activity / Location / Mood / Company |
| `theme-store.ts`         | `cogs-theme-store`        | Theme colors + `chromeFace` gunmetal set-point + `pcbMode` desktop PCB plate (persist v4; picks stamp a wall-clock `appearanceRev`) |
| `user-settings-store.ts` | `cogs-user-settings`      | Home city (Plan sun times); `dayAnchorMinutes` (assumed finish time for a day already over, default 9:00 PM) |
| `ui-names-store.ts`      | `brain2-ui-names`         | Overlay mode (`off` / `names`). First `data-ui-mode`. Included in the Settings full backup. |
| `ingest/ingest-store.ts` | `brain2-ingest-store` | Phone-message pairing, allowlist, shortcuts, hub URL, grocery pins, ingest log (poll timestamps are memory-only) |

### Pure helpers

| File | Purpose |
| ---- | ------- |
| `chrome-patina.ts` | Cool gunmetal `--chrome-face` family (chroma 0); Settings set-point + 24-minute live drift |
| `appearance-rev.ts` | Wall-clock `appearanceRev` stamp for plate / hue picks, so a pick made before persist rehydration still wins the merge |
| `pcb-backdrop.ts` | Five photographed desktop PCB modes; `data-pcb-mode` / ink; first-paint boot script; `brain2-pcb-mode` pin + this page's `brain2-pcb-pick` |
| `baby-animals.ts` | Fixed cute-name list + Monday week key + occasional cut-out search flavors |
| `friend-photo-vault.ts` | Per-card picture bytes (`friend:<id>` / `cogs-friend-pic:<id>`) |
| `friend-pack.ts` | Preapproved `animalsrcs/` gallery merge/sort; skip dismissed pack ids |
| `friend-gallery.ts` | Friend card identity, dismiss keys, persist/hub reconcile |
| `friend-pack-manifest.ts` | Generated 71-file `/friend-pack/` catalog |
| `baby-animal-photos.ts` | Friend picture record + upload knockout into the friend vault (no web search) |
| `baby-animal-friend.ts` | Pack-only wear / name / upload; Monday-only auto-roll; dismissed stay gone |
| `baby-animal-greeting.ts` | Worn-friend pin + dismiss pin (union-only) + visit history + reunion lines (not on refresh) |
| `baby-animal-nudge.ts` | Nest adapter → scored suggestion pick |
| `friend-personality-fits.ts` | Name + photograph voice for named gallery friends |
| `baby-animal-personality.ts` | Species source bias + quirks (love-you, whims, title loves, dialog effects); stored overlay |
| `friend-suggestion.ts` | Weighted pick over habits / To Do / Next Actions + flavor |
| `friend-copy.ts` | Tone × source Stardew lines |
| `friend-whims.ts` | Soft real-world missions |
| `friend-mission.ts` | Mission journal: offered, accepted until midnight, declined with a reason, done, expired |
| `friend-mission-steps.ts` | Smaller-task and first-step writes shared by the sheet and the instrument |
| `friend-reward.ts` | Friend mission points via `points-store` |
| `friend-stats.ts` | Bond level, streak, badges, source-mix shares, journal grouping |
| `baby-animals-store.ts` | Friend gallery persist v7; names on card id; dismissed stay gone |
| `types.ts` | Shared interfaces — `Task`, `Item`, `ItemTypeDefinition`, events, habits, reviews, attributes |
| `calculations.ts` | Habit completion math (5 types; climb via incremental-habits; week-to-date + output grades; 0% not curved) |
| `incremental-habits.ts` | Daily vs weekly climb: last-log daily targets (drops count); 4-day weekly bump; persist v3 |
| `habit-points.ts` | Daily habit 50×ratio points; user accomplishment bonus (default +50 at ≥80% raw); 75% grade bonuses (100 either / 300 both); editable grade-lift bonuses vs yesterday and vs last week |
| `habit-accomplishment.ts` | Good day threshold/bonus; streak; last-30 count (independent of grade curves) |
| `habit-done-log.ts` | Mirror habit completions into To-Do Done, with a derived duration + clock window (`deriveHabitCompletion`), refreshed while the goal stays met unless confirmed |
| `operation-work-session.ts` | Live Operations "working on this now": Tracking paint, Done `worked on {name}`, timeLogs, habit tags |
| `pen-color-session.ts` | Live pen-color "working on right now": timer from this second, Tracking block of that pen |
| `focus-timer-log.ts` | Module focus timer complete → `timeLogs` on Working Now or a picked item (no Tracking paint) |
| `habit-time-estimate.ts` | How long a habit's period took: its own minutes/hours value → painted Tracking minutes → amount × `minutesPerUnit` → flat length |
| `completion-window.ts` | Where in the day a completion sat: last painted Tracking run → "just now" → that night's bedtime (stated, painted, or your usual), falling back to the day anchor; never backdated past the wake time |
| `estimated-values.ts` | `FieldEstimate` provenance for autogenerated values; sticky confirmation (`canRegenerate`) |
| `habit-week-streaks.ts` | 4+ day week streaks for daily habit chips |
| `habit-led.ts` | Percent LED tint, `cogs-habit-led-tint` pin + this page's `brain2-led-pick`, lamp off/on/partial, same rounded `%` text as the old bars |
| `habit-tube.ts` | Grade-tube discharge hues (`gradeTubeColor` / `outputGradeTubeColor`) and `dischargePaint` |
| `time-entries.ts` | `TimeEntry` interval model — minute resolution, a **primary pen plus secondaries** (`assignedPenIds`), an optional block **display name** (`entryDisplayName`), variants, block-level tags, `precision` (omit = certain, `"estimated"` = assumed), `generatedBy` provenance, `spanId` for midnight-crossing blocks, wrap/merge/split/clip |
| `action-history.ts` | Last-action undo/redo for Home and Tracking (Cmd/Ctrl-Z); snapshots tracking + sleep + work session + pen-color session + habits + points + tasks; Tracking capture-phase chord in `tracking-undo.ts` |
| `tracked-time.ts` | Minutes per TimeGrid tag for a day; `entryTagIds` unions the standing tags of **every pen assigned to a block** (primary and secondary) with the block's own, then unions minutes across scopes so a doubly-tagged minute counts once — this is what makes a secondary pen feed habits rather than just tint a block |
| `tracking-summary.ts` | Occupancy, pen totals at a display depth, child drill, variant split/reach, tag totals, withPrecision, otherScopeOccupancy — Time Grid, Activity Log, Day Log, and Analytics all read it |
| `entry-links.ts` | Cross-scope attachment: what else covers a block's window, painting a companion into the blank minutes, standing `PenLink` rules, and pairings suggested from your own history |
| `sleep-log.ts` | `SleepNight` model + pure math: day-local placement (`placeAsleepOnDay` / `sleepRowsForDay`), signed offsets from the morning's midnight, durations, day-split intervals, stats, trends, and the median night |
| `sleep-sun.ts` | Sleep/wake vs that day's persisted sunrise/sunset (minutes before/after; median) |
| `sun-times.ts` | Local sunrise/sunset for a date + lat/lng |
| `sun-times-store.ts` | Persisted per-day sun cache (`brain2-sun-times`; first write per date sticks) |
| `sleep-store.ts` | Persisted nightly sleep log (`cogs-sleep-store`), per-end estimated/certain precision, sleep target |
| `sleep-inference.ts` | Reads a night off Sleep-tagged blocks on the grid and reconciles it with the log per end — stated beats painted, borrowed ends are marked estimated |
| `sleep-sync.ts` | Derives a night into Sleep blocks, a Done row, and habit minutes — idempotent via `generatedBy.kind === "sleep"`, never overwrites hand-painted time; paints already-logged nights once both vaults hydrate; `awakeWindowFor` and `typicalNight` serve the rest of the app |
| `screentime/` | ActivityWatch meaning: map window ∩ not-afk, prefs (`brain2-screentime-prefs`), idempotent `generatedBy.kind === "screentime"` paint on the Screen Time scope only |
| `habit-tracking.ts` | Habit ⇄ tag link math; keeps typed and tracked value halves apart |
| `habit-tracking-sync.ts` | Pushes tagged tracked time into linked daily habits |
| `date-utils.ts` | Date keys, week strings, `isToday`, `startOfLocalToday`, `isPastLocalCalendarDay`, safe date guards |
| `item-utils.ts` | Schedule predicates, `createListItem` (type `item`), `isTaskItem`, `countsInDone`, `resolveCompletionPoints` |
| `plan-drag.ts` | Plan rail ↔ agenda `text/plain` payload (`brain2-plan:<kind>:<id>`) |
| `plan-rail-next-actions.ts` | Lists Next Actions workable in the shown Plan period |
| `inbox-batch.ts` | Inbox order (newest first), walk queue (selected only), rename helper, multi-select targets, batch list/deadline/delete patches (#243, #244) |
| `inbox-credit.ts` | +1 per handled Inbox idea; +50 when the Inbox hits 0 |
| `inbox-recent-lists.ts` | Persist / suggest recently used lists for Inbox walk |
| `item-types.ts` | Type registry helpers, `resolveDetailView`, `mergeTypeRegistry`, rule evaluation + implied-action effects |
| `implied-actions.ts` | Log Done actions + increment habits from type/list rules |
| `item-type-recipes.ts` | Starter schemas + implied-action hints for the type editor |
| `catalog-types.ts` | Furniture / Resource / Shopping catalog seeds |
| `book-types.ts` | Catalog **Book** (cover, pages read, implied-action rules) + `withBookType` |
| `objectives.ts` | Objectives/Goals helpers — period keys, prioritization + caps, goal progress, direction-in-life coverage |
| `completion-events.ts` | Completion event bus (`onTaskCompleted`/`emitTaskCompleted`/`requestTaskCompletion`) |
| `completion-status.ts` | `done ⇔ completed`; `"missed"` is too-late (`isClearedFromWork`) |
| `flight-types.ts` | Catalog **Flight** item type (airline, airports, times, layovers, cost, booked) + `withFlightType` |
| `file-extract.ts` | Best-effort `extractText(FileValue\|File)` — text inline, PDF via Electron `window.desktop.extractPdfText`, graceful browser fallback |
| `apple-notes.ts` | Apple Notes ingest: preview/snippet/bodies fetch (Electron IPC or localhost `/api/notes`), bulk-add parse (`Folder: List:` headers), park on **iPhone Notes Ingest** / **notes to ingest** or Telegram Shortcut park on **iPhone Notes Store** / **Parked**, skip ingested ids; From Notes dialog session survives close/reopen |
| `ingest/` | Phone-message ingest (Telegram first): parser, grocery/notes/pin, list dumps (`Name:` then lines; grocery headers use the store list; identical open items ask see / again / dismiss; `before 9/12:` is due that day), receipt OCR, journal/PDF Docs scans, `iphone-notes` park, iPhone Screen Time / Calls / Texts, plan log / to-do / morning review / `gps:`, list/folder/inbox read-back, pairing that a refresh cannot wipe, always-on hub — [`ingest/README.md`](../lib/ingest/README.md) |
| `smart-parse.ts` | Smart-capture parser: colon paths, dates/times/priority/duration, `parsePathHeader` |
| `capture-target.ts` | Create/resolve folder+list from a capture path; build Inbox vs filed tasks |
| `migrations.ts` | Versioned Item-model migrations (backfill `type`/`title`/`tags`/`links`) |
| `habit-exemption.ts` | Exemption wand: automatic pre-creation waivers, all-nighter log blocks, explicit overrides, streak days that are skipped |
| `habit-connections.ts` | Sleep-clock and next-action list connections that can check a daily yes/no habit |
| `habit-connection-sync.ts` | Writes those connection checks when the sleep log or a finished next action changes |
| `habit-utils.ts` | Habit type aliases; `isHabitGoalMet` with date/`weeklyData` for climb |
| `attribute-utils.ts` | Legacy attribute normalization/coercion |
| `append-log.ts` | Shared append log (`v: 1` JSON; stamp `9/20 9pm`; List / Bulk / Latest) |
| `plan-text.ts` | Plan period keys on the append log (`dayPlan-*` / `weekPlan-*` / `monthPlan-*`) |
| `folder-all-items.ts` | Per-folder All Items sync + view prefs on the backing list |
| `list-links.ts` | Connected-list membership (`List.linkedTargetListIds`); exclusions; unlink without mass-delete |
| `scheduled-lists-sync.ts` | Smart lists ↔ scheduled folders; creates Completed + Missed Opportunities lists |
| `archive-lists.ts` | Archive list membership on `Task.lists`; reuse-by-name; exclusions |
| `checklist-checkbox-vars.ts` | Checklist columns: default Completed only |
| `details-columns.ts` | Details table column ids (`List.detailsColumns`; not spreadsheet) |
| `lists-grid-entries.ts` | `buildGridEntries()` for Lists navigation |
| `string-utils.ts` | `hashString`, `hashIconSlot` for orb/icon placement and connector mock seeds |
| `spreadsheet-catalog.ts` | Attribute → column catalog (on-this-list / vault / built-ins); per-list `columnIds`; hide is view-only; `attributeSettingsForColumn` |
| `spreadsheet-contract.ts` | Serializable `SheetViewConfig` (sort/filter/freeze/widths/row-heights/`columnIds`); blanks always last; `persistSheetViewConfig` / `columnWidthsByList` |
| `spreadsheet-utils.ts` | Numeric column detect, aggregation, optional-inclusion rollups for SheetGrid + summaries |
| `spreadsheet-keys.ts` | Pure grid interaction model: cell navigation, range math, clipboard TSV, and selection stats (Sum/Avg/Min/Max/Count) |
| `sheet-a1.ts` | A1-notation math: column letters ↔ index, `parseA1`/`formatA1`, `isCellFormula`, `extractA1Refs`, and `shiftFormula` (relative-ref rewriting for fill-drag, `$`-absolute aware) |
| `sheet-eval.ts` | Evaluates per-cell `=A1` formulas against a grid accessor (reuses `lib/formula`, resolves cross-cell refs recursively with cycle detection) |
| `module-templates.ts` | Pre-built workspace mini-app templates (Itinerary v2 doc/map/print / House Cleaning / Budget / Book-Tasting / Film DNA Lab / Blank); instantiate also projects Tidy/Trip into Module Lists |
| `module-lists.ts` | Module Lists folder tree + hide-from-All + `createdByModuleId` filing |
| `module-list-import.ts` / `-shared` / `-tidy` / `-trip` | Tidy chores + Trip days → nested Module Lists items (idempotent) |
| `module-plan-sync.ts` | Push finalized module items into Plan text |
| `itinerary-assemble.ts` | Pure day-block assembly for printable itineraries |
| `itinerary-migrate.ts` | Upgrade older Itinerary workspaces to the v2 view set |
| `trip-itinerary.ts` | Self-contained trip days on module config; projected into Module Lists (`module-list-import-trip.ts`) |
| `trip-activity-lists.ts` / `trip-directions.ts` | Activities buckets + map distance estimates |
| `city-search.ts` / `places-search.ts` | City + place autocomplete for itinerary inputs (cached) |
| `parse-event-text.ts` | Unstructured itinerary text → calendar event drafts (Plan Paste Events) |
| `api-cache.ts` | In-memory TTL cache for geocode / places / weather / routes |
| `vault-guard.js` | Shrink/seed guard for Lists, Habits, Tracking, Sleep — local wins unless it would wipe the hub; color / PCB prefs overlay from local when the hub vault is richer but older |
| `persist-storage.ts` | Guarded Zustand persist adapter; Electron returns a rich local snapshot immediately and only waits on the hub for missing/seed-sized keys; identical writes are skipped; `userData` pinned to Application Support/`cogs` |
| `use-persist-hydrated.ts` | Wait for Zustand persist hydration (Habits sheet + tracking sync) |
| `mobile-sync.ts` | HTTP client for the optional mobile hub (manual push/pull only) |
| `geocode.ts` | `parseCoord` + Open-Meteo URL helper |
| `weather-client.ts` | Open-Meteo forecast + sunrise/sunset for itinerary days; Home hourly + 7-day + AQI via `fetchHomeDayWeather` / `fetchHomeAirQuality`. Tracking plot sun is `sun-times.ts` (persisted per day), not this TTL weather cache. |
| `tide-client.ts` | NOAA CO-OPS tides for the Home weather instrument (Ocean Beach / San Diego → 9410230; beach picker) |
| `flight-lookup.ts` / `parse-flight-text.ts` | Flight number lookup + airline-paste parser |
| `filmrecs-types.ts` / `filmrecs-catalog.ts` / `filmrecs-score.ts` | Film DNA Lab catalog + offline scoring |
| `house-cleaning.ts` | Tidy house-cleaning model on `module.config.houseCleaning` — ⚠ shadow database; projected into Module Lists (`module-list-import-tidy.ts`); two-way Items still the target ([`MODULE_PLATFORM.md`](MODULE_PLATFORM.md)) |
| `letterboxd-parse.ts` | Letterboxd export-folder / CSV merge |
| `doc-html.ts` / `doc-links.ts` | Docs HTML sanitize + hyperlink helpers |
| `google-fonts.ts` | Allow-listed Google Fonts for Docs |
| `image-resize.ts` / `pdf-to-html.ts` | Docs image compress + PDF ingest |
| `folder-tree.ts` | Nested folder sidebar tree helpers |
| `module-definitions.ts` | `ModuleDefinition` store + pure (de)serialize / instantiate helpers |
| `book-match.ts` | Score/`findBookMatch` PDF extracted-text → book candidate (matcher + quiz) |
| `workflow-hooks.ts` | Dependency-free mutation seam (`registerItemMutationDispatcher`/`dispatchItemMutation`) called by task-store |
| `workflow-engine.ts` | `dispatchWorkflows` — trigger/condition/action evaluation with re-entrancy cap |
| `services/item-mutation-service.ts` | `initWorkflowEngine`: workflows + implied-action listener (`logAction` / `incrementHabit`) |
| `services/completion-time-service.ts` | Confirm/correct an autogenerated completion time; confirmation is what stops re-derivation |
| `data/task-repository.ts` · `data/data-source.ts` | Repository + pluggable data source (local/IPC/mongo) behind the workflow adapter |
| `pending-reviews.ts` | Which end-of-period reviews are still due |
| `affirmations.ts` | Morning affirmations ritual: find/seed Lists "affirmations", read lines, `pickRandom` session subset |
| `vocal-confidence.ts` | Pure vocal-confidence DSP + scoring (McLeod-Pitch-Method `detectPitch`, jitter/shimmer, uptalk/trailing-off, `ConfidenceTracker`) for the affirmations ritual |
| `unsaved-changes.ts` | Dirty snapshot compare for the house unsaved-changes confirm (`useUnsavedGuard`) |
| `app-brand.ts` | Product name: chrome **BRAIN2**, prose **Brain2**; persist keys are **`brain2-*`** (`cogs-*` alias) |
| `storage-keys.ts` | Canonical `brain2-*` persist keys; small Live dual-write `cogs-*`; large vaults `brain2-*` only; Demo `brain2-demo-*` |
| `data-profile.ts` | Switch Live ↔ Demo (reload); Reset Demo wipes only demo keys |
| `demo-vault.ts` | Stock fiction vault (River Hale) for the Demo profile |
| `app-navigation.ts` | Persist last active tab/location + scroll offsets to localStorage (incl. Docs doc/folder/scroll) |
| `use-persisted-tab.ts` | Restore a Radix tab after mount so the stored value wins over the SSR fallback |
| `use-persisted-scroll.ts` | Restore a scroller's `scrollTop` after remount / refresh (`ui-scroll` slots) |
| `use-current-date.ts` | Shared Home calendar cursor with midnight rollover only while viewing today; the chosen day persists across refresh and tab switches |
| `csv.ts` | Lists CSV import parser |
| `remove-background.ts` | Orb studio knockout + photograph subject cutout |
| `orbs-manifest.ts` | Auto-generated orb PNG list |
| `gems-manifest.ts` | Every PNG in `public/gems-removebackground/` |
| `habit-gems.ts` | Habit furniture slots + random persisted row jewels |
| `use-persist-hydrated.ts` | Wait for Zustand persist hydration |
| `utils.ts` | `cn()` — clsx + tailwind-merge |

**Could add:** MongoDB + schema migrations + JSON export/import (§3). Unified `Item` field de-dup in `types.ts` (§5).

→ [`lib/README.md`](../lib/README.md)

---

## electron/

Desktop shell — dev: `localhost:3000`; prod: `app://` → `out/`.

| File         | Purpose                                          |
| ------------ | ------------------------------------------------ |
| `main.js`    | Main process, `app://` scheme, BrowserWindow, static serving, optional PDF→text + Apple Notes + ActivityWatch IPC + Telegram long-poll. Pins `userData` to `cogs` (`user-data-path.js`) so a brand rename cannot orphan the vault. |
| `user-data-path.js` | Stable Electron Application Support folder (`cogs`). Unit-tested. |
| `preload.js` | Context-isolated `window.desktop` API (incl. `extractPdfText`, `fetchAppleNotes`, `fetchScreenTime`, `telegram`) |
| `telegram-ingest.js` | Telegram `getUpdates` poller; token via `safeStorage` or gitignored `.env.local`; downloads photo/PDF bytes; yields to `npm run phone:hub`; pins grocery |
| `telegram-file.js` | `getFile` download of Telegram photos and PDFs |
| `apple-notes.js` / `apple-notes.jxa` | Notes.app reader (`preview` / `snippet` / `bodies`) for iCloud / iPhone + On My Mac; used by IPC and `/api/notes` |
| `activitywatch.js` | Loopback ActivityWatch client (`/api/0/info`, window/AFK/web events). Never embeds aw-server. |
| `ipc/channels.js` | IPC channel-name constants (incl. `extractPdfText`, `fetchAppleNotes`, `fetchScreenTime`, telegram) |

**Could add:** MongoDB connection lifecycle + IPC (§3).

→ [`electron/README.md`](../electron/README.md)

---

## hooks/

App-wide shared React hooks. Module-specific hooks live next to their UI (e.g.
`components/Lists/hooks/`).

| File | Purpose |
| ---- | ------- |
| `useQuickCaptureHotkey.ts` | Quick-capture open/close state + in-app capture chord; bridges the Electron global accelerator |
| `useMessageIngest.ts` | Drain Telegram IPC / `/api/ingest` into `lib/ingest`; album buffer; split long read dumps |
| `useUndoHotkey.ts` | Cmd/Ctrl-Z last-action undo / Cmd/Ctrl-Shift-Z redo for Home and Tracking; Tracking adds capture-phase `tracking-undo.ts` |
| `useVocalConfidence.ts` | Mic → `AnalyserNode` → `ConfidenceTracker` live `ConfidenceScore` for the Morning affirmations ritual |
| `use-screentime-sync.ts` | Poll ActivityWatch → Screen Time while Tracking/Analytics are mounted (not the block editor) |

→ [`hooks/README.md`](../hooks/README.md)

---

## designrefs/

Moodboard stills for the Divine Machinery / Computer Angel / Y2K wave (43 images,
no notes, no subfolders). Not shipped assets except five PCB plates copied to
`public/pcb/` and six Tracking pen-tray stills copied to `public/pen-tray/`. Catalog (ideas / direct-use images / apply language — materials,
lamps, CRTs, metal, weather instruments, equal-height modules):
[`DESIGN_REFS.md`](DESIGN_REFS.md). Habits / Home interiors may go feral from
these; Lists / Plan / Scheduler window chrome may not.

---

## docs/

| File              | Purpose                               |
| ----------------- | ------------------------------------- |
| `SPEC_MAPPING.md` | Spec → code checklist (✅ 🟡 ⛔ 🕓)     |
| `MODULE_PLATFORM.md` | **North star** — install any small `.tsx` app into the brain (port wizard + LLM-assisted mapping); five laws, install ladder, manifest + bridge grants, shadow-DB debt |
| `ARCHITECTURE_MODULARITY.md` | Platform vs duplicated chrome; foundation-first refactor order; deliberate *do not extract* list |
| `MESSAGE_INGEST.md` | Phone-message ingest (**BIM**): command language, manuals, hub, pin, pairing, Shortcuts, OCR |
| `BIM_COMMANDS.md` | Complete BIM command catalog (every verb/alias/expansion/preset/GM reply/retired `g`) |
| `shortcuts/` | Signed AirDrop files: [`Dump iPhone Notes to Brain2.shortcut`](shortcuts/Dump%20iPhone%20Notes%20to%20Brain2.shortcut), [`Screen Time to Brain2.shortcut`](shortcuts/Screen%20Time%20to%20Brain2.shortcut), [`iPhone Call to Brain2.shortcut`](shortcuts/iPhone%20Call%20to%20Brain2.shortcut), [`iPhone Text to Brain2.shortcut`](shortcuts/iPhone%20Text%20to%20Brain2.shortcut), [`Location to Brain2.shortcut`](shortcuts/Location%20to%20Brain2.shortcut) + recipes [`dump-iphone-notes-to-brain2.md`](shortcuts/dump-iphone-notes-to-brain2.md), [`screen-time-to-brain2.md`](shortcuts/screen-time-to-brain2.md), [`iphone-calls-and-texts-to-brain2.md`](shortcuts/iphone-calls-and-texts-to-brain2.md), [`iphone-location-to-brain2.md`](shortcuts/iphone-location-to-brain2.md) |
| `DESIGN_STYLE.md` | UI gold standard — **Habits is the favorite / most developed interior** (look there first); Lists chrome + velvet/orbs; feral module skins |
| `DESIGN_REFS.md` | Catalog of `designrefs/` (43 images) — ideas / direct assets / apply language; desktop PCB shipped; Habits interior now; Home equal-height weather modules later |
| `PLAN_OF_ACTION.md` | Combined multi-agent work order (screens + mechanics; conflicts resolved). Wave 13 points at the map-and-territory build. Wave 14 points at the meaning-layer build. Wave 15 points at the steersman build |
| `MAP_LOOP_MEANING.md` | The join: how map, loop, and meaning perfect Brain2. Laws for builders. Not the queue |
| `ScienceandSanityBrain2.md` | Map and territory: parallels with general semantics, and the ten-slice plan (GS-1 … GS-10). Product chrome never names the book |
| `jungideas.md` | Source essay: Synchronicity and Stages of Life read against Brain2. Parallels only |
| `JungBrain2.md` | Meaning-layer plan (JG-1 … JG-10). Not built. Product chrome never names the book |
| `cyberneticsbrain2.md` | Steersman plan (CY-1 … CY-11). Not built. One derived gap, three speeds, silence inside a band. Product chrome never names the book |
| `brain2taoism.md` | Source essay: *Taoism: An Essential Guide* read against Brain2. Parallels, five practices, five room changes. Not a work order |
| `FRIEND_COMPANION.md` | Today's-friend companion plan (picker/Details/rewards started; clock later) |
| `FUTURE_WIDGET_IDEAS.md` | Potential Home overview squares; Solar remainder, Tracking now, Night well, Harvest leftover, and Inbox mill shipped; Jung / Korzybski sketches are plans only |
| `UI_NEXT.md` | Ranked UI executable list (subordinate to the plan) |
| `UI_CRITIQUE.md` | Unranked per-tab observations — do not execute top to bottom |
| `AGENT_COORDINATION.md` | Live lock table; new work uses lanes in `PLAN_OF_ACTION.md` |
| `CANONICAL_FIELDS.md` | Canonical `Item`/data-model field reference (cleanup is step 1, not last) |
| `COUNTS_AS.md` | Tracking pen nesting — what "counts as" means; parallel chains (planned) |
| `PEN_ACTION_FORMATS.md` | Pen default action formats → Done-today rows |
| `BRAIN2_FEATURE_IDEAS.md` | 280 idea-bank buildouts (160 from `Brain2Ideas` + 120 Expansion II), mapped to the data model; Sep 2026 shipped/partial/not-shipped audit on the realistic slice; Wave 11 in `PLAN_OF_ACTION.md` |
| `tree.txt`        | Plain `tree` command output           |
| `tree.md`         | This file — annotated clickable index |
| `screenshots/`    | PNG + `.txt` write-ups per view (see [`screenshots/README.md`](screenshots/README.md)) |

Re-capture screenshots: `npm run capture-screenshots` (with `npm run dev` running).

→ [`docs/README.md`](README.md)

---

## public/

| Path                     | Purpose                            |
| ------------------------ | ---------------------------------- |
| `fonts/w95fa.woff`       | Pixel Win95 UI font (`app/win95.css`) |
| `orbs-removebackground/` | 1000+ orb PNGs (manifest in `lib/orbs-manifest.ts`) |
| `friend-pack/`            | 71 preapproved today's-friend PNGs from `animalsrcs/` (`lib/friend-pack-manifest.ts`) |
| `gems-removebackground/` | 114 tight-cropped gem PNGs (every file; manifest in `lib/gems-manifest.ts`) |
| `newvelv.jpg`            | Lists icon-view velvet desktop background |
| `pcb/`                   | Photoreal app-desktop PCB plates (`ceramic` / `mint` / `ice` / `xray` / `fr4`) |
| `pen-tray/`              | Tracking pen-well photographs (`cat` default, `pewter`, `jewel`, `bloom`, `fr4`, `xray`) |

---

## scripts/

| File                      | Purpose                       |
| ------------------------- | ----------------------------- |
| `update-tree.sh`          | Regenerate [`tree.txt`](tree.txt) (`npm run tree`) |
| `process-gems.py`          | Knock out gem photos + rescan catalog |
| `process-friend-pack.py`   | Studio-knock `animalsrcs/` into `public/friend-pack/` + manifest |
| `crop-gems.py`             | Tight-crop every gem to its alpha box (~3% pad) |
| `capture-screenshots.mjs` | Automated docs screenshots    |
| `cogs-dev-server.mjs`     | Next + `/api/sync` + `/api/persist` + `/api/ingest` + `/api/notes` + `/api/screentime` on one port; Electron strict-port reclaim of leftover Node |
| `dev-port.mjs`            | `lsof` parse + Node-only PIDs safe to SIGTERM when 3000 is stuck after OOM |
| `persist-api.mjs`         | Chrome/Electron shared persist hub: every record-bearing vault is shrink-guarded, append-only logs only grow, and a write that loses rows journals the old copy into `data/recovery-backups/` |
| `ingest-api.mjs`          | Dev hub for Telegram pending messages / replies |
| `phone-hub.mjs` / `phone-hub.ts` | Always-on Telegram executor (`npm run phone:hub`), including photo/PDF download |
| `telegram-file.mjs`       | Shared Telegram photo/PDF download for hub + `npm run ingest` |
| `phone-hub-polyfill.mjs`  | Node localStorage/window so Zustand persist hydrates in the hub |
| `notes-api.mjs`           | Loopback Apple Notes hub (`Notes.app` via `electron/apple-notes.js`) |
| `screentime-api.mjs`      | Loopback ActivityWatch hub (`electron/activitywatch.js`; phones refused) |
| `telegram-ingest.mjs`     | Optional queue-only Telegram poller (`npm run ingest`) |
| `dump-chrome-localstorage.mjs` | Snapshot Chrome localhost localStorage into the hub |
| `build-iphone-notes-shortcut.mjs` | Write + sign `Dump iPhone Notes to Brain2.shortcut` (`npm run shortcut:iphone-notes`; Find Notes 1001 + Pick a note; no `properties.notes` / Adjust Date) |
| `build-iphone-phone-shortcuts.mjs` | Write + sign Screen Time / Call / Text / Location `.shortcut` files (`npm run shortcut:iphone-phone`) |

---

## Tests

| Path | Purpose |
| ---- | ------- |
| `e2e/lists.spec.ts` | Playwright critical Lists flows (`npm run test:e2e`) |
| `e2e/item-types-detail.spec.ts` | Item types own detail: Book editor, furniture (no Schedule), pages-read → Done |
| `tests/test-utils.tsx` | Shared Vitest render helpers |
| `vitest.config.ts` / `vitest.setup.ts` | Unit/integration test config |
| `playwright.config.ts` | E2E config (starts dev server) |

Co-located `*.test.ts(x)` files live next to most components and helpers.

---

## Config & lockfiles

`components.json` · `next.config.mjs` (dev: filesystem webpack cache; watch ignores `data/`, `.cursor/`, `out/`, `dist/` so hub writes and editor junk cannot Fast Refresh the skin) · `package.json` · `tailwind.config.ts` ·
`tsconfig.json` · `postcss.config.mjs` · `vitest.config.ts` · `playwright.config.ts` ·
`next-env.d.ts` · `package-lock.json`

---

## App map

```
app/page.tsx                         ← full app shell
app/popout/page.tsx                  ← Pop out: only the module (`?module=`) or sheet (`?sheet=`)
├── Header: Review (+ Morning Review) | Metrics | Tracking | Inbox | Bulk Add | From Notes | Phone Notes | Quick Add
│            (Quick Add is controlled by the global capture hotkey — useQuickCaptureHotkey.
│             From Notes is this Mac → Notes.app (Electron IPC or localhost `/api/notes`); parks onto Lists **notes to ingest**.
│             Phone Notes is the Telegram Shortcut dump queue onto Lists **iPhone Notes Store** / **Parked**.)
└── Tabs
    ├── Home ────── Habits | Plan | To Do | Goals (Objectives + Goals + Direction) | Tracking
    ├── Lists ───── Win98 file manager (folders, lists, items, orbs, spreadsheet)
    ├── Docs ────── WYSIWYG notes over `note` items (fonts, images, PDF ingest)
    ├── Scheduler ─ Always → Year → Month → Week → Day
    ├── Operations ─ graphic project tool (work, ideas, data, progress); archived hidden; Parts + To do (milled command center)
    ├── Modules ─── composable widgets + workspace mini-apps (Itinerary doc / map / print)
    └── Analytics ─ heart: vault → presentation, analysis, new tools
```

Item detail ("⋯" menu) → **Upgrade to Operation**. `note`-type items + lists
whose `detailPanels` include `"body"` show the rich-text **Body** panel.
Completing any task (anywhere) opens the global **completion popup**
(`components/Completion/`) to capture objective/goal contributions + multipliers
(Undo reopens the item; Skip keeps the win; Save records the contribution).

Lists task select → `components/ItemDetail/ItemDetailPage.tsx` (full screen).

---

## Spec gaps (highest impact)

| Area       | Status          | Next step                                      |
| ---------- | --------------- | ---------------------------------------------- |
| Storage    | 🟡 localStorage | MongoDB + schema migrations + JSON export (§3) |
| Item model | 🟡 split types  | De-dup fields into unified `Item` (§5)         |
| Goals      | ✅ Objectives   | All-time Objectives (prioritized + multipliers) + Goals that serve them; auto-progress / penalties remain (§10) |
| Analytics  | ✅ studio views | Title+status Lists; observatory interior; spec §15 category + cognitive-state rooms |
| Carry-over | 🟡 via Reviews  | Automatic period carry-over (§7.7)             |
| Regret     | ✅ ledger       | `lib/regret-store.ts` + `Analytics/RegretView.tsx`; auto-accrual tuning (§14) |

Full detail → [`SPEC_MAPPING.md`](SPEC_MAPPING.md)

---

## Regenerate plain tree

```bash
npm run tree          # or: bash scripts/update-tree.sh
```

This runs [`scripts/update-tree.sh`](../scripts/update-tree.sh), which excludes
deps/build output and collapses the huge `public/orbs-removebackground` asset
folder into a single line, so regeneration is cheap and the output stays small.
Run it after any large structural change, then update this annotated `tree.md` by
hand if needed.
</contents>
