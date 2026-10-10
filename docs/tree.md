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
| [cosmeticsandperfume/](#cosmeticsandperfume) | | |
| [Spec gaps](#spec-gaps-highest-impact) |           |                            |

**Components sub-views:** [top-level](#top-level-files) · [Home](#home) · [Docs](#docs-top-level-tab) · [Lists](#lists) · [Scheduler](#scheduler) · [Modules](#modules) · [Analytics](#analytics) · [Reviews](#reviews) · [Settings / Item Types](#settings--focus) · [UiNames](#names-overlay) · [spreadsheet](#spreadsheet) · [ui/](#ui)

---

## README.md

**What:** **BRAIN2** (prose: Brain2) — a **living perfect second brain**. Item
captured once, then connected and used in as many rooms as possible.
**Analytics is the heart** (collection, presentation, analysis, next tools).
Inbox, Lists, Scheduler, Goals, Habits, Tracking, Modules, Reviews.

**Stack:** Next.js 15 static export, React 19, TypeScript, Tailwind + shadcn/ui,
recharts, Zustand + `persist` → localStorage, Electron, Win95/Win98 skin.
The sync that exists is the manual phone hub. Atlas is speculation.

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
| `layout.tsx`  | Root layout — Karla font, `globals.css` + `win95.css` + module chrome CSS (incl. Modules `modules-chrome.css`) + `baby-animal-nest.css` + `machine-loading.css` + `shell-chrome.css` + `search-chrome.css` + `ui-names.css` + `chrome-patina.css` + `pcb-backdrop.css`, `ChromePatina`, `PcbBackdrop`, `body.win95-app`, metadata, global `CompletionPopupHost` + `UiNamesHost` |
| `page.tsx`    | Pinned mill title bar (`AppHeader` with Nav Back/Forward, stays on item detail) + 7 lazy tabs; `initWorkflowEngine` on mount (workflows + implied actions); `EnhancedTaskDetail` fills the desk below the pin bar |
| `page.test.tsx` | Pin bar stays mounted with item detail |
| `globals.css` | Tailwind base/components/utilities + theme CSS variables                       |
| `win95.css`   | Global Win95 bevels, tabs, scrollbars, pixel font (`body.win95-app` specificity so Tailwind HMR cannot unskin). `--chrome-face` is the one gunmetal; `--w95-*` alias it; `--w95-desktop` aliases `--pcb-desk`. **Navy `#000080` text-field focus** (never WebKit orange). Tracking `.trk95` / `.trk-desktop` restore gray muted text on the white field. |
| `chrome-patina.css` | Remaps module chrome aliases onto `--chrome-*` (`body.win95-app` specificity) |
| `chrome-patina.tsx` | Writes committed warmth and Bouba/Kiki radius tokens on `:root`. A timed shift holds the previous chrome until the interval ends. Short cycles and that shift tick faster |
| `pcb-backdrop.css` | Photoreal PCB desktop plates + veil/grain; Settings chip grid |
| `pcb-backdrop.tsx` | Stamps `data-pcb-mode` / `data-pcb-ink` from `theme-store.pcbMode` |
| `loading.tsx` | Route loading boundary (renders `null`; panel Suspense uses `machine-loading.tsx`) |

**Pinned mill title bar:** BRAIN2 caption + friend jewel · Review · Settings gear · Names question mark · Search · Now · Inbox · Quick Add (Bulk and Plain inside; Plain default off; Cmd/Ctrl-Shift-A) (+ Cmd/Ctrl-K search). Metrics is the wellbeing key on Current moment inside Now. Ingest, From Notes, and Phone Notes are in Settings and Lists settings.

→ [`app/README.md`](../app/README.md)

---

## components/

All React UI. Top-level files = cross-cutting widgets; subfolders = tab modules.
Most components have a co-located `*.test.tsx`.

### Top-level files

| File                       | Purpose                                       |
| -------------------------- | --------------------------------------------- |
| `AppHeader.tsx`            | Pinned mill title bar (BRAIN2 caption + **Nav** Back/Forward as the left anchor; Friend, Rituals, System, and Capture centered as one group; System gear, question mark, search, reminders bell; Capture holds content-wide Now / Inbox / Quick Add and mounts optional **now**) |
| `header-nav-buttons.tsx`   | Leading Nav well — in-app screen history Back / Forward mill keys |
| `header-now-box.tsx`       | Optional **now** well inside Capture — live Working session clocks (Stop / Pause↔Resume); absent when idle |
| `header-reminder-bell.tsx` | System reminders bell. Orange count of undismissed persistent due reminders; dialog has name, when, source, Details, Dismiss |
| `append-log.tsx`           | Shared append-log composer (Submit + List/Bulk/Latest) |
| `shell-chrome.css`         | Full-width sticky mill fascia for `.b2-shell` (Friend / Review / System / Capture; optional now lives in Capture; reminder bell count banner) |
| `period-nav-chrome.css`    | Shared period-nav fascia / nameplate / metal keys (`--period-*`); imported by Plan / Tracking / To Do chrome |
| `quick-add.tsx`            | Quick Add: one line with live chips, or Bulk. Colon paths create the list. `folder: all: item` files on that folder's All Items. A leading `log:` is the tracking log (dark blue LOG mark, never Inbox). Date, time, duration, and priority stay in the title. **Plain** (default off) or `-p` / `-plain` stores the line as written. A successful write shows a brief fixed flag naming Inbox, the list, folder All Items, Monkey brain, or the tracking log (Bulk counts). Click, ×, or a few seconds dismisses it. Cmd/Ctrl-Shift-A prefills a selection |
| `enhanced-bulk-add.tsx`    | Multi-line write (`writeBulkCapture`); Quick Add Bulk, Inbox bulk edit, mobile. `list:` / `folder: list:` / `folder: all:` headers; schedule words stay in the item title; `plain` stores every line as written; optional Inbox |
| `capture-shorthand.tsx`    | Shared Inbox checkbox + shorthand help (colon paths, `folder: all: item`, schedule words that stay in the title, `-p` / `-plain`) |
| `notes-ingest.tsx`         | From Notes — date range, parse/skip, bulk-add (`Folder: List:` creates a folder) or park full text on **notes to ingest** |
| `iphone-notes-store.tsx`   | Phone Notes — queue of Telegram Shortcut dumps and unmatched texts on **iPhone Notes Store** / **Parked**. The signed shortcut is generated by `npm run shortcut:iphone-notes` ([recipe](shortcuts/dump-iphone-notes-to-brain2.md)); it is not in the repo. |
| `capture-doors.tsx`        | **Notes and ingest** buttons plus `CaptureDoorHost` (one mounted popup). Bus: `capture-door-bus.ts` |
| `ingest-log-dialog.tsx`    | **Ingest** log (Settings and Lists settings). GPS tracking points hidden unless **Show GPS** |
| `inbox.tsx`                | Inbox walk (selected only, newest first) + rename/discard + recent lists + points + select/deselect all + delete + pinned title search + hover clarify/delete |
| `cognitive-state.tsx`      | Header **Now** word key. Popup body is `header-tracking/` |
| `baby-animal-nest.tsx`     | **Today's friend** in the header brand well (photo, chat button, Gallery; details on the photograph) |
| `machine-loading.tsx`      | Wait instrument: Tek well, green or blue POWER lamp, phosphor sine, readout says loading with three blinking bars; the screen pet sometimes walks the floor (`pip` for status rows) |
| `machine-loading.css`      | Scope, sine, pet pace, and reduced-motion styles for the wait instrument |
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
Task chrome is not the default for generic list items. Shared Scheduling pieces:
`ItemScheduleFlags.tsx` (Send to Scheduler / Auto-push), `ItemEstimateField.tsx`
(Details-tab estimate), `ReminderScheduleFields.tsx` (Reminders list When / Repeat / Text me / Persistent; the page and popup write that patch through immediately),
People I Know biography (`components/People/person-detail.tsx` — `Task.personProfile` above the pipelines; birthday and standing notes edited once there; the plaque draws a pixel cake, and a later PNG folder is not loaded), then **Pipelines** (`components/People/person-pipelines.tsx` — Company
time follows a joined pen; a stored timeblock row is kept and is not how membership is chosen),
and `TodoCommitmentFields.tsx` (Required / Prioritized
per assigned To Do period).

→ [`components/README.md`](../components/README.md)

---

### Home

Default tab — date + hidable overview squares (points, progress, review, optional affirmation/weather) + **Habits · Plan · To Do · Goals · Tracking**. The strip is shared by every sub-tab.

| Area                        | Key files                                                                                      | Store(s)                       |
| --------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------ |
| Root                        | `home-dashboard.tsx`, `home-overview.tsx`, `home-widgets-menu.tsx`, `home-widget-catalog.tsx`, `home-widget-dialog.tsx`, `home-award-tile.tsx`, `home-screen-pet.tsx`, `home-next-tile.tsx`, `home-day-lamp.tsx`, `home-days-until.tsx`, `home-moon-tile.tsx`, `home-moon-sprite.tsx`, `home-moon-phase.tsx`, `home-moon-orrery.tsx`, `naked-eye-stars.ts`, `star-identify.tsx`, `sky-galaxy.tsx`, `home-sky-scale.tsx`, `home-sky-motion.tsx`, `MOON_SKY_MOTION.md`, `home-solar-tile.tsx`, `home-tracking-tile.tsx`, `home-glance-tiles.tsx`, `home-reading-tiles.tsx`, `home-day-stats.ts`, `weather-instrument.tsx`, `points-stats.tsx`, `daily-progress-quickview.tsx`, `home-review-banner.tsx` | points, task, reviews, events, sleep, `home-widgets-store`, `home-weather-store`, `home-days-until-store`, `sky-motion-store`, `sun-times-store`, time-tracking |
| [Goals/](#homegoals)        | `goals-tracker.tsx`                                                                            | `goals-store`                  |
| [Habits/](#homehabits)      | `habit-tracker.tsx`, `task-grid.tsx`, `habit-completion-cell.tsx`, `habits-tab-controls.tsx`, `hab-grade-sheet.tsx`, `habit-row-name.tsx`, `habit-heatmap.tsx`, `habit-priority-bar.tsx`, `habit-sort-control.tsx`, `habit-month-window-control.tsx`, `habit-week-window-control.tsx`, `habit-led-lamp.tsx`, `percent-led.tsx`, `percent-led-bar.tsx`, `habit-percent-readout.tsx`, `habit-grid.css`, `habit-chrome.css`, `habit-gems.tsx`, `gem-picker.tsx`, `habits-control-panel.tsx`, `exemption-wand-button.tsx`, `missed-op-wand-button.tsx`, `habit-wand-banner.tsx`, `habit-wand-banner.css`, `willpower-gems.tsx`, `noble-gas-tube.tsx`, `grade-breakdown-dialog.tsx`, `output-grade-breakdown-dialog.tsx`, `good-days-dialog.tsx`, `priority-math.tsx`, `period-habit-list.tsx`, `week-navigation.tsx`, `daily-task-form*.tsx`, `habit-list-popup.tsx`, `habit-sources-field.tsx`, `habit-source-detail.tsx`, `habit-period-breakdown.tsx`, `habit-span-breakdown.tsx`, `habit-completion-detail.tsx`, `habit-value-field.tsx`, `habit-form-dialog.css`, `settings-dialog.tsx` | `habits-store`, `time-tracking-store` (auto-fill tags) |
| [Plan/](#homeplan)          | `plan-panel.tsx`, `plan-period-nav.tsx`, `plan-chrome.css`, `plan-theme.ts`, `plan-gem-mode.ts`, `plan-gem-mode-toggle.tsx`, `plan-gem-day.ts`, `plan-gem-day-body.tsx`, `plan-chip.tsx`, `plan-capacity.ts`, `plan-text-log.tsx`, `plan-tracked-ghosts.ts`, `season-view.tsx`, `month/week/day-view.tsx`, `agenda-grid.tsx`, `planned-tasks-sidebar.tsx`, `use-plan-rail-drag.ts`, `planned-action-dialog.tsx`, `event-dialog.tsx`, `paste-events-dialog.tsx`, `settings-dialog.tsx` | task, event, planned-action, plan-text, sleep-sync, time-tracking, unsaved-changes |
| [ToDo/](#hometodo)          | `todo-panel.tsx`, `todo-filters.tsx`, `todo-prefs.ts`, `todo-chrome.css`, `TodoLoadPanel.tsx`, `TodoTable.tsx`, `TodoBreakdown.tsx`, `AddTodoDialog.tsx`, `DoneTodoSection.tsx`, `MissedTodoSection.tsx`, `UndoneTodoSection.tsx`, `AddDoneDialog.tsx`, `CompletionTimeLine.tsx`, `todo-utils.ts` | `task-store`, `todo-prefs` (`cogs-todo-prefs`), `lib/todo-commitment.ts`, `lib/todo-steps.ts` |
| [Tracking/](#hometracking)  | `tracking-desk.tsx`, `time-grid.tsx`, `cell-size-keys.tsx`, `fill-range-control.tsx`, `empty-blocks.ts`, `week-grid.tsx`, `infinite-strip.tsx`, `infinite-window.ts`, `pen-palette.tsx`, `pen-mode-bar.tsx`, `tracking-tool-mode.ts`, `tracking-tools-tray.tsx`, `tool-detail.tsx`, `pen-swatches.tsx`, `trk-instrument.tsx`, `trk-time-markers.tsx`, `other-scope-hint.tsx`, `screentime-empty-hint.tsx`, `tracking-chrome.css`, `depth-control.tsx`, `tracking-find.tsx`, `tracking-activity-log.tsx`, `tracking-log-view.tsx`, `count-statuses-section.tsx`, `tracking-log-model.ts`, `discrete-log-instants.ts`, `cycle-log-section.tsx`, `cycle-detail-dialog.tsx`, `cycle-reading-find.tsx`, `cycle-encyclopedia.tsx`, `cycle-encyclopedia.css`, `cycle-figures/five-phases.png`, `log-activity-dialog.tsx`, `now-time-button.tsx`, `actual-day-view.tsx`, `tracked-agenda-blocks.ts`, `daylog-week.tsx`, `daylog-week.css`, `confirm-planned-dialog.tsx`, `tracking-view-settings-dialog.tsx`, `tracking-day-notes.tsx`, `tracking-undo.ts`, `pen-settings-dialog.tsx`, `pen-settings-host.tsx`, `open-pen-settings.ts`, `pen-parent-picker.tsx`, `pen-chain-visual.tsx`, `pen-action-format-editor.tsx`, `entry-dialog.tsx`, `mood-stretch-card.tsx`, `block-pen-section.tsx`, `secondary-pens-field.tsx`, `tracking-tags-panel.tsx`, `tracking-tags-well.css` | time-tracking, task, event, `cycle-marks` |

Shared **selected day** via `lib/use-current-date.ts` — overview, Plan, the To Do day lens, and Tracking (a chosen other day persists across refresh / tab switches; a cursor left on today catches up after missed midnights, including on the next launch). To Do week, month, and season nameplates stay local. The date plate is the wall clock.

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
Shared `habits-store` persist **v26** with Lists Daily Habits. `migrateHabitsState` keeps tasks across version bumps. 15 default daily habits (chess match + puzzle as Daily +; meditate Weekly +; Book implied actions target **Read at least 10 pages per day**, `task-9`).
Add/edit uses a Win95 window (`habit-form-dialog.css`) with **Gem**, **Priority** pin/mute, Climb cadence tiles, **Delete habit** on edit, and a readable **Add Habit** button. **New habit** lives in the Habits Tab Control Panel on every tab. Daily **Heatmap View** rocker on the control bar (`habitViewMode`) is a jewelry mosaic in the light sheet; **SORT:** is a milled select on that same bar (`lib/habit-sort.ts`, `lib/habit-order.ts`). Weekly columns and the span grade share `lib/habit-week-window.ts` (7 weeks, this month, this season, 4 weeks, or this moon); the **Weeks** plate is weekly only. Monthly columns and the span grade share `lib/habit-month-window.ts` (year so far, 12 months, or since birthday — default 5 May); the **Months** plate is monthly only. Grade / Good-day dialogs can apply a 50% floor for prioritized habits.
Daily grid is compact (`habit-grid.css`: far-left inset gem/edit, wrapping title with streak/`×N` under it, recessed panel-lamp Yes/No cells — **Small LEDs** 15px or fill-cell, thin glass percent tube or numeric LED totals, optional **Day View** today+% list, name column capped so day columns grow, current day a **solid** mint fill). Home → Habits Daily wraps in `.hab95` (`habit-chrome.css`): milled fascia console (CRT **Habits** title, Daily/Weekly/Monthly bay with power lamps, period nameplate, metal Settings / New habit), phosphor points, **noble-gas glass tubes** for Week / Span grade and Perfect output (`noble-gas-tube.tsx`; plasma clipped to percent; plasma hue from `gradeTubeColor` / `outputGradeTubeColor`; **Willpower gems** stay a crystal pinned at the control panel foot with collected habit gems), Control-bar horizontal rockers (Highlight priorities, streaks, **SORT:**, then Heatmap View / Day View / Hide Done / **Mask done and missed**) and rail cockpit rockers (Loading Bar / **Small LEDs**), milled Habits Tab Control Panel (Physics enlarges Willpower gems). Clickable **Week grade** and **Perfect output** each open a scrollable raw/curved breakdown with their own **tolerance** and tube color. **Good day streak** and **Good days in the last month** sit side by side in that control panel. The Good days detail shows the prior 7-day and prior 30-day raw completion averages against today. Double-click a bottom period percent (`habit-period-breakdown.tsx`) for the habit titles in that column. Layout: [`components/Home/Habits/README.md`](../components/Home/Habits/README.md#period-breakdown).
Streaks live on Analytics → Streaks (`lib/streaks.ts` + derived climb targets), not on the Habits grid.
Daily Goal / Yes-No habits can **auto-fill from Tracking**: link TimeGrid tags in Add/Edit Habit and tagged minutes land on that day (`lib/habit-tracking.ts`; `manualValue` / `trackedValue` stay separate so the sync is idempotent). A **New tag** on the habit is a real Tracking tag. Auto-filled cells show a clock glyph and a blue border. Text cells keep the draft local until the note pauses; a filled cell opens a larger editor. **Completion sources** are a pipeline of the sources that are on (`lib/habit-completion-pipeline.ts`, trust in `lib/habit-completion-trust.ts`). BIM Keywords keeps the stored id `keywords`. The whole message must be the phrase. The source row uses that count as true if one arrives, true after a set number, or a logged phrase such as `read {n} pages of {bookname}` or `cleaned for {x} minutes`, which writes the parsed amount. A minutes or hours phrase also paints the prior tracking span (`lib/habit-logged-span.ts`). A hit with no timestamp is not copied onto every period. **Tagged tasks** counts Done tasks with a tag (two cooking tasks meet a goal of 2; a tracked block files one Done line). The minute tag source is unchanged (`lib/habit-tagged-count.ts`). **Daily completion average** (`dailyCompletionAverage`) fills a weekly, monthly, or season habit with the raw mean of daily-habit row percents (`lib/habit-daily-completion-average.ts`). **List sent** fills a period from a list’s sent ratio, then grace (`lib/list-sent.ts`). The weekly habit respond to all missing texts reads texts I need to send. List settings shows that habit and the role, derived from the saved source (`lib/list-habit-routes.ts`). **Open item in Lists** uses the standing habit item (`lib/habit-list-item.ts`).
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
Tracking Day Log. Day view outlines past painted blocks (`plan-tracked-ghosts.ts`);
week, month, and season do not.
**Could add:** Auto carry-over (§7.7). A Mongo `plans` collection is speculation, not the storage plan.

#### Home/ToDo/
Day/week/month execution lists — tier sort (A+…D), overdue, push forward.
Orchestrator (`todo-panel.tsx`) + **Show / Sort / Pace** (`todo-filters.tsx`,
Available now + WIP cap in `todo-prefs.ts`) + pure `todo-utils.ts` +
`TodoTable`/`AddTodoDialog`/`TodoLoadPanel`. Open rows are assigned;
**Required** is a separate list and **Prioritized** is tagged on Assigned
(`lib/todo-commitment.ts`). The load strip shows days left, estimated time,
hours left, working hours left, and comfort. Assigned has search. Rows break
into nested steps (`TodoBreakdown.tsx`, `lib/todo-steps.ts`); the minutes that
count are the greater of the typed estimate and the sum of the steps. The row
trash icon deletes the task. The title jewel is also the desktop plate under
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
**Undone** (`UndoneTodoSection.tsx`) is the past-period list of tasks that were
scheduled on To Do (`scheduledDate` / `scheduledWeek` / `scheduledMonth`) and
not finished that period. Periods are independent: miss Monday, push to
Tuesday, miss Tuesday, and both days stay Undone. Assimilate rolls a still-live
past period onto the coarser list; Push schedules the next open period of that
grain; both leave the period on Undone. Discard cancels and sets that
placement `resolved: "discarded"`. Item detail **Auto-push** (off unless turned
on) does the same push when the period ends, onto the next To Do period, not
into the Scheduler. The earliest Undone start feeds the priority date
(`priorityDateOf`), so a later push does not reset `waiting Nd`.
**Could add:** duration rollups per day, est.-only filter.

#### Home/Tracking/

The time grid lives here (`components/Home/Tracking/`). The metric logger is `components/Tracking/MetricLogger.tsx` (no folder README). The header **Now** word key opens `components/header-tracking/` (its own README), including `current-moment.tsx`, `update-state.tsx`, and `now-log-lists.tsx`. Current moment (Working on, Events, Thought process, Update state) sits above the Tracking / Plan switch. That popup reuses `TimeGrid`. It does not replace this desk.
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
`confirm-planned-dialog.tsx`) + Tracking log (`tracking-log-view.tsx` + `count-statuses-section.tsx` + `tracking-log-model.ts` + `cycle-log-section.tsx`: Event, Switch, Intake, Spent (amount, what, and source), Note, Thought process, and Counts under the composer (joints, days happy); shared `components/ui/clock-picker/` stays visible; Estimated and Unknown are mutually exclusive checkboxes; the cycle well is hidden until Enable cycle tracking is on, then bleeding, spotting, and ovulation marks, phase from `phaseForDate`, three sectioned lenses in `cycle-detail-dialog.tsx` (Clinical and Chinese medicine also mount `cycle-encyclopedia.tsx`, a sourced reference that does not change with the day; herbs are traditional roles with no doses; Esoteric stays four short sections), estimated days hatched beside marked ones) + day-notes **append log**.
**Cmd/Ctrl-Z** (`tracking-undo.ts`) pops `lib/action-history.ts` while this tab or the header Now dialog is open (a stroke focuses the plot; text fields keep native undo). **Superimpose** (`.trk-super-bar`, under the view-mode bar) remembers a faint second view per active scope on the day, week, and infinite grids; paint still writes the active view. Activity Log, Day Log, and Tracking log do not show the row.
Win95 Tracking window (`tracking-chrome.css`); the palette is a panel inside that
frame (Show as / Sort / Expand↔Conceal / New pen on the palette rail, then a two-column `.trk-pen-tools-row`: `.trk-pen-tray`
with selected swatch + search + one-line beads (Expand unwraps; caption Conceal while open) on plain steel **while Draw is
selected** (spacer when it is not, so `.trk-tools-rail` stays far right), steel plates for selected/detail copy,
`.trk-tool-detail` jewel + how-to under the paint throws, and `.trk-tools-tray` with milled **Draw** / **Erase** / **Scissors** jewel radios;
**Hide** / **View** / **Tags** sit in a top **Look** well (`.trk-latches-well`) next to SHOW AS / SORT. Erase/Scissors hide the
tray), then `.trk-grid-rail` (`pen-mode-bar.tsx`: Activity / Location / Mood / Company / Screen Time / iPhone Screen Time / iPhone Calls / iPhone Texts / … plus **Log activity** on Time Grid / Day Log; Activity Log uses its own `.trk-period` latch)
immediately above `.trk-plot-bezel` (`TrkChromeStack` + `TrkPlotBezel`: TIME/DIV + Cell + Fill on one strip, growing white plot), pens as beads on the tray
(plain steel pen well; **+ New pen** under the beads when expanded),
selected pen as a large swatch + name + **Settings**, **View** settings
(`tracking-view-settings-dialog.tsx`), **Sort** Recent / A–Z / Tree
(`lib/pen-sort.ts`). An unused view (one Default pen) no longer becomes the
saved view — persist v8. `other-scope-hint.tsx` still lives for tests but is
**not mounted** on Time Grid / week / Activity Log / Day Log (no **Show Activity (Nh)** banner on those views). `pen-tray-bg.*` stays so view prefs can parse an old tray blob; the well does not paint it. Pens nest (`parentIds`, display parent `parentId`,
`lib/pen-tree.ts`, persist v14); **Show as** colors the display parent. At Exact the painted pen gets the whole block; at a collapsed depth each distinct ancestor gets a share that sums to the block. Blocks may be assumed
(`precision`). **Done this day** can place a hatched block (`estimateOf` kind `done`) and confirm it. **Find** (`tracking-find.tsx`, `lib/tracking-search.ts`) sits on the Time Grid bezel and the Activity Log. Infinite scroll zoom is Cells / Hour / 3h / Day; Hour and coarser color the root category. The week grid draws discrete-event ticks and opens the block editor. An empty Day Log week hour opens the Plan event dialog. Shared searchable palette + view-mode bar above the three Tracking sub-tabs.
A block can take a **display name** of its own ("walk to the beach" on a block
of *walking*) and carry **several pens with one primary** — the grid draws the
primary's color, and the secondaries still feed every tag, habit, operation and
goal they belong to (`assignedPenIds`, `block-pen-section.tsx`,
`secondary-pens-field.tsx`). The block editor shows those associated colors
first; **add pen color** unfolds the catalog.
**Counts as** in pen settings is a searchable picker that can create the parent
it needs (`pen-parent-picker.tsx`) plus a colored, navigable chain diagram
(`pen-chain-visual.tsx`) — see [`COUNTS_AS.md`](COUNTS_AS.md). A **detail** is
that same link seen from the parent (`lib/pen-detail-sync.ts`, persist v13):
Walk under Exercise is both a detail chip and a pen that counts as Exercise.
Double-click a pen color to open pen settings (`pen-settings-host.tsx` on the
app page). A pen can also
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
Captures objective/goal contributions (searchable lists, and **Add** creates a
real objective or a year-count goal), advances goals, and awards the stacking
objective point multipliers (1.5× default; prioritized objectives use a custom
multiplier). The optional quick reflection records a finish on any date and
time (exact or estimated), an exact, estimated, or unknown length, an exact,
estimated, or unknown start, optional 1–10 reflections, and notes, and awards
3 points plus 0.1 per word (`lib/completion-review.ts`).
Footer **Undo** reopens the task as still to-do (and drops that day's
base points and any quick-review points); **Skip** keeps the win without a contribution; **Save** records one.
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
| `views/`        | `FolderViewIcons.tsx` + test, `FolderViewList/Details/Cards.tsx`, `SearchResultsView.tsx` + select-mode test |
| `list-content/` | `ListContentPanel/Default/Checklist/Icons/Details/Spreadsheet.tsx`, `reminder-quick-add.tsx` (Reminders name, time, Text me, Persistent), `use-windowed-slice.ts` (visible rows only), `SheetFullscreen.tsx`, `AllViewCheckboxFilter.tsx`, `ListMissedButton.tsx` |
| `dialogs/`      | `New/Edit List & Folder`, `ListHabitRoutes` (derived habit titles and roles), `InstagramListsSettings` (following.json / followers_N.json / HTML import; no zip; login says the official API does not return those lists), `new-dialog-fields.tsx` (`BulkNamesField`, `ScheduleableSwitch`, `PlacementModeRadios`), `MergeConfirmDialog` + item/list wrappers, `MergeFieldGroup`, `ColumnPickerPanel`, `InFoldersEditor`, `ConnectedListsEditor`, `ChecklistViewSettings` (view-mode host), `DefaultViewSettings`, `DetailsViewSettings`, `ListRulesEditor`, `CsvImportDialog`, `OrbPickerDialog` |
| `attributes/`   | `AttributeSchemaEditor`, `AttributeSettingsDialog`, `AttributeValueField`, `AttributeValuesEditor`, `helpers.ts` |
| `toolbar/`      | `ListsToolbar.tsx`, `ToolbarSearch.tsx`, `SelectionToolbar.tsx` (select mode control strip + folder-search test), `SelectModeActionChrome.tsx`, `ItemSelectionToolbar.tsx`, `ViewModeControls.tsx` (mode deck; captions via `listDisplayCaption`) |
| `lib/`          | `icon-utils.tsx` (`entryIconSrc`), `velvet-icon-grid.ts` (pack-to-width, `listDisplayCaption`), `lists-location-choice.ts` (clear search on folder nav) |

**Top-level:** `attribute-editor.tsx` (barrel), `settings-dialog.tsx`, `lists-settings-nav.tsx`, `lists-settings.css`, `list-picker.tsx` + `list-picker.css`,
`daily-habits-list.tsx`, `open-target.ts`, `constants.ts`, `types.ts`, `filemanager98.css`,
[`FOLDER_ALL_ITEMS.md`](../components/Lists/FOLDER_ALL_ITEMS.md).

**Helpers:** `lib/lists-grid-entries.ts`, `lib/lists-navigator.ts` (Lists settings library order), `lib/string-utils.ts`, `lib/folder-all-items.ts` ([`FOLDER_ALL_ITEMS.md`](../components/Lists/FOLDER_ALL_ITEMS.md)), `lib/folder-all-query.ts` (Apply list `folder: all` / `all folder`), `lib/folder-membership.ts` (list↔folder filing; [`LIST_FOLDERS.md`](../components/Lists/LIST_FOLDERS.md)), `lib/scheduled-lists-sync.ts`, `lib/period-ledger.ts`, `lib/archive-lists.ts` (Completed / Missed Opportunities membership), `lib/reminders.ts` (built-in Reminders list: once / daily / weekly into Inbox, Telegram when Text me is on, header bell when Persistent is on; dismiss hides once for good and a cycle until the next one), `lib/people-i-know.ts` (built-in People I Know list: birthday and standing notes on the Person type, the rest of the biography on `Task.personProfile`, Company time from a joined pen), `lib/gift-ideas.ts` (Close creates one Gift ideas folder and a list per person; turning Close off keeps the list), `lib/instagram-lists.ts` (built-in People I follow on Instagram and People who follow me on Instagram: one item per username, follow-back from the settings download), `lib/instagram-export.ts` (parser for that download), `lib/home-system-lists.ts` (those singleton lists, and the other built-in ones, stay pinned on Lists Home), `lib/checklist-checkbox-vars.ts`, `lib/spreadsheet-catalog.ts` (Spreadsheet columns; [`SPREADSHEET.md`](../components/Lists/SPREADSHEET.md)), `lib/details-columns.ts` (Details table columns; [`DETAILS.md`](../components/Lists/DETAILS.md)), `lib/default-view-prefs.ts` (Default reading-row chrome; [`DEFAULT_VIEW.md`](../components/Lists/DEFAULT_VIEW.md)), `lib/list-links.ts` (connected-list membership; [`LIST_LINKS.md`](../components/Lists/LIST_LINKS.md)), `lib/module-lists.ts`, `lib/module-list-import.ts` (Tidy/Trip → nested Module Lists items; [`MODULE_LISTS.md`](../components/Lists/MODULE_LISTS.md))

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
| `PeriodCell.tsx`        | Droppable bucket — line furniture, or an Always drop card. Title opens the card |
| `schedule-card-detail.ts` / `ScheduleCardDetail.tsx` | One period, full width. A past card is that cell's Undone queue: Push to the current period, Mark done (leaves the Undone list), Dismiss, Unschedule (both stay on the Undone list). Open list → `To do 8/31-9/6` |
| `PeriodFunnelTab.tsx`   | Generic Year/Month/Week tab                               |
| `AlwaysTab.tsx`         | Always list + two columns of cards (incl. Eventually / Later) |
| `DayTab.tsx` / `DayAgenda.tsx` | Day sidebar + 24-hour drop-to-hour agenda. Agenda title opens the day |
| `SchedulerFilters.tsx`  | Collapsible Filters & Sort                                 |

**Send to Scheduler** (`scheduleable: true`) is what puts a list or item in the available inbox. New lists start off. A task list, Next Actions, and a dated trip itinerary are not sent on their own. The card title opens Schedule Card Detail across the board; a past card is Undone work you can push, dismiss, or mark done, and the placement stays.
Today / Tomorrow store the local calendar date (`lib/day-clock.ts`). An unfinished period that has ended rolls up one level, or auto-pushes onto the next To Do period of the same grain when `autoPush` is on (`lib/scheduling.ts` `rollUpScheduleFieldsCascaded`, `hooks/use-day-rollover.ts`); prior placements stay on `schedulePlacements`. Push marks them `pushed` for the card's working queue and leaves them on Home Undone. That is To Do scheduling, not membership in this funnel. Eventually / Later files the task on the Next Actions list `eventually` (`lib/eventually-list.ts`) with no period.
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
Menubar **Why missed** stores an optional preset and note on
`OperationReview.blockedReasons`. Marking the stage abandoned opens the same
dialog. The after-action report does not write that field.

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
| `enhanced-analytics.tsx` | Window: title, studio range/nav/canvas, status. Open view is a lazy chunk |
| `analytics-views.tsx` | One lazy chunk per Analytics view |
| `AnalyticsNav.tsx` | Studio index (`role="tab"`; last view per group) |
| `analytics-tabs.ts` | Views in five groups + `ANALYTICS_TAB_HELP` |
| `studio-kit.tsx` | Mosaic, pie, treemap, hour×day, density, readouts, phosphor trace, split bar, Win95 `StudioCheck`, `?` help |
| `studio-plots.tsx` / `studio-plot-stats.ts` | Horizon, ridgeline, violin, alluvial, beeswarm, slopegraph, UpSet, hour×pen, Cleveland cycle, sparkline |
| `hour-day.ts` / `observatory-findings.ts` / `signal-stats.ts` | Occupancy grid + hour×pen + weekday cycle, Pearson findings, entropy/Gini/HHI/Markov/survival |
| `Observatory.tsx` / `CrossSection.tsx` | Landing findings + linked density |
| `HabitsView.tsx` / `PointsView.tsx` / `StreaksWidget.tsx` / `VelocityView.tsx` / `SeasonsView.tsx` / `ReviewsView.tsx` / `ReflectionView.tsx` / `CompletionReviewPlates.tsx` | Behavior canvases. Reflection adds clock certainty, feelings (including satisfaction and distraction), later `reflectNotes`, and review points. Reviews keeps the ritual mosaic and lists why-it-didn't notes (push, missed task, habit, missed op, ritual) with counts by token and source |
| `operation-debrief.ts` / `OperationsAnalytics.tsx` | Time → Operations. Stage mosaic plus an after-action plate: mean execution, planning, morale; sum and mean of stored hours; summary, what worked, what failed, lessons |
| `TrackingAnalytics.tsx` / `SleepAnalytics.tsx` / `ScreenTimeView.tsx` / `CircadianView.tsx` / `PlacesView.tsx` / `MoodFieldView.tsx` / `DiversityView.tsx` / `TransitionsView.tsx` / `TextPipelineView.tsx` / `LogEventsView.tsx` / `log-event-stats.ts` | Time canvases. Log counts Tracking-log instants by day and kind, scatters exact and estimated clocks, and labels a phase strip from bleed days and ovulation marks |
| `CyclePhaseView.tsx` / `cycle-phase-stats.ts` | Time → Cycle phase. Days in the shared window by phase. A marked bleed or ovulation day stays apart from a labeled estimate. Spotting is not a phase. Not a diagnosis |
| `block-search.ts` / `BlockSearch.tsx` | Find blocks on Tracking (`lib/tracking-search.ts`). Jump outlines the filmstrip block and opens the editor. Show matches redraws this view on that set |
| `grain-strips.ts` / `GrainStrips.tsx` | One cell per day, and per week when the window spans two Mondays. Color is the pen at the current depth with the most minutes. Overlap votes once. Empty days stay white. A tie keeps the earlier pen |
| `tag-trends.ts` / `TagTrendBoard.tsx` | Tag bars by week (`tagWeekTrend`) and by month (minute-union). Hidden when the window is too short to trend |
| `PlanVsReality.tsx` / `CalibrationView.tsx` / `CycleView.tsx` / `RegretView.tsx` / `GoalsAnalytics.tsx` | Accuracy canvases |
| `SpectrumView.tsx` | Autocorr + periodogram + sleep CV |
| `research-report.ts` / `ResearchReportView.tsx` | Meta rundown. Sections only when the window has a shape. `research-report.test.ts` |
| `ItemTypesLibrary.tsx` / `ListsAreasView.tsx` / `AttributesView.tsx` / `LibraryCuts.tsx` | Library (types, lists sized by count + HHI, tags, stages, weight) |
| `analytics-range.ts` + store / `chart-frame.tsx` / `open-in-lists.ts` | Shared window, honesty frames, Lists jump |
| `analytics-chrome.css` | Milled range/index chrome + studio interior (title/status stay Lists) |

| Group | Views |
|-------|-------|
| **Behavior** | Habits · Streaks · Points · Velocity · Reflection · Reviews · Overcommit |
| **Time** | Tracking (pie + filmstrip + day/week strips + tag bars + find blocks; drill lists/edits blocks) · Sleep · Screen Time · Circadian · Places · Mood field · Diversity · Transitions · Context Switch · Text events · Text spans · Log (counts, clock scatter, phase strip) · Cycle phase · Operations |
| **Accuracy** | Plan vs Reality · Calibration · Cycle (survival of open items) · Regret · Goals |
| **Meta** | Observatory · Cross-section · Metrics · Correlation · Spectrum |
| **Library** | Item Types · Lists & areas · Attributes · Tags · Stages · Weight |

→ [`components/Analytics/README.md`](../components/Analytics/README.md)

---

### Rituals (Reviews)

Header **Rituals** control — day sun (morning) / moon (night, including yesterday);
week–month–quarter–year **Start ritual** (plan) / **Review ritual** (end). End walk:
unfinished items for that period (**Push** leaves the row via the Scheduler;
**Other** on Why blocked? keeps the typed words), **assumed times** (optional **Est.**),
a night glance at the time grid / day log / activity log in pen colors, and — for
week, month, season, and year — period stats then the shared reflection
(`PeriodReview.arc`). Then summary, gratitude, plan reflection, the short
reflection questions, wake-up reminder, what matters most tomorrow, goals to focus,
and tomorrow's plan. Close saves a draft. Submit awards points (default 10 per
completed section, including each answered longer question, + 30). On the local
new moon, the local full moon, and the birthday in Settings, the menu also offers
a **Star Lord Report** (preparation, six questions, a closing toward the north).
Badge = available/undone count (`lib/rituals.ts`), plus an open Star Lord Report.
Telegram: `gm` / `gn` / `rituals` / `ritual start week` / `review week`. Saved slices
browse in Analytics.
**Assumed times** (`AssumedTimesSection.tsx`, day/week/month only) lists the period's
completions whose time the app autogenerated — habit rates, painted Tracking minutes,
"finished just now", that night's bedtime, the day anchor — each with its basis, correctable inline or
accepted in bulk (`lib/estimated-values.ts` → `lib/services/completion-time-service.ts`).
**Est.** sets `Task.timeRough` when the duration or start is only a rough estimate.
Helpers: `lib/rituals.ts`, `lib/pending-reviews.ts`. Shared
`CommitmentMarkList.tsx` marks assigned tasks Required / Prioritized in morning
and start-ritual flows. **Post-mortems:** `PostMortemDialog.tsx` +
`lib/services/completion-service.ts` capture per-task satisfaction, resistance,
focus, distraction, and later notes. `MissReasonDialog.tsx` is the optional why
on Push, a missed task, header-plan skip, and the habit missed-opportunity wand
(reason menu above the dialog, multiline note).
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

- `Settings/SettingsDialog.tsx` (header) — one instrument: find well, section
  index, six groups (`settings-index.ts`, `settings-nav.tsx`). The body shows
  the selected bay and scrolls only inside it. **You:** baby
  animal friend, home location (Plan sunrise/sunset, default San Diego),
  birthday, default time of day (`DayAnchorField.tsx` — finish time assumed
  for work logged against a day that already ended, default 9:00 PM).
  **Appearance:** **Window gray** (design-ref swatches; a timed shift previews
  in the panel via `panel-preview.ts`, then the app commits), **Desktop**
  (`PcbBackdropField` — teal plus five photographed plates; `theme-store.pcbMode`),
  **Bouba/Kiki** (same preview law).   **Points:** `<PointAllocationField />`
  only (the bay opens `PointsRulesDialog` — the full catalog; habit bonuses stay
  in Habits → Settings and share those rows). **Data:** **Data profile** (Live vs Demo, `DataProfileField.tsx`),
  full app **backup/restore** (`BackupRestore.tsx` → `lib/data/backup.ts`),
  confirm-gated manual hub push/pull (`MobileSyncPanel`). **Imports:** Notes
  and ingest, **Message ingest** (`MessageIngestPanel` — Telegram pairing,
  grocery pin, always-on hub, shortcuts, iPhone Notes / Screen Time / Call /
  Text Shortcut AirDrop, cheat-sheet, simulate message + scan; see
  [`MESSAGE_INGEST.md`](MESSAGE_INGEST.md)), **Screen Time** (`ScreenTimePanel`
  — ActivityWatch URL, lookback, Sync now), **Import from Instagram data**
  (`InstagramImportPanel` — `following.json` and every `followers_N.json` in
  one upload; no password). **Library:** **Manage Item Types**
  (`components/ItemTypes/`) and **Set up Second Brain** (seeds Source/Belief
  via `item-type-store.seedSecondBrainTypes`).
- `ItemTypes/ItemTypeList.tsx` + `ItemTypeEditor.tsx` — create/edit/delete user
  **item types**: attribute schema, capabilities (gate detail tabs), detail
  panels/layout, implied-action rules, recipe/hint cards. System types locked;
  catalog types (Book, Furniture, …) editable.
- `Focus/JustStartMode.tsx` — ADHD anti-paralysis overlay: one smallest molecular
  step + 2-minute timer; launched from the To-Do panel.
- `Search/GlobalSearch.tsx` — Cmd/Ctrl-K command palette over `lib/search.ts`, mounted from `app/page.tsx`. `search-chrome.css` (`.b2-search`) is the milled fascia.

---

### spreadsheet

`SheetGrid.tsx` — Google-Sheets-style inline-editable grid over items. Columns
come from `lib/spreadsheet-catalog.ts` (on-this-list attributes, vault attrs,
built-in fields). Unset `columnIds` defaults to the list schema /
`displayedAttributes` only (Name-only when empty — keeps All Items calm).
Add-column lives in `AddColumnDialog.tsx` (associated attrs
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
(house dirty-close confirm) and `clock-picker/` (`clock-picker.tsx`, `clock-dials.ts`, `clock-picker.css`, `ceramic-face.png`,
`backgrounds/manifest.json`, `clock-picker.test.tsx`: shared `HH:MM` clock; typed closed field; Now inside the popup writes at once; Confirm writes the drums; Cancel, Escape, and a click outside leave the field; ceramic is the default dial, other paintings switch; ornate silver hands; the popup keeps its clicks inside a dialog).
Unused defaults removed; Analytics uses recharts directly.

→ [`components/ui/README.md`](../components/ui/README.md)

---

## lib/

Data model, Zustand stores (localStorage), pure helpers. Not React UI.
Persist keys and versions: [`lib/README.md`](../lib/README.md).

### Stores

Live keys are `brain2-*`. `cogs-*` is the historical alias. Keys and persist versions are only in [`lib/README.md`](../lib/README.md). This table is file names.

| File | What it holds |
| ---- | ------------- |
| `task-store.ts` | Item records (`tasks[]`) |
| `event-store.ts` | Calendar events |
| `planned-action-store.ts` | Day-agenda planned actions (not events) |
| `habits-store.ts` | Habits and completions |
| `goals-store.ts` | Objectives and goals |
| `points-store.ts` | Points ledger. `redatePoints` moves one task's rows when a finish changes day |
| `time-tracking-store.ts` | TimeGrid views, pens, and intervals |
| `day-notes-persist.ts` | Tracking day-notes append log |
| `pen-tree.ts` | Parent/child rollup and display-depth options for Tracking pens |
| `pen-detail-sync.ts` | Detail chips and counts-as children are one set (`PenVariant.penId`) |
| `pen-sort.ts` | Palette order: Recent / A–Z / Tree; last-used from paint |
| `pen-action-format.ts` | Turns a painted block into a Done-today title: template variables, most-specific-match selection, deterministic row id. Pure |
| `pen-action-sync.ts` | Store bridge for the above — upserts/removes the `pen-action-*` Done row as blocks are painted, retimed, relocated, or deleted; never overwrites a title the user edited |
| `work-session-store.ts` | Live Operations "working on this now" pointer |
| `pen-color-session-store.ts` | Live pen-color "working on right now" pointer |
| `reviews-store.ts` | Period reviews |
| `modules-store.ts` | Module widgets and workspace views |
| `module-definitions.ts` | Reusable module blueprints (`ModuleDefinition`) |
| `workflows-store.ts` | Authored per-module workflows |
| `item-type-store.ts` | Item type registry |
| `lists-ui-store.ts` | Lists UI prefs and the orb gallery |
| `home-widgets-store.ts` | Home overview square visibility, order, and Follow the clock |
| `home-weather-store.ts` | Home weather widget city and beach |
| `home-days-until-store.ts` | Days Until date and label |
| `sky-motion-store.ts` | Moon chart view width and time rate. Handoff `components/Home/MOON_SKY_MOTION.md` |
| `home-weather.ts` | Rain copy, advisories, human forecast, place sanitize |
| `home-widgets.ts` | Catalog, sanitize, Widget catalog blurbs, and the 3-stop Habits gradient |
| `home-glances.ts` | Night well, Harvest leftover, Inbox mill, Already flowing, and Plan and lived faces |
| `solar-remainder.ts` | Solar remainder phases for the Home sun tile |
| `tracking-presence.ts` | Current vs last-known lanes; Now popup now-stamp (`open` extends, `minute` starts a second block) and recent sequence |
| `header-tracking-plan.ts` | Header popup plan → tasks, placements, day plan log |
| `theme-store.ts` | Theme colors, chrome warmth, Bouba/Kiki corner mix, and `pcbMode`. Persist v5 |
| `user-settings-store.ts` | Home city, `dayAnchorMinutes`, and `birthday` |
| `ui-names-store.ts` | Overlay mode (`off` / `names`) |
| `ingest/ingest-store.ts` | Phone-message pairing, allowlist, shortcuts, live grocery list, hub URL, grocery pins, ingest log |

### Pure helpers

| File | Purpose |
| ---- | ------- |
| `drift-clock.ts` | Pole-to-pole clock shared by warmth and Bouba/Kiki (pause, instant, timed shift) |
| `chrome-patina.ts` | Design-ref gray swatches for `--chrome-face`. Mix 50 is the stored classic `#c0c0c0` default. Companions belong to each swatch |
| `corner-mix.ts` | Bouba/Kiki preset **default** — measured chrome corner literals, including GradSearch `11px` and `20px`. Mix 50 restores them. Circles, pills, and non-chrome art stay out |
| `appearance-rev.ts` | Wall-clock `appearanceRev` stamp for plate / hue picks, so a pick made before persist rehydration still wins the merge |
| `pcb-backdrop.ts` | Five photographed desktop PCB modes; `data-pcb-mode` / ink; first-paint boot script; `brain2-pcb-mode` pin + this page's `brain2-pcb-pick` |
| `baby-animals.ts` | Fixed cute-name list + Monday week key + occasional cut-out search flavors |
| `friend-photo-vault.ts` | Per-card picture bytes in IndexedDB (`idb:friend_<id>`). Gallery JSON holds `friend:<id>`. |
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
| `habit-points.ts` | Daily habit 50×ratio points; user accomplishment bonus (default +50 at ≥80% raw); 75% grade bonuses (100 either / 300 both); editable grade-lift bonuses vs yesterday and vs last week; average bonuses (default +5) vs the prior 7-day and prior 30-day raw averages |
| `habit-accomplishment.ts` | Good day threshold/bonus; streak; last-30; yesterday and week raw averages (independent of grade curves) |
| `habit-done-log.ts` | Mirror habit completions into To-Do Done, with a derived duration + clock window (`deriveHabitCompletion`), refreshed while the goal stays met unless confirmed |
| `operation-work-session.ts` | Live Operations "working on this now": Tracking paint, Done `worked on {name}`, timeLogs, habit tags |
| `pen-color-session.ts` | Live pen-color "working on right now": timer from this second, Tracking block of that pen |
| `focus-timer-log.ts` | Module focus timer complete → `timeLogs` on Working Now or a picked item (no Tracking paint) |
| `habit-time-estimate.ts` | How long a habit's period took: its own minutes/hours value → painted Tracking minutes → amount × `minutesPerUnit` → flat length |
| `completion-window.ts` | Where in the day a completion sat: last painted Tracking run → "just now" → that night's bedtime (stated, painted, or your usual), falling back to the day anchor; never backdated past the wake time |
| `completion-review.ts` | Quick-review finish (any date and time, exact or estimated), length and start (each exact / estimated / unknown), optional 1–10 scores, and 3 + 0.1 per word on the points ledger. The summary also means satisfaction and distraction and keeps later `reflectNotes` |
| `miss-reason-corpus.ts` | Dated why-it-didn't notes from push, missed tasks, habit cells, missed ops, and ritual reviews, with counts by preset token and by source |
| `estimated-values.ts` | `FieldEstimate` provenance for autogenerated values; sticky confirmation (`canRegenerate`) |
| `habit-week-streaks.ts` | 4+ day week streaks for daily habit chips |
| `habit-led.ts` | Percent LED tint, `cogs-habit-led-tint` pin + this page's `brain2-led-pick`, lamp off/on/partial, same rounded `%` text as the old bars |
| `habit-tube.ts` | Grade-tube plasma hues (`gradeTubeColor` / `outputGradeTubeColor`) and `dischargePaint` |
| `mood-reading.ts` | Sentence, word grouping, lighter map, rank clamp, and stable pen color for a mood stretch. The sentence is not written into notes |
| `time-entries.ts` | `TimeEntry` interval model — minute resolution, a **primary pen plus secondaries** (`assignedPenIds`), an optional block **display name** (`entryDisplayName`), variants, block-level tags, `precision` (omit = certain, `"estimated"` = assumed), optional `eventKind` (slug; intake rows use `intake` / `intake.food` / `intake.drink` / `intake.drug`; a spend is `spend`), optional `intakeClass` (`food` / `drink` / `drug`), optional `clockCertainty` (`estimated` / `unknown`; omitted = exact; estimated also sets `precision`), optional `spendAmount` (integer cents) / `spendOn` / `spendSource`, `estimateOf` (`done` stamped by Place as assumed; `import` is in the type and has no writer yet), `generatedBy` provenance, `spanId` for midnight-crossing blocks, optional `moodReading` (omitted when empty; different readings do not merge), wrap/merge/split/clip |
| `tracking-search.ts` | Find a block by display name, notes, project, pen, secondary pens, counts-as names, action-format templates, and a mood reading. Tracker and Analytics both call it |
| `estimate-proposals.ts` | Open-gap placement for a Done item's assumed block. Does not write |
| `action-history.ts` | Last-action undo/redo for Home and Tracking (Cmd/Ctrl-Z). The time grid commits on the keydown; sleep, habits, points, and tasks from the same snapshot follow while `isRestoring()` holds derived sync off. Undone blocks are tombstoned, and a later entries write that still carries that id is dropped. Tracking capture-phase chord in `tracking-undo.ts` |
| `tracked-time.ts` | Minutes per TimeGrid tag for a day; `entryTagIds` unions the standing tags of **every pen assigned to a block** (primary and secondary) with the block's own, then unions minutes across scopes so a doubly-tagged minute counts once — this is what makes a secondary pen feed habits rather than just tint a block |
| `tracking-summary.ts` | Occupancy, pen totals at a display depth (shares at a collapsed depth sum to the block), child drill, variant split/reach, tag totals, `tagWeekTrend`, withPrecision, otherScopeOccupancy — Time Grid, Activity Log, Day Log, and Analytics all read it |
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
| `habit-completion-trust.ts` | Ordered completion sources; first observation wins |
| `habit-keyword-source.ts` | Exact BIM message count for one period: true if received, true after N, or a logged phrase (`{n}` / `{x}` / `{minutes}`) |
| `habit-logged-span.ts` | Prior tracking span for a logged minutes/hours phrase; no clock is estimated |
| `habit-keyword-sync.ts` | Writes that count from ingest events and text instants already stored, and paints a duration span once |
| `habit-completion-pipeline.ts` | Pipeline rows over those source ids; optional display name; Habits stats `stats` (set, points, previous-period compare); list mode and grace |
| `list-habit-routes.ts` | Reverse of a habit’s saved list source: title and role on list settings. Not stored on the list |
| `habit-stat-points.ts` | Habits stats sets and points, including the better-than-last-week preset |
| `habit-period-compare.ts` | Strictly-higher previous-period compare. A tie is not higher |
| `habit-source-square.ts` | Read-only cell account: sources asked, numbers pulled, result |
| `habit-list-item.ts` | Standing Lists item for a habit; Back returns to habit settings |
| `habit-tracking-sync.ts` | Pushes tagged tracked time into linked daily habits |
| `habit-auto-flag.ts` | Shared manual-vs-auto merge for habit cells (`applyHabitAutoFlag`) |
| `habit-period-pace.ts` | Elapsed fraction of a habit period, and logged share of that time |
| `habit-period-breakdown.ts` | Titles behind a footer period percent; completed when that cell’s share is 100 |
| `habit-span-breakdown.ts` | Far-right span %: period names, cell amounts for a non-binary habit, Running through today, Total for the full span |
| `habit-period-windows.ts` | Unique period windows for a habit frequency + day keys |
| `habit-month-window.ts` | Monthly sheet and span grade: month starts for year so far, 12 months, or since birthday (default 5 May) |
| `habit-week-window.ts` | Weekly sheet and span grade: Monday starts for 7 weeks, this month, this season, 4 weeks, or this moon |
| `start-hydrated-store-sync.ts` | Idempotent singleton: wait for Zustand persist gates, then subscribe once |
| `seasons.ts` | Calendar quarters as seasons (`YYYY-Qn`, `Quarter YYYY Qn (Season)`) |
| `date-utils.ts` | Date keys, week strings, `isToday`, `startOfLocalToday`, `isPastLocalCalendarDay`, safe date guards (period-key identity in `period-keys.ts`) |
| `period-keys.ts` | Canonical period-key strings (`periodKeyFor`, `periodKeysFromDateKeys`) |
| `item-utils.ts` | Schedule predicates, `createListItem` (type `item`), `isTaskItem`, `countsInDone`, `resolveCompletionPoints` |
| `plan-drag.ts` | Plan rail ↔ agenda `text/plain` payload (`brain2-plan:<kind>:<id>`) |
| `plan-rail-next-actions.ts` | Lists Next Actions workable in the shown Plan period |
| `inbox-batch.ts` | Inbox order (newest first), walk queue (selected only), rename helper, multi-select targets, batch list/deadline/delete patches (#243, #244) |
| `inbox-transfer-log.ts` | Transfer selected inbox ideas to the Tracking log at each idea's `createdAt`; restore clipped duration and clock chips |
| `inbox-transfer-queue.ts` | Drop those inbox rows on the click; write the notes together on a later turn |
| `inbox-credit.ts` | +1 per handled Inbox idea; +50 when the Inbox hits 0 |
| `inbox-process-todo.ts` | To Do **process inbox information** when the revisit Inbox has more than 100 open ideas; Auto-push on |
| `reminders.ts` | Built-in Reminders list. Due rows copy into Inbox and, when Text me is on, text the paired Telegram chat. Persistent rows stay in the header bell until dismissed. Once / daily / weekly. Fires only while the app is open |
| `people-i-know.ts` | Built-in People I Know list. Biography is `Task.personProfile`. Company time follows a joined pen. A stored timeblock row is kept. Delete is refused. Pinned on Lists Home |
| `gift-ideas.ts` | Gift ideas folder and one list per Close person (`giftIdeasPersonId`). Close off does not delete. Delete of the folder or list is allowed. A duplicate drops the person id |
| `instagram-export.ts` | Parser for the person’s Instagram followers-and-following download. Follow-back stays blank until that side is in the file |
| `instagram-lists.ts` | Built-in People I follow on Instagram and People who follow me on Instagram. One username, both lists. Delete is refused. Pinned on Lists Home |
| `home-system-lists.ts` | Pins built-in singleton lists onto Lists Home via `homePinned`. They stay there. Ordinary lists are not pinned |
| `person-types.ts` | Catalog **Person** (birthday and standing notes) + `withPersonType`. Further biography is `Task.personProfile` |
| `person-profile.ts` | Person biography on `Task.personProfile`: name, nicknames, optional relation, date met, Instagram, address precision, dated notes, interactions, gift notes, Close. Known-for, last saw, and the birthday countdown are derived. Company time follows pen color |
| `inbox-recent-lists.ts` | Persist / suggest recently used lists for Inbox walk |
| `item-types.ts` | Type registry helpers, `resolveDetailView`, `mergeTypeRegistry`, rule evaluation + implied-action effects |
| `implied-actions.ts` | Log Done actions + increment habits from type/list rules |
| `item-type-recipes.ts` | Starter schemas + implied-action hints for the type editor |
| `catalog-types.ts` | Furniture / Resource / Shopping catalog seeds |
| `book-types.ts` | Catalog **Book** (cover, pages read, implied-action rules) + `withBookType` |
| `objectives.ts` | Objectives/Goals helpers — period keys, prioritization + caps, goal progress, direction-in-life coverage |
| `completion-events.ts` | Completion event bus (`onTaskCompleted`/`emitTaskCompleted`/`requestTaskCompletion`) |
| `completion-status.ts` | `done ⇔ completed`; `"missed"` is too-late (`isClearedFromWork`); leftover lifecycle words on `status` are repaired |
| `flight-types.ts` | Catalog **Flight** item type (airline, airports, times, layovers, cost, booked) + `withFlightType` |
| `file-extract.ts` | Best-effort `extractText(FileValue\|File)` — text inline, PDF via Electron `window.desktop.extractPdfText`, graceful browser fallback |
| `apple-notes.ts` | Apple Notes ingest: preview/snippet/bodies fetch (Electron IPC or localhost `/api/notes`), bulk-add parse (`Folder: List:` headers), park on **Mac Notes** / **notes to ingest** or Telegram Shortcut park on **iPhone Notes Store** / **Parked**, skip ingested ids; From Notes dialog session survives close/reopen |
| `cycle-marks.ts` | `brain2-cycle-marks`: local day → bleeding / spotting / ovulation. `readCycleMarks`, `setCycleFlag`, `toggleCycleFlag`. Empty days drop. Spotting does not change phase |
| `cycle-phase.ts` | `phaseForDate` → menstrual / follicular / ovulatory / luteal / unknown. Calendar label, not medical advice |
| `cycle-estimate.ts` | `assessCycleDay` beside `phaseForDate`. Explicit bleed and ovulation stay marked; a guess is basis `estimated` |
| `cycle-lens-clinical.ts` | Four short sections plus a sourced reference (`clinicalReference`, `clinicalSources`) that does not follow the selected day. Not a diagnosis or a prescription. Test: `cycle-lens-clinical.test.ts` |
| `cycle-lens-chinese.ts` | Four short sections plus `chineseEncyclopedia` and `tcmSources`. Herbs are traditional roles, with no doses. Test: `cycle-lens-chinese.test.ts` |
| `cycle-lens-esoteric.ts` | Four short sections for the cycle popup |
| `cycle-lens-copy.ts` | Cycle detail prose barrel: Clinical, Chinese medicine, Esoteric. Phase is not stored |
| `ingest/` | Phone-message ingest (Telegram first): parser, `dh:` / `log:` / `intake:` / `switch:` / `log categories` / `st:` / `so:` / `transit:` / `cycle:`, grocery/notes/pin, list dumps (`Name:` then lines; grocery headers use the store list; identical open items ask see / again / dismiss; `before 9/12:` is due that day), capture (`-mb` / `-monkey` → Monkey brain; `-p` / `-plain` stores the line as written; date, time, duration, and priority stay in the title), receipt OCR, journal/PDF Docs scans, `iphone-notes` park, iPhone Screen Time / Calls / Texts, plan log / to-do / morning review / `gps:` (collected on Location; a repeated place within 80 m can be named on Analytics → Places; hidden on the ingest log unless **Show GPS**; stamps use Telegram send time), list/folder/inbox read-back, `/quicklists`, Now capture (`now` with a payload; bare `now` stays status), pairing that a refresh cannot wipe, dedupe that logs a null Telegram id instead of applying, always-on hub, private slash menu (`start`, `help`, `now`, `quicklists`, `info`) and inline buttons on clarify / duplicate / receipt questions — [`ingest/README.md`](../lib/ingest/README.md) |
| `smart-parse.ts` | Smart-capture parser: colon paths, dates/times/priority/duration (those words stay in the title), `-mb` / `-monkey`, `-p` / `-plain` (store the line as written), `parsePathHeader`. List slot `all` is resolved by capture-target |
| `capture-origin.ts` | `Task.captureOrigin`, set once. Walk labels BIM, Quick Add, Bulk Add, From notes, Phone Notes, or Scheduled. No stored door stays blank. Not `createdAt` |
| `capture-target.ts` | Create/resolve folder+list from a capture path; build Inbox vs filed tasks. `folder: all: item` files on that folder's All Items. Plain capture creates neither. A list created here is not sent to the Scheduler. New captures can pass `origin` |
| `quick-add-log.ts` | Quick Add `log:` uses the Telegram tracking-log write. Not a list, not Inbox |
| `migrations.ts` | Versioned Item-model migrations (backfill `type`/`title`/`tags`/`links`; v13 repairs `status`; v14 turns folder Send-to-Scheduler defaults off; v15 turns it off on module-created lists; v16 records Undone placements for past live assignments without clearing them) |
| `habit-exemption.ts` | Exemption wand: automatic pre-creation waivers, all-nighter log blocks, explicit overrides, streak days that are skipped |
| `habit-missed-opportunity.ts` | Missed-op mark on the completion cell; eligibility; hatch only while the hide rocker or an ineligible wand target asks for it |
| `habit-connections.ts` | Sleep-clock and next-action list connections that can check a daily yes/no habit (`applyAutoFlag` wraps `habit-auto-flag.ts`) |
| `habit-connection-sync.ts` | Writes those connection checks when the sleep log or a finished next action changes (bootstrap via `start-hydrated-store-sync.ts`) |
| `habit-coverage-sync.ts` | Pushes Activity Occupancy into coverage habits and recomputes the daily-floor week habit; ignores re-entry from its own cell writes |
| `habit-value-sync.ts` | Daily habit total: sums one daily habit into a weekly, monthly, or season cell for the days so far |
| `habit-daily-completion-average.ts` | Daily completion average: raw mean of daily-habit row percents into a weekly, monthly, or season cell |
| `habit-tagged-count.ts` | Tagged tasks: counts Done tasks with a tag; a tracking block files one Done line |
| `list-sent.ts` | List sent ratio: sent / (unsent still on the list + sent this period), then grace |
| `list-sent-sync.ts` | Writes that percent onto the current period cell and clears last week’s sends off the list |
| `habit-utils.ts` | Habit type aliases; `isHabitGoalMet` with date/`weeklyData` for climb; `completionWithGoalFlag` stays checked when an auto flag is set |
| `attribute-utils.ts` | Legacy attribute normalization/coercion |
| `append-log.ts` | Shared append log (`v: 1` JSON; stamp `9/20 9pm`; List / Bulk / Latest) |
| `plan-text.ts` | Plan period keys on the append log (`dayPlan-*` / `weekPlan-*` / `monthPlan-*`) |
| `folder-all-items.ts` | Per-folder All Items sync + view prefs on the backing list. Capture keyword `all` / `all items`. Inbox Apply list ensures the backing list for a chosen pool |
| `folder-all-query.ts` | Apply-list search: `folder: all` / `all folder` → that folder’s All Items id. Ties stay ties |
| `list-links.ts` | Connected-list membership (`List.linkedTargetListIds`); exclusions; unlink without mass-delete |
| `scheduled-lists-sync.ts` | Smart lists ↔ scheduled folders + per-period To do / Done / Undone lists; creates Completed + Missed Opportunities lists |
| `period-ledger.ts` | Prospective To do, Done during the period, and Undone for a finished period. Home → To Do and the Scheduled lists share it |
| `archive-lists.ts` | Archive list membership on `Task.lists`; reuse-by-name; exclusions |
| `checklist-checkbox-vars.ts` | Checklist columns: default Completed only |
| `details-columns.ts` | Details table column ids (`List.detailsColumns`; not spreadsheet) |
| `lists-grid-entries.ts` | `buildGridEntries()` for Lists navigation |
| `string-utils.ts` | `hashString`, `hashIconSlot` for orb/icon placement and connector mock seeds |
| `spreadsheet-catalog.ts` | Attribute → column catalog (on-this-list / vault / built-ins); lean schema defaults for `columnIds`; hide is view-only; `attributeSettingsForColumn` |
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
| `persist-storage.ts` | Guarded Zustand persist adapter; Electron returns a rich local snapshot immediately and only waits on the hub for missing/seed-sized keys; identical writes are skipped; outside tests writes coalesce ~48ms and flush on hide; hub rehydrate is idle; `userData` pinned to Application Support/`cogs` |
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
| `commit-item-edit.ts` | New-code write door: `commitItemEdit` (repository validate, store update, mutation patch, one activity line) and opt-in `applyLinkedEffects` |
| `pending-reviews.ts` | Which just-ended **end** rituals are still due |
| `rituals.ts` | Ritual slots, available/undone list, Telegram board text, phase helpers |
| `lunar.ts` | Local day of the new moon and the full moon; quarters; eight phase names, illumination, neighboring major phases, and the sooner countdown for the Home Moon tile |
| `solar-system.ts` | Heliocentric ecliptic places and true radii of the eight planets for the Moon detail chart |
| `sky-motion.ts` | px/s of eight reference motions on a 1,000 px view; time-rate steps; scale and light-crossing lines |
| `sky-observe.ts` | Light-time, angular diameter, elongation, and apparent magnitude. Not the chart readout; `motionReadout` stays view width and rate |
| `sky-scale.ts` | Powers of ten from a proton to the observable universe. Moon and Earth are photographs; 10^26 m is a schematic speck. Session tour; not saved |
| `sky-zoom.ts` | √r chart magnifier (`√au × 34 × factor`). Factor 1 is today's framing. Not the motion bar's view width, and not saved |
| `sky-galaxy.ts` | Milky Way band and face-on schematic. Inclination `galaxyBandAngle`. Not a star catalog |
| `sky-bodies.ts` | Chart disks and true km/px. Sun stays larger than Jupiter. The Moon chart uses these radii; True sizes is session-only |
| `sky-moons.ts` | Mean circular moons and Name, Seen, and Science lines (`planetFacts`, Sun through Neptune and the Moon) for the Moon-chart close-up |
| `star-lord.ts` | Star Lord Report script, slots, birthday match, section points |
| `star-lord-store.ts` | Saved Star Lord Reports (`brain2-star-lord-store`) |
| `ritual-unfinished.ts` | Unfinished tasks for the ritual's period (past days use Undone; pushed rows leave) |
| `ritual-push.ts` | Ritual push via the Scheduler working queue |
| `blocked-reason.ts` | Why-blocked tokens; Other keeps the typed note |
| `period-arc.ts` | Shared week–year reflection prompts |
| `period-ritual-stats.ts` | Period stats beside those prompts |
| `ritual-points.ts` | Section points + whole-ritual bonus; each answered arc question counts; drafts award nothing |
| `ritual-carry.ts` | Night reminder, what matters most, and focus goals for the next morning |
| `goal-focus.ts` | Focus multiplier composed with objective stacking (keep the larger) |
| `affirmations.ts` | Morning affirmations ritual: find/seed Lists "affirmations", read lines, `pickRandom` session subset |
| `vocal-confidence.ts` | Pure vocal-confidence DSP + scoring (McLeod-Pitch-Method `detectPitch`, jitter/shimmer, uptalk/trailing-off, `ConfidenceTracker`) for the affirmations ritual |
| `unsaved-changes.ts` | Dirty snapshot compare for the house unsaved-changes confirm (`useUnsavedGuard`) |
| `app-brand.ts` | Product name: chrome **BRAIN2**, prose **Brain2**; persist keys are **`brain2-*`** (`cogs-*` alias) |
| `storage-keys.ts` | Canonical `brain2-*` persist keys; small Live dual-write `cogs-*`; large vaults `brain2-*` only; Demo `brain2-demo-*` |
| `data-profile.ts` | Switch Live ↔ Demo (reload); Reset Demo wipes only demo keys |
| `demo-vault.ts` | Stock fiction vault (River Hale) for the Demo profile. Richer rows: `demo-corpus/` |
| `demo-corpus/` | Invented Demo graph, pens, week plans, and empty-week filler (`cover-week.ts`) |
| `app-navigation.ts` | Persist last active tab/location + scroll offsets to localStorage (incl. Docs doc/folder/scroll); pin writes fire `cogs-nav-pin-changed` for screen history |
| `screen-history.ts` | Pure back/forward stack for in-app screens |
| `screen-location.ts` | Snapshot / restore of the main desk screen; fires `cogs-nav-restore` |
| `screen-history-controller.ts` | Session singleton that records pin changes and applies Back/Forward |
| `use-screen-history.ts` | React binding for the header Nav keys |
| `use-persisted-tab.ts` | `live` reads the stored tab on first render; `hydrate` (app shell) keeps the SSR fallback until a layout effect so Radix stays in sync. Re-reads on `cogs-nav-restore` |
| `nav-boot.ts` | Head script stamps `data-boot-tab` from the saved app tab before first paint |
| `task-index.ts` | In-memory id / list / tag / backlink indexes for the item vault |
| `use-persisted-scroll.ts` | Restore a scroller's `scrollTop` after remount / refresh (`ui-scroll` slots) |
| `use-current-date.ts` | Shared Home calendar cursor. A chosen other day persists; a cursor left on today catches up after missed midnights (launch, visible window, local midnight). `useLiveToday` is the wall clock |
| `csv.ts` | Lists CSV import parser |
| `remove-background.ts` | Orb studio knockout + photograph subject cutout |
| `orbs-manifest.ts` | Auto-generated orb PNG list |
| `folders-manifest.ts` | Photographed folder PNGs in `public/folders-removebackground/` |
| `gems-manifest.ts` | Every PNG in `public/gems-removebackground/` |
| `habit-gems.ts` | Habit furniture slots + random persisted row jewels |
| `use-persist-hydrated.ts` | Wait for Zustand persist hydration |
| `utils.ts` | `cn()` — clsx + tailwind-merge |

**Could add:** field de-dup in `types.ts` (§5). JSON export/import already ships (`lib/data/backup.ts`). Atlas is speculation, not the storage plan.

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

**Could add:** nothing in this folder is the storage plan. Atlas / IPC Mongo wiring is speculation.

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
| `use-day-rollover.ts` | Roll unfinished past period schedules up one level; bump `lib/day-clock.ts`. Mounted from `app/page.tsx` |
| `use-reminder-tick.ts` | Deliver due Reminders to Inbox, and to Telegram when Text me is on, each minute and when the window is shown. Mounted from `app/page.tsx` |
| `use-people-i-know.ts` | Create or adopt the People I Know list after the task vault hydrates. Mounted from `app/page.tsx` |
| `use-close-gift-ideas.ts` | After hydrate, ensure a Gift ideas list for each person already Close. A later save that turns Close on or renames the person updates it. Mounted from `app/page.tsx` |
| `use-instagram-lists.ts` | Create or adopt the two Instagram lists after the task vault hydrates. Mounted from `app/page.tsx` beside `usePeopleIKnowList` |
| `use-inbox-process-todo.ts` | Add today's process-inbox To Do when the revisit Inbox is over 100. Mounted from `app/page.tsx` after rollover |
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
| `analytics-plan/` | Build briefs for a later Analytics redesign. Keeps every current view. [`analytics-plan/README.md`](analytics-plan/README.md) |
| `analytics-vision/` | Analytics tab this vault can support, from Tracking, Habits, Plan, Now, and Telegram. Ignores the current analytics UI on purpose. Combined: [`analytics-vision/ANALYTICS_VISION.md`](analytics-vision/ANALYTICS_VISION.md). [`06-language.md`](analytics-vision/06-language.md) is an unbuilt intention to read stored prose |
| `SPEC_MAPPING.md` | Spec → code checklist (✅ 🟡 ⛔ 🕓)     |
| `MODULE_PLATFORM.md` | **North star** — install any small `.tsx` app into the brain (port wizard + LLM-assisted mapping); five laws, install ladder, manifest + bridge grants, shadow-DB debt |
| `ARCHITECTURE_MODULARITY.md` | Platform vs duplicated chrome; foundation-first refactor order; deliberate *do not extract* list |
| `MESSAGE_INGEST.md` | Phone-message ingest (**BIM**): command language, manuals, hub, pin, pairing, Shortcuts, OCR |
| `BIM_COMMANDS.md` | Complete BIM command catalog (every verb/alias/expansion/preset/GM reply/retired `g`) |
| `shortcuts/` | Signed AirDrop files in the repo: [`Screen Time to Brain2.shortcut`](shortcuts/Screen%20Time%20to%20Brain2.shortcut), [`iPhone Call to Brain2.shortcut`](shortcuts/iPhone%20Call%20to%20Brain2.shortcut), [`iPhone Text to Brain2.shortcut`](shortcuts/iPhone%20Text%20to%20Brain2.shortcut), [`Location to Brain2.shortcut`](shortcuts/Location%20to%20Brain2.shortcut). Dump iPhone Notes is the recipe [`dump-iphone-notes-to-brain2.md`](shortcuts/dump-iphone-notes-to-brain2.md) plus `npm run shortcut:iphone-notes` (`Dump iPhone Notes to Brain2.wflow.json` will not import; the signed `.shortcut` is not in the repo). Other recipes: [`screen-time-to-brain2.md`](shortcuts/screen-time-to-brain2.md), [`iphone-calls-and-texts-to-brain2.md`](shortcuts/iphone-calls-and-texts-to-brain2.md), [`iphone-location-to-brain2.md`](shortcuts/iphone-location-to-brain2.md) |
| `DESIGN_STYLE.md` | UI gold standard — **Habits is the favorite / most developed interior** (look there first); house motifs (brain, light bulb, graph nodes); Lists chrome + velvet/orbs; feral module skins |
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
| `widget-improvement/` | Research reports on the Home overview widgets and Module cards, from the live vault on 9 Oct 2026 ([`widget-improvement/README.md`](widget-improvement/README.md)). Implementation plans live in `widget-improvement/plan/`. |
| `UI_NEXT.md` | Ranked UI executable list (subordinate to the plan) |
| `UI_CRITIQUE.md` | Unranked per-tab observations — do not execute top to bottom |
| `CANONICAL_FIELDS.md` | Canonical `Item`/data-model field reference (cleanup is step 1, not last) |
| `COUNTS_AS.md` | Tracking pen nesting — what "counts as" means; `parentIds` with `parentId` as the display parent |
| `time-context-vision.md` | Time-context slices: a predicate over `TimeEntry`. Specified, not shipped |
| `AstrologyPredictions.md` | Hellenistic timing for the 5 May 2000 Rogers chart, natal sections labeled apart from the dated forecast |
| `monthpredictions.md` | Twenty-four profection months, October 2026–September 2028, Swiss Ephemeris dates in America/Los_Angeles |
| `PEN_ACTION_FORMATS.md` | Pen default action formats → Done-today rows |
| `BRAIN2_FEATURE_IDEAS.md` | 280 idea-bank buildouts (160 from `Brain2Ideas` + 120 Expansion II), mapped to the data model; Sep 2026 shipped/partial/not-shipped audit on the realistic slice; Wave 11 in `PLAN_OF_ACTION.md` |
| `tree.txt`        | Plain `tree` command output           |
| `tree.md`         | This file — annotated clickable index |
| `screenshots/`    | PNG + `.txt` write-ups per view; evolution reel in [`screenshots/viewer.html`](screenshots/viewer.html) (see [`screenshots/README.md`](screenshots/README.md)) |

Re-capture screenshots: `npm run capture-screenshots` (with `npm run dev` running). `npm run screenshot-reel` serves the evolution reel and feature notes.

→ [`docs/README.md`](README.md)

---

## public/

| Path                     | Purpose                            |
| ------------------------ | ---------------------------------- |
| `fonts/w95fa.woff`       | Pixel Win95 UI font (`app/win95.css`) |
| `orbs-removebackground/` | 1000+ orb PNGs (manifest in `lib/orbs-manifest.ts`) |
| `folders-removebackground/` | Photographed folder cut-outs for the Lists tab (manifest in `lib/folders-manifest.ts`) |
| `friend-pack/`            | 71 preapproved today's-friend PNGs from `animalsrcs/` (`lib/friend-pack-manifest.ts`) |
| `gems-removebackground/` | 114 tight-cropped gem PNGs (every file; manifest in `lib/gems-manifest.ts`) |
| `newvelv.jpg`            | Lists icon-view velvet desktop background |
| `pcb/`                   | Photoreal app-desktop PCB plates (`ceramic` / `mint` / `ice` / `xray` / `fr4`) |
| `planets/`               | Cylindrical Sun and planet maps for the Moon chart (Hastings-Trew) |
| `pen-tray/`              | Tracking pen-well photographs (`cat` default, `pewter`, `jewel`, `bloom`, `fr4`, `xray`) |

---

## scripts/

| File                      | Purpose                       |
| ------------------------- | ----------------------------- |
| `update-tree.sh`          | Regenerate [`tree.txt`](tree.txt) (`npm run tree`) |
| `process-gems.py`          | Knock out gem photos + rescan catalog |
| `process-folders.py`       | Knock out `folders/` into `public/folders-removebackground/` + manifest |
| `process-friend-pack.py`   | Studio-knock `animalsrcs/` into `public/friend-pack/` + manifest |
| `crop-gems.py`             | Tight-crop every gem to its alpha box (~3% pad) |
| `capture-screenshots.mjs` | Automated docs screenshots    |
| `screenshot-archive.mjs`  | Copy a live PNG into `docs/screenshots/history/` before overwrite (`archiveShot`); write `reel.js` (`writeReelIndex`) |
| `screenshot-reel-server.mjs` | Serve the evolution reel and `feature-notes.json` (`npm run screenshot-reel`) |
| `write-screenshot-reel.mjs` | Same server entry, kept next to the archive helper |
| `cogs-dev-server.mjs`     | Next + `/api/health` + `/api/sync` + `/api/persist` + `/api/ingest` + `/api/notes` + `/api/screentime` on one port; Electron strict-port reclaim of leftover Node |
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
| `build-iphone-notes-shortcut.mjs` | Write + sign Dump iPhone Notes (`npm run shortcut:iphone-notes`). The signed `.shortcut` is generated and is not in the repo. `Dump iPhone Notes to Brain2.wflow.json` will not import. Find Notes 1001 + Pick a note; no `properties.notes` / Adjust Date |
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

`components.json` · `next.config.mjs` (dev watch ignores `data/`, `.cursor/`, `out/`, `dist/` so hub writes and editor junk cannot Fast Refresh the skin; Next’s own filesystem webpack cache is left intact) · `package.json` · `tailwind.config.ts` ·
`tsconfig.json` · `postcss.config.mjs` · `vitest.config.ts` · `playwright.config.ts` ·
`next-env.d.ts` · `package-lock.json`

---

## App map

```
app/page.tsx                         ← full app shell
app/popout/page.tsx                  ← Pop out: only the module (`?module=`) or sheet (`?sheet=`)
├── Header: Review (+ Morning Review) | Settings gear | Names ? | Search | Now | Inbox | Quick Add (Bulk and Plain inside; Metrics is on Current moment in Now)
│            (Quick Add is Cmd/Ctrl-Shift-A — useQuickCaptureHotkey. Bulk and Plain stay in that dialog. Plain is default off.
│             From Notes, Phone Notes, and Ingest are in Settings and Lists settings.
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
(`components/Completion/`) to select or create objectives and goals, optionally
review time and reflections, and award quick-review points
(Undo reopens the item; Skip keeps the win; Save records the contribution).

Lists task select → `components/ItemDetail/ItemDetailPage.tsx` (full screen).

---

## cosmeticsandperfume/

Personal notes, not app code. [README](../cosmeticsandperfume/README.md)
indexes the plan, the 5 October 2026 price research, the cheaper-options
note, the shopping list, the sortable
[cart](../cosmeticsandperfume/cart.html), global-sourcing tips, and the
formulas (dry argan hair mist, rice shampoo bar, glitter
mist, brightening serum, dishwashing brick, solid perfume, shimmer oil,
perfume accords, laundry scents, laundry detergent, fabric softener, trials, experiments, and the safety note).

## Spec gaps (highest impact)

| Area       | Status          | Next step                                      |
| ---------- | --------------- | ---------------------------------------------- |
| Storage    | 🟡 localStorage | Manual phone hub is the sync that exists. Atlas is speculation (§3). JSON export already ships. |
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
