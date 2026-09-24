/**
 * Metadata for docs/screenshots/*.png — used by capture-screenshots.mjs and
 * generate-screenshot-docs.mjs.
 */
export const GLOBAL_HEADER = `
Pinned full-width mill title bar (\`AppHeader\`, sticky top, z-40): navy BRAIN2 caption with Tek POWER lamp + today's-friend jewel (64px chrome + black-mirror well; click for a Stardew Next Action bubble; Esc / × / outside to close) and Friend / Review / System / Capture as Win95 groupboxes of milled press keys. Names stays Names and latches (sunken, aria-pressed); tooltip Stop naming while on. Phosphor counts on Review and Inbox. Quick Add is the default framed key, docked at the right of Capture. Same doors as before — grouped furniture, not a menu bar.
Tabs: milled fascia (brushed bay, raised silver keys, active key a CRT with a round power lamp) — Home · Lists · Docs · Scheduler · Operations · Modules · Analytics.
Shortcuts: Cmd/Ctrl+K search · capture hotkey → Quick Add.
`.trim()

export const HOME_CHROME = `
Home window: milled date plate (weekday CRT, calendar nameplate, Widgets key); Review due banner (Start review / Dismiss); All Time / Today / Week / Month points; Today's Progress (To Do + Habits remaining/done); Needs Attention (Overdue / Blocked / Unclarified — click opens detail). Sub-tabs: Habits · Plan · To Do · Goals · Tracking.
`.trim()

export const ANALYTICS_CHROME = `
Analytics window: navy **title bar** and **status bar** stay Lists furniture. Interior is a light instrument studio (Karla only, ink on beige nested wells, phosphor traces — not cream-on-cream, not dark CRT), range chips (7 / 14 / 30 / 90 or Custom inclusive from–to, labeled as the dates) labeled once, left studio index Behavior / Time / Accuracy / Meta / Library with views of the selected group (\`role="tab"\`). Views include Observatory, Circadian, **Screen Time**, Places, Mood field, Diversity, Transitions, Spectrum, Velocity, Cycle, Goals, Operations, Lists & areas (size by items + HHI), Tags, Stages, Weight, Attributes, Item Types, Cross-section, Overcommit. Tracking shows a **pie** plus mosaic; the drill lists blocks and opens the Tracking editor. Empty charts keep the frame and one sentence; interpretive views show n and watermark a thin sample. Hover **?** and native titles for instructions. Status: last N days or custom dates · current view.
`.trim()

/** @typedef {{ file: string, view: string, sources: string[], description: string, area: string }} ShotMeta */

/** @type {ShotMeta[]} */
export const SHOTS = [
  // ── Home ──────────────────────────────────────────────────────────────────
  {
    file: "01-home-daily-habits.png",
    area: "Home → Habits",
    view: "Home tab → Habits sub-tab → Daily frequency",
    sources: [
      "app/page.tsx",
      "components/Home/home-dashboard.tsx",
      "components/Home/Habits/habit-tracker.tsx",
      "components/Home/Habits/task-grid.tsx",
      "components/Home/Habits/habit-chrome.css",
      "components/Home/Habits/cockpit-switch.tsx",
      "components/Home/Habits/habits-control-panel.tsx",
      "components/Home/Habits/willpower-gems.tsx",
      "components/Home/Habits/good-days-dialog.tsx",
      "components/Home/points-stats.tsx",
      "components/Home/daily-progress-quickview.tsx",
      "components/Home/NeedsAttention.tsx",
      "lib/habits-store.ts",
      "lib/habit-tracking.ts",
    ],
    description: `Home window: milled date plate (weekday CRT, calendar nameplate, Widgets key); shared overview squares (Review due, All Time / Today / Week / Month, Today's Progress; Widgets adds Affirmation / Weather) in one equal-height row. Wells stay narrow and share one metal/CRT face (no extra-dark All Time); CRT values are centered in \`--hab-crt-green\`; Weather uses a sun/cloud/rain glyph; Widgets catalog is an overlay. Fill bars use Habits Percent LED + grade-tube colors. Same strip on Plan / To Do / Goals / Tracking. Needs Attention (Overdue / Blocked / Unclarified — click opens detail). Sub-tabs: Habits · Plan · To Do · Goals · Tracking.
Habits Daily sits in a contained gunmetal console (\`.hab95\`) — teal desktop gutters by default (photograph plates stay opt-in). Header is one textured row: Habits | week nav | Settings. Daily / Weekly / Monthly inset keys sit above the sheet (no green glow). Today is a sunken state, not a larger control. Right Habits Tab Control Panel: Week grade + Perfect output tubes; Good day streak + Good days in the last month; Sort Habits plate; Heatmap View / Day View / Hide Completed Today / Loading Bar / Small LEDs rockers; New habit; Willpower gems photoreal chrome + black-mirror oval button (press to stir — a short whirl; grab a gem to throw it, which must not also click-stir the plate; crystal is a solid — gems do not clip through; gems visible past the rim; plate centered in the well; compact column; Physics opens a popup lab with a mapped twin plate, CRT equation/graph wells, and live sliders). Current-day column is a single solid mint fill. Heatmap View is a light metal month-of-cells mosaic (same well as the checklist). Grid: gem/edit | wrapping Task name | Mon–Sun cells (day columns grow with leftover width) | %. Yes/No cells are recessed square-plate panel lamps (on-color is Percent LED tint, dim/warm, not blast-white). Goal/climb cells share one number slot plus \`/goal\` suffix. Clock glyph + blue border = Tracking auto-fill. Daily Completion % row uses a quiet 10-pip milled channel + % text (Loading Bar; numeric LED optional). New habit = Add Habit (frequency, type, Target, Time estimate, Auto-fill from Tracking).`,
  },
  {
    file: "01-home-habits-weekly.png",
    area: "Home → Habits → Weekly",
    view: "Home tab → Habits → Weekly frequency",
    sources: [
      "components/Home/Habits/habit-tracker.tsx",
      "components/Home/Habits/period-habit-list.tsx",
      "components/Home/Habits/habits-control-panel.tsx",
      "components/Home/Habits/willpower-gems.tsx",
    ],
    description: `Home window: milled date plate (weekday CRT, calendar nameplate, Widgets key); shared overview squares (Review due, All Time / Today / Week / Month, Today's Progress; Widgets) in one equal-height CRT row. Needs Attention (Overdue / Blocked / Unclarified — click opens detail). Sub-tabs: Habits · Plan · To Do · Goals · Tracking.
Habits: week navigation in the console header (Today + 7-week window); Daily / Weekly / Monthly inset keys above the sheet; Habits Tab Control Panel with Span grade + Perfect output tubes, Sort plate, Hide Completed This Week, Loading Bar, Small LEDs, New habit, Willpower gems. Compact grid: weekly habits × 7 weeks + row % + weekly-completion footer (same chrome as Daily, gem Edit/Delete). Fresh seed includes Weekly review, Deep work hours (Tracking Work tag), Get one workout in (Exercise auto-fill), and One lesson from this week (text). Type-matched cells (checkbox / count / text / climb), Tracking clock marks when auto-filled. Same store as Lists → Weekly Habits.`,
  },
  {
    file: "01-home-habits-monthly.png",
    area: "Home → Habits → Monthly",
    view: "Home tab → Habits → Monthly frequency",
    sources: [
      "components/Home/Habits/habit-tracker.tsx",
      "components/Home/Habits/period-habit-list.tsx",
      "components/Home/Habits/habits-control-panel.tsx",
      "components/Home/Habits/willpower-gems.tsx",
    ],
    description: `Home window: milled date plate (weekday CRT, calendar nameplate, Widgets key); shared overview squares (Review due, All Time / Today / Week / Month, Today's Progress; Widgets) in one equal-height CRT row. Needs Attention (Overdue / Blocked / Unclarified — click opens detail). Sub-tabs: Habits · Plan · To Do · Goals · Tracking.
Habits: month navigation in the console header (This month + 7-month window); Daily / Weekly / Monthly inset keys above the sheet; Habits Tab Control Panel with Span grade + Perfect output tubes, Sort plate, Hide Completed This Month, Loading Bar, Small LEDs, New habit, Willpower gems. Compact grid: monthly habits × 7 months + row % + monthly-completion footer (same chrome as Weekly, gem Edit/Delete). Fresh seed includes Pay recurring bills, Finish 1 book this month, Chore hours (Tracking Cleaning tag), and This month's theme (text). Completions feed Analytics heatmap/points. Goal / Yes-No can Auto-fill from Tracking (month sum).`,
  },
  {
    file: "02-home-plan.png",
    area: "Home → Plan → Month",
    view: "Home tab → Plan sub-tab → Month view",
    sources: [
      "components/Home/Plan/plan-panel.tsx",
      "components/Home/Plan/month-view.tsx",
      "components/Home/Plan/plan-text-log.tsx",
      "components/Home/Plan/planned-tasks-sidebar.tsx",
      "components/Home/Plan/plan-chrome.css",
      "components/Home/Plan/event-dialog.tsx",
      "lib/event-store.ts",
    ],
    description: `Home window: milled date plate (weekday CRT, calendar nameplate, Widgets key); shared overview squares (Review due, All Time / Today / Week / Month, Today's Progress; Widgets) in one equal-height CRT row. Needs Attention (Overdue / Blocked / Unclarified — click opens detail). Sub-tabs: Habits · Plan · To Do · Goals · Tracking.
Plan: Win95 window (Plan — Calendar). Settings; Paste Events (Parse → Import); Add Event is a bounded Win95 dialog (navy caption, ~30.5rem, not a stretched sheet; dirty close prompts Save / Cancel / Exit without saving); Add Plan opens the same-sized planned-action dialog, which writes a dashed linen chip instead of an event. Toolbar tabs Month / Week / Day; optional Dark latch (Plan-only). Sidebar Planned This Month: packed list well (not raised buttons), search + sort, To Do / Habits filters, incomplete monthly habit gems, 10-pip capacity channel + sentence (drag onto days / drop here to unschedule / click → detail; add a month to-do; empty rail stays). Nested metal rail + desktop wells. Period toolbar (< / centered label / > / padded Today). Compact day squares with FR4 hairlines; today is a mint dashed cell; opalescent event chips (time range + wrap + +N more with a tiny orb; left stripe + glass wash; user color, default mint); planned actions sit beside them as dashed linen chips. Month Plan log (Submit plan stamps writing time; List / Bulk / Latest). Status bar: view · date · event count.`,
  },
  {
    file: "02-home-plan-week.png",
    area: "Home → Plan → Week",
    view: "Home tab → Plan → Week view",
    sources: [
      "components/Home/Plan/week-view.tsx",
      "components/Home/Plan/planned-tasks-sidebar.tsx",
      "components/Home/Plan/plan-text-log.tsx",
      "components/Home/Plan/plan-chrome.css",
    ],
    description: `Home window: milled date plate (weekday CRT, calendar nameplate, Widgets key); shared overview squares (Review due, All Time / Today / Week / Month, Today's Progress; Widgets) in one equal-height CRT row. Needs Attention (Overdue / Blocked / Unclarified — click opens detail). Sub-tabs: Habits · Plan · To Do · Goals · Tracking.
Plan Week: Win95 window (Plan — Calendar). Settings / Paste Events / Add Event / Add Plan (bounded Win95 dialogs; dirty close prompts). Toolbar Month / Week / Day + Dark latch. Sidebar Planned This Week: packed list well + 10-pip capacity, search/sort, To Do / Habits filters, incomplete weekly habit gems, add a week to-do (same records as Home → To Do); drag onto hours / drop here to unschedule / click → detail. Nested metal wells. Period toolbar + padded Today. Time × Mon–Sun slots with FR4 hairlines; today’s column can wash mint; timed events are one spanning opal block (not reprinted each hour). Planned actions ride the same grid as dashed linen chips; click one to edit it. Click slot/event to create/edit. Week Plan log (Submit plan stamps writing time; List / Bulk / Latest). Status bar: view · date · event count.`,
  },
  {
    file: "02-home-plan-day.png",
    area: "Home → Plan → Day",
    view: "Home tab → Plan → Day view",
    sources: [
      "components/Home/Plan/day-view.tsx",
      "components/Home/Plan/agenda-grid.tsx",
      "components/Home/Plan/plan-text-log.tsx",
      "components/Home/Plan/planned-tasks-sidebar.tsx",
      "components/Home/Plan/plan-chrome.css",
    ],
    description: `Home window: milled date plate (weekday CRT, calendar nameplate, Widgets key); shared overview squares (Review due, All Time / Today / Week / Month, Today's Progress; Widgets) in one equal-height CRT row. Needs Attention (Overdue / Blocked / Unclarified — click opens detail). Sub-tabs: Habits · Plan · To Do · Goals · Tracking.
Plan Day: Win95 window (Plan — Calendar). Settings / Paste Events / Add Event / Add Plan (bounded Win95 dialogs; dirty close prompts). Add Plan writes a planned action — a dashed linen chip, not an event — on the selected day. Toolbar Month / Week / Day + Dark latch. Sidebar Planned Today: packed nested wells, 10-pip capacity, search/sort, To Do / Habits / Next actions filters, habit gems on incomplete daily habits, Add a to-do; drop here to unschedule. Period toolbar: roomy chevrons, centered date, padded Today. Fieldset legends are navy labels (not links). All-day banners (opal chip + crystal-ball mark) + a tall agenda with 152px hour rows that lands on now (today, red now-line) or waking hour (other days); FR4 hairlines; opalescent events; sunrise/sunset. Drag sidebar rows onto hours to plan them (native drag plus a pointer fallback, so a host that strips DataTransfer still drops); the new placement opens the planned-action dialog for duration and notes. Click event → detail. Day Plan log: Submit plan stamps writing time; List / Bulk / Latest; copy-only history, newest first (composer capped so the agenda stays the large surface). Status bar: view · date · event count.`,
  },
  {
    file: "03-home-todo.png",
    area: "Home → To Do → Day",
    view: "Home tab → To Do sub-tab → Day period",
    sources: [
      "components/Home/ToDo/todo-panel.tsx",
      "components/Home/ToDo/TodoTable.tsx",
      "components/Home/ToDo/todo-utils.ts",
      "components/Home/ToDo/DoneTodoSection.tsx",
      "components/Home/ToDo/CompletionTimeLine.tsx",
      "components/Focus/JustStartMode.tsx",
    ],
    description: `${HOME_CHROME}
To Do: Sort (Tier / Priority / Name / Date created / Date added / Days pushed) + asc/desc + formula (Urgency / Importance / Quick win / Entropy, Reset); Status (Open / Active / Partial / Deferred / Cancelled / All); Show All Tasks; Add Task (description + tier). Tabs Day / Week / Month. Today's Tasks: date nav; cols Task / Status / Tier (A+…D) / Days (pushed) / Actions (complete, Just Start, push, details, hide). Show N more. Done Today (n, N est.) + Log done. Done rows: clock window · duration · ~est. (Looks right / Finished / Took). Just Start overlay: timer, Done with this step.`,
  },
  {
    file: "03-home-todo-week.png",
    area: "Home → To Do → Week",
    view: "Home tab → To Do → Week period",
    sources: ["components/Home/ToDo/todo-panel.tsx", "components/Home/ToDo/TodoPeriodNav.tsx"],
    description: `${HOME_CHROME}
To Do Week: same Sort / formula / Status / Show All / Add Task. This Week's Tasks: week nav; cols Task / Status / Tier / Weeks (pushed) / Actions. Done this week + Log done. Done rows dated, with duration and est. chip.`,
  },
  {
    file: "03-home-todo-month.png",
    area: "Home → To Do → Month",
    view: "Home tab → To Do → Month period",
    sources: ["components/Home/ToDo/todo-panel.tsx"],
    description: `${HOME_CHROME}
To Do Month: same toolbar. This Month's Tasks: month nav; table Task / Status / Tier / Months (pushed) / Actions. Done this month + Log done. Done rows dated, with duration and est. chip.`,
  },
  {
    file: "04-home-goals.png",
    area: "Home → Goals",
    view: "Home tab → Goals sub-tab",
    sources: [
      "components/Home/Goals/goals-tracker.tsx",
      "components/Home/Goals/ObjectivesPanel.tsx",
      "components/Home/Goals/DirectionReport.tsx",
      "lib/goals-store.ts",
    ],
    description: `${HOME_CHROME}
Objectives: Add Objective; period Day / Week / Month / Year / All; Prioritized (star); All objectives accordion (click → detail: periods, linked goals, Archive, Delete). Goals: Add Goal; filters All / Day / Week / Month / Year / Custom range / Aspirational; cards: period, edit, progress, linked chips, −1 / +1, Log, Mark complete. Direction in Life: coverage strip, Drift days, Neglected goals.`,
  },
  {
    file: "08-home-tracking.png",
    area: "Home → Tracking → Time Grid",
    view: "Home tab → Tracking → Time Grid",
    sources: [
      "components/Home/Tracking/time-grid.tsx",
      "components/Home/Tracking/cell-size-keys.tsx",
      "components/Home/Tracking/week-grid.tsx",
      "components/Home/Tracking/infinite-strip.tsx",
      "components/Home/Tracking/pen-palette.tsx",
      "components/Home/Tracking/pen-swatches.tsx",
      "components/Home/Tracking/tracking-chrome.css",
      "components/Home/Tracking/tracking-view-settings-dialog.tsx",
      "components/Home/Tracking/log-activity-dialog.tsx",
      "lib/pen-sort.ts",
      "components/Home/Tracking/entry-dialog.tsx",
      "components/Home/Tracking/variant-chips.tsx",
      "components/Home/Tracking/pen-settings-dialog.tsx",
      "components/Home/Tracking/tracking-tags-panel.tsx",
      "components/Home/Tracking/working-now-strip.tsx",
      "components/Home/Tracking/pen-color-now-strip.tsx",
      "lib/pen-color-session.ts",
      "components/Home/Tracking/tracking-day-notes.tsx",
      "components/cognitive-state.tsx",
      "lib/time-entries.ts",
      "lib/time-tracking-store.ts",
      "lib/tracking-summary.ts",
      "lib/tracked-time.ts",
      "lib/sleep-sync.ts",
    ],
    description: `${HOME_CHROME}
Tracking in a Win95 window (navy title + orb). Toolbar tabs: Time Grid · Activity Log · Day Log. Working now (if ops), then **Working on right now** (search a pen color; timer from this second). No Sleep this day form — sleep is painted on the grid. Logged nights still paint onto the grid when the tab mounts. Pen palette (panel, not a nested window): views on one toolbar row (Activity / Location / Mood / Company / **Screen Time** / **iPhone Screen Time** / **iPhone Calls** / **iPhone Texts** / … — Activity is the painted one on launch; Screen Time is ActivityWatch meaning, not a steal of the active view); Show as + **Sort Recent / A–Z / Tree** + Erase / Scissors / Hide / View / Tags + **Log activity** on the next. Selected pen is a large swatch + name + **Settings** for that pen (View settings is a separate dialog: infinite day/week, hidden pens). **1m / 5m / 10m / 15m / 30m** cell size on the grid chrome; the live step is navy inset with a phosphor cap. Velvet well of pen beads (recently painted first; optional image on the bead); search; New pen (beveled color swatch). Detail variants. Status: N pens · sorted recent. Time Grid in the white field (dark ink, gray hour labels): day / week; optional infinite scroll (time L→R, days stacked); occupancy; if this view is empty a banner offers **Show Activity (Nh)**; drag to paint (assumed hatched; pen image tiles as a mosaic); scissors splits at the minute; click a block including Sleep → Entry dialog (display name, primary + secondary pens; sleep says Fell asleep / Woke up). Day notes under the grid. Pen settings: searchable Counts as, color chain, default action format, optional image.`,
  },
  {
    file: "08-home-tracking-week.png",
    area: "Home → Tracking → Time Grid → week",
    view: "Home tab → Tracking → Time Grid → week",
    sources: [
      "components/Home/Tracking/week-grid.tsx",
      "components/Home/Tracking/pen-palette.tsx",
      "components/Home/Tracking/pen-swatches.tsx",
      "components/Home/Tracking/tracking-chrome.css",
      "lib/pen-sort.ts",
      "components/Home/Tracking/time-grid.tsx",
      "components/Home/Tracking/tracking-day-notes.tsx",
      "lib/time-entries.ts",
      "lib/tracking-summary.ts",
    ],
    description: `${HOME_CHROME}
Time Grid with the span switch on week. Tracking Win95 window; palette Sort Recent / A–Z / Tree; Erase / Scissors / Hide / View; velvet pen well. Seven columns, Monday first, each heading a clickable date (weekday + day) that drops back into the day view on that date, with the day's occupancy under it (overlapping blocks count once). Optional infinite week (View settings) stacks week bands with time running left to right. Header: week nav (‹ · This week · ›), the date range, tracked total · % of the week · N of 7 days logged — occupancy of the week, so coverage cannot exceed 100%. Tools: cell size 15m / 30m / 60m; From / To; an On row of seven day toggles plus Mon–Fri and All 7; Fill N days with {pen}. Drag down a column to paint that day; scissors splits at the minute; click a painted cell for the Entry dialog. Pen images tile as a mosaic. Below: per-day chips with a × to clear one day in this scope, then per-pen minutes and % and By tag (all scopes) totals. Day notes under the week.`,
  },
  {
    file: "08-home-tracking-activity.png",
    area: "Home → Tracking → Activity Log",
    view: "Home tab → Tracking → Activity Log",
    sources: [
      "components/Home/Tracking/tracking-activity-log.tsx",
      "components/Home/Tracking/log-activity-dialog.tsx",
      "components/Home/Tracking/pen-swatches.tsx",
      "components/Home/Tracking/tracking-day-notes.tsx",
      "components/Home/Tracking/entry-dialog.tsx",
      "lib/time-entries.ts",
      "lib/tracking-summary.ts",
    ],
    description: `${HOME_CHROME}
Tracking → Activity Log inside the Tracking window. Palette Sort Recent / A–Z / Tree; velvet pen well; **Log activity** on the shared palette. Day nav + block count · occupancy; one row per block (display name, assumed badge when reconstructed, secondary pens as +name, discrete events as a single clock) and untracked gaps with a **+** in line with the pencil (opens Log activity for that window) plus an optional personal note. **Log activity** types optional name, start / end (or one time for a discrete event), pen, notes; a discrete event can start or end a state block. Mark as assumed. **Done this day** lists To Do items finished on this calendar day (hints, not auto-painted; pen action-format rows appear here too). Footer per-pen and By tag totals. Day notes under the list.`,
  },
  {
    file: "08-home-tracking-block.png",
    area: "Home → Tracking → block editor",
    view: "Home tab → Tracking → Activity Log → click a block",
    sources: [
      "components/Home/Tracking/entry-dialog.tsx",
      "components/Home/Tracking/pen-swatches.tsx",
      "components/Home/Tracking/companion-section.tsx",
      "components/Home/Tracking/variant-chips.tsx",
      "lib/entry-links.ts",
      "lib/time-entries.ts",
    ],
    description: `${HOME_CHROME}
Entry dialog — one block, opened from the grid or an Activity Log row. Header: display name · clock span, duration + scope. Start / End (Sleep: **Fell asleep** / **Woke up**; discrete events: a single **When**); **Split at** a chosen minute; **Assumed / reconstructed** (default certain). Display name (defaults to the pen). Searchable pen picker with New pen (name + beveled color swatch, or Create from a search miss); secondary pens; Detail (variant chips); Also counts as (block tags). Also happening. Split (scissors seam so halves do not merge back), Delete, Save. Sleep invites dream notes.`,
  },
  {
    file: "08-home-tracking-daylog.png",
    area: "Home → Tracking → Day Log",
    view: "Home tab → Tracking → Day Log",
    sources: [
      "components/Home/Tracking/actual-day-view.tsx",
      "components/Home/Tracking/confirm-planned-dialog.tsx",
      "components/Home/Tracking/tracking-day-notes.tsx",
      "components/Home/Plan/agenda-grid.tsx",
      "lib/tracking-summary.ts",
      "lib/services/completion-service.ts",
    ],
    description: `${HOME_CHROME}
Tracking → Day Log inside the Tracking window (no nested Agenda / Activity Log). Shared palette includes **Log activity**. Day nav; Planned Xm estimated · Task logs Xm. Painted occupancy strip. One hour grid with more room per hour: solid = tracked (display-depth color; ≈ if assumed); dashed = planned (click to confirm it happened — paint, optional notes; tasks completeTask and unlock dependents); amber = task timeLogs. Sleep and long blocks are sliced so every occupied hour is clickable. Click a painted block → Entry dialog. Day notes under every Tracking view.`,
  },

  // ── Lists ─────────────────────────────────────────────────────────────────
  {
    file: "05-lists.png",
    area: "Lists → Home → Icons",
    view: "Lists tab → Home folder → Icons view",
    sources: [
      "components/Lists/enhanced-list-view.tsx",
      "components/Lists/views/FolderViewIcons.tsx",
      "components/Lists/filemanager98.css",
      "lib/lists-ui-store.ts",
    ],
    description: `File Manager (_ □ ×). Toolbar: Up, New List, New Folder, Import spreadsheet, Completed, Settings, Select, View: Icons / List / Details / Cards, Auto-organize, Search. Address bar. Sidebar Quick Access: Home, All, folder tree, + New Folder. Velvet Icons: smart-list orbs (Daily/Weekly/Monthly Habits, Objectives, Daily/Weekly/Monthly To Do) — double-click opens; ★ pin, ✎ change icon. Status: folder/list counts + Smart lists checkbox.`,
  },
  {
    file: "05-lists-list.png",
    area: "Lists → Home → List",
    view: "Lists tab → Home → List folder view",
    sources: ["components/Lists/views/FolderViewList.tsx"],
    description: `Same Lists chrome. List view: Search lists…; named rows with type icons — click/dblclick opens. Select-mode checkboxes when Select is on.`,
  },
  {
    file: "05-lists-details.png",
    area: "Lists → Home → Details",
    view: "Lists tab → Home → Details folder view",
    sources: ["components/Lists/views/FolderViewDetails.tsx"],
    description: `Same Lists chrome. Details: List within folder names checkbox; columns Name / Type / Items / Complete / Within — dblclick opens.`,
  },
  {
    file: "05-lists-cards.png",
    area: "Lists → Home → Cards",
    view: "Lists tab → Home → Cards folder view",
    sources: ["components/Lists/views/FolderViewCards.tsx"],
    description: `Same Lists chrome. Cards: title, description, counts; + add, settings, delete; Eye opens list. Smart to-do cards show due empty copy.`,
  },
  {
    file: "05-lists-content-default.png",
    area: "Lists → list → Default",
    view: "Lists tab → Example List → Default display",
    sources: ["components/Lists/list-content/ListContentDefault.tsx", "components/Lists/list-content/ListContentPanel.tsx"],
    description: `Open-list chrome: Up, New List/Folder, Import, Completed, Settings, Select, Display: Default / Checklist / Icons / Details / Spreadsheet, Search. Address. Sidebar. Inner: title, window buttons, Bulk add items, Add Item; Default rows (click → detail). Right: Add Item, Bulk add, List Settings, Change Icon, Pin to Home, Delete List. Status bar + Smart lists.`,
  },
  {
    file: "05-lists-content-checklist.png",
    area: "Lists → list → Checklist",
    view: "Lists tab → Example List → Checklist display",
    sources: ["components/Lists/list-content/ListContentChecklist.tsx"],
    description: `Same open-list chrome. Checklist: checkbox-first rows (complete in place); click name → detail. Same Bulk add / Add Item / right-rail actions.`,
  },
  {
    file: "05-lists-content-spreadsheet.png",
    area: "Lists → list → Spreadsheet",
    view: "Lists tab → Example List → Spreadsheet display",
    sources: ["components/Lists/list-content/ListContentSpreadsheet.tsx"],
    description: `Same open-list chrome. Spreadsheet: formula bar, Filter…, columns (# / checkbox / Item / attributes), sort, Add column, Add Item… + Add row. Cell edit / fill handle / Open to edit. Pop-out window supported.`,
  },

  // ── Scheduler ─────────────────────────────────────────────────────────────
  {
    file: "06-scheduler.png",
    area: "Scheduler → Always",
    view: "Scheduler tab → Funnel → Always period",
    sources: [
      "components/Scheduler/enhanced-scheduler.tsx",
      "components/Scheduler/AlwaysTab.tsx",
      "components/Scheduler/SchedulerFilters.tsx",
    ],
    description: `Enhanced Scheduler. Views: Funnel / Gantt / Dependencies. Periods: Always / Year / Month / Week / Day. Available Tasks + Filters & Sort (lists, sort field, asc/desc). Task cards: checkbox, duration, urgency, importance — drag into buckets. Overview: This Year, This Month, Next Month, This Week, Next Week, Today, Tomorrow (click drills in).`,
  },
  {
    file: "06-scheduler-day.png",
    area: "Scheduler → Day",
    view: "Scheduler tab → Funnel → Day period",
    sources: ["components/Scheduler/DayTab.tsx", "components/Scheduler/DayAgenda.tsx"],
    description: `Funnel → Day. Date nav (< / date / > / Today). Period tabs Always / Year / Month / Week / Day. Sidebar Today's Tasks (drag onto hours). Daily Agenda 00:00–23:00: drop to hour, click opens item, X clears time.`,
  },
  {
    file: "06-scheduler-gantt.png",
    area: "Scheduler → Gantt",
    view: "Scheduler tab → Gantt view",
    sources: ["components/Scheduler/GanttView.tsx"],
    description: `Gantt view. Gantt & Critical Path: project length; legend Critical path / Has slack. Named task rows (click opens) + duration bars on a time axis.`,
  },
  {
    file: "06-scheduler-dependencies.png",
    area: "Scheduler → Dependencies",
    view: "Scheduler tab → Dependencies graph",
    sources: ["components/Scheduler/DependencyGraph.tsx"],
    description: `Dependencies view. Dependency Graph: task count + Critical count. Nodes (click opens item); edges show blockers before downstream work.`,
  },

  // ── Operations ────────────────────────────────────────────────────────────
  {
    file: "10-operations.png",
    area: "Operations list",
    view: "Operations tab → list landing",
    sources: ["components/Operations/OperationsView.tsx", "components/Operations/operation-actions.ts"],
    description: `Operations — Command Center. Name a new operation…; Shape preset (Standard / Blank / Trip / Project / Paid job); New Operation. When ops exist: Sort (Name / Stage / Target date / Newest), Group by category, Show archived (completed and inactive stay hidden until then), category + Uncategorized filters. Cards: name, stage, mission, category chips, panel count — click opens workspace. Empty copy + status counts (archived hidden called out).`,
  },
  {
    file: "10-operations-workspace.png",
    area: "Operations workspace",
    view: "Operations tab → Operation workspace",
    sources: [
      "components/Operations/OperationWorkspace.tsx",
      "components/Operations/OperationHome.tsx",
      "components/Operations/OperationSettingsDialog.tsx",
      "components/Operations/PhasesPanel.tsx",
      "components/Operations/PartsPanel.tsx",
      "components/Operations/ResourcesPanel.tsx",
      "components/Operations/ToDoNextRail.tsx",
    ],
    description: `Back / Board; click title to rename; stage badge. Menubar: Settings (panels, categories, tracking tags, presets, Delete operation with Are you sure), After-action report, category chips, Working now. Tabs from Settings: Home / To do / Phases / Parts / Timeline / Locations / Plan / Resources / Log. Parts: kinds, part pages, ideas, glance metrics. Home: Mission, Stage, Notes, Work/neglect heatmap. To do next rail (Mark done, open). Status: N panels on.`,
  },

  // ── Modules ───────────────────────────────────────────────────────────────
  {
    file: "09-modules.png",
    area: "Modules dashboard",
    view: "Modules tab → dashboard",
    sources: [
      "components/Modules/modules-panel.tsx",
      "components/Modules/module-bodies.tsx",
      "components/Modules/ModuleConfigDialog.tsx",
    ],
    description: `Modules. Build module (scratch / saved defs / templates: Itinerary, Cleaning, Budget, Book Tasting, Film DNA, Blank; or New widget). Workspaces cards (open, pop out). Dashboard widgets: gear config, × remove. Bodies e.g. Points this week; Writing Assignment Generator (New prompt); What should I do now? (Another / Mark done).`,
  },
  {
    file: "09-modules-workspace.png",
    area: "Modules workspace",
    view: "Modules tab → Itinerary Creator workspace",
    sources: [
      "components/Modules/workspace/ModuleWorkspace.tsx",
      "components/Modules/workspace/ModuleViewEditor.tsx",
      "lib/module-templates.ts",
    ],
    description: `Back; click title to rename; Print / Export; Workflows; Settings; Pop out; Add view. View tabs (Plan / Itinerary / Activities / Packing / Before Trip — per template). Per-view settings gear. Doc/grid body + editor toolbar. Status (word count).`,
  },

  // ── Analytics ─────────────────────────────────────────────────────────────
  {
    file: "07-analytics.png",
    area: "Analytics → Habits",
    view: "Analytics tab → Habits",
    sources: [
      "components/Analytics/enhanced-analytics.tsx",
      "components/Analytics/AnalyticsNav.tsx",
      "components/Analytics/analytics-range-store.ts",
      "components/Analytics/analytics-tabs.ts",
    ],
    description: `${ANALYTICS_CHROME}
Habits: Daily habit completion heatmap for the shared window (Less→More scale); Habit completion bars sorted by rate. Empty heatmap: one sentence in the frame.`,
  },
  {
    file: "07-analytics-points.png",
    area: "Analytics → Points",
    view: "Analytics tab → Points",
    sources: ["components/Analytics/enhanced-analytics.tsx", "lib/points-store.ts"],
    description: `${ANALYTICS_CHROME}
Points daily stacked by source (habit / bonus / task) + cumulative for the shared window; Top point earners jump to Lists. Empty: one sentence in the frame.`,
  },
  {
    file: "07-analytics-tracking.png",
    area: "Analytics → Tracking",
    view: "Analytics tab → Tracking",
    sources: [
      "components/Analytics/enhanced-analytics.tsx",
      "components/Analytics/TrackingAnalytics.tsx",
      "lib/time-tracking-store.ts",
      "lib/tracking-summary.ts",
    ],
    description: `${ANALYTICS_CHROME}
Time distribution for the shared Analytics range: scope picker; % of tracked / % of day; Show untracked; **Include assumed**; **Show as** depth. **Pie** (same slices as mosaic) + mosaic + hour × day heatmap; instants listed separately. Stats Tracked / Coverage / Average per day / Longest block. Click a pie slice, mosaic tile, or row to drill. Open in Lists when items have timeLogs in the window.`,
  },
  {
    file: "07-analytics-tracking-breakdown.png",
    area: "Analytics → Tracking → pen breakdown",
    view: "Analytics tab → Tracking → click a pen row",
    sources: ["components/Analytics/TrackingAnalytics.tsx", "lib/tracking-summary.ts"],
    description: `${ANALYTICS_CHROME}
Pen drill-down dialog (\`sm:max-w-3xl\`): pen name, total over the range, % of tracked. Nested pens show an **Inside {parent}** child list first. Split / Reach for variants on the exact pen. Pie + split bar with name · duration (not jammed). Click a slice to list its blocks; click a block to open Home Tracking \`entry-dialog.tsx\`.`,
  },
  {
    file: "07-analytics-tracking-tag.png",
    area: "Analytics → Tracking → tag breakdown",
    view: "Analytics tab → Tracking → click a tag in By tag",
    sources: ["components/Analytics/TrackingAnalytics.tsx", "lib/tracked-time.ts", "lib/tracking-summary.ts"],
    description: `${ANALYTICS_CHROME}
Tag drill-down dialog: the tag, its total over the range, and every pen that fed it — pen name, its scope, minutes and share. Because tags belong to time rather than to pens, a tag can be fed by a pen that does not carry it: the zoo afternoon was painted in Location and tagged Exercise on that block alone, so Exercise shows Location minutes next to the Activity ones. This is the number a habit linked to the tag receives, with minutes unioned across scopes so a doubly-tagged minute counts once.`,
  },
  {
    file: "07-analytics-sleep.png",
    area: "Analytics → Sleep",
    view: "Analytics tab → Sleep",
    sources: [
      "components/Analytics/enhanced-analytics.tsx",
      "components/Analytics/SleepAnalytics.tsx",
      "lib/sleep-log.ts",
      "lib/sleep-inference.ts",
      "lib/sleep-store.ts",
    ],
    description: `${ANALYTICS_CHROME}
Shared Analytics range (not a second 7d/30d/90d picker), then coverage — nights tracked, nights blank, how many were read off the Tracking grid rather than typed, and the % of ends marked estimated. Copy: same nights as Home → Tracking (no live night jump). Blank nights are excluded from every average rather than counted as zero. The tab reads the sleep log and Sleep-tagged blocks on the grid alike (lib/sleep-inference.ts), per end, so a stated time always wins and a painted one fills a gap.
Four cards: Average night (with median — the honest one when a single all-nighter skews the mean — and how many nights it rests on) · Usually asleep by (with spread, the standard deviation of bedtime) · Usually up at (with spread) · Debt against the target, plus how many nights hit it.
How far the ends swing: the earliest and latest bedtime and the earliest and latest wake time, each with its date, and the gap between them. Bedtimes are signed offsets from their own morning, so 10 PM sorts before 1 AM without a wrap-around case.
Night by night: one bar per night on a fixed 6 PM → noon axis, so irregular bedtimes are visible as ragged left edges rather than hidden by per-row scaling. Amber means under target; a trailing ~ means at least one end was estimated and **est.** means the night was reconstructed from painted time. Duration is printed at the right.
What changed: compares the two halves of the range — change in sleep length, in bedtime, and in wake time, plus which end of the night moves around more and the shortest/longest nights. Needs at least two nights in each half or it says so instead of reading one bad night as a trend.`,
  },
  {
    file: "07-analytics-screentime.png",
    area: "Analytics → Screen Time",
    view: "Analytics tab → Time → Screen Time",
    sources: [
      "components/Analytics/enhanced-analytics.tsx",
      "components/Analytics/ScreenTimeView.tsx",
      "lib/screentime/prefs.ts",
      "lib/tracking-summary.ts",
    ],
    description: `${ANALYTICS_CHROME}
ActivityWatch-painted Screen Time for the shared range: active vs untracked (AFK is untracked), top apps / categories from the same pens as Home → Tracking, last-sync from Settings prefs, alignment vs human Activity occupancy. Empty: one sentence (nothing painted / connect ActivityWatch). Does not dual-write onto Activity.`,
  },
  {
    file: "07-analytics-plan-vs-reality.png",
    area: "Analytics → Plan vs Reality",
    view: "Analytics tab → Plan vs Reality",
    sources: ["components/Analytics/PlanVsReality.tsx"],
    description: `${ANALYTICS_CHROME}
Grain Day / Week / Month inside the shared Analytics window (not a second date range). Window ribbon of every period in the range (alignment height; hollow when nothing was planned). Planned vs actual as paired bars (not two lists). Thin sample watermarked. Intentions as one line of plan prose.`,
  },
  {
    file: "07-analytics-calibration.png",
    area: "Analytics → Calibration",
    view: "Analytics tab → Calibration",
    sources: ["components/Analytics/CalibrationView.tsx"],
    description: `${ANALYTICS_CHROME}
Sentence + n + caveat. Scatter / histogram / trend only when n clears the sample floor; otherwise a watermark. Open in Lists.`,
  },
  {
    file: "07-analytics-streaks.png",
    area: "Analytics → Streaks",
    view: "Analytics tab → Streaks",
    sources: ["components/Analytics/StreaksWidget.tsx"],
    description: `${ANALYTICS_CHROME}
Current + longest habit and daily-review streaks — not clipped to the Analytics window (Home glance vs Analytics analysis stay split on purpose).`,
  },
  {
    file: "07-analytics-reflection.png",
    area: "Analytics → Reflection",
    view: "Analytics tab → Reflection",
    sources: ["components/Analytics/enhanced-analytics.tsx", "components/Reviews/PostMortemDialog.tsx"],
    description: `${ANALYTICS_CHROME}
Window averages as one sentence (not 0.0 KPI cards). Reflect on completed tasks. Prompt history (notes + 1–10 scores).`,
  },
  {
    file: "07-analytics-reviews.png",
    area: "Analytics → Reviews",
    view: "Analytics tab → Reviews",
    sources: ["components/Analytics/enhanced-analytics.tsx", "lib/reviews-store.ts"],
    description: `${ANALYTICS_CHROME}
Expandable saved reviews (period · key): Summary / Gratitude / Plans; resolved vs pushed counts. Empty: use header Review.`,
  },
  {
    file: "07-analytics-metrics.png",
    area: "Analytics → Metrics",
    view: "Analytics tab → Metrics",
    sources: ["components/Analytics/MetricsTrends.tsx", "lib/metrics-store.ts"],
    description: `${ANALYTICS_CHROME}
Metric trend + picker for the shared window. **Log {name}** opens MetricLogger. n + direction + R² when there is a series; otherwise one sentence in the frame.`,
  },
  {
    file: "07-analytics-correlation.png",
    area: "Analytics → Correlation",
    view: "Analytics tab → Correlation",
    sources: ["components/Analytics/CorrelationExplorer.tsx"],
    description: `${ANALYTICS_CHROME}
Pairwise Pearson matrix of metrics plus habit % / tracking / sleep / points. Click a cell for scatter + sentence. Thin overlap watermarked. Not a chart builder.`,
  },
  {
    file: "07-analytics-spectrum.png",
    area: "Analytics → Spectrum",
    view: "Analytics tab → Meta → Spectrum",
    sources: ["components/Analytics/SpectrumView.tsx", "lib/metrics.ts"],
    description: `${ANALYTICS_CHROME}
Lag-1 / lag-7 autocorrelation of daily habit % and sleep duration, naive DFT periodogram of habit %, coefficient of variation of sleep. Phosphor traces. Not a forecast.`,
  },
  {
    file: "07-analytics-context-switch.png",
    area: "Analytics → Context Switch",
    view: "Analytics tab → Context Switch",
    sources: ["components/Analytics/ContextSwitchHeatmap.tsx"],
    description: `${ANALYTICS_CHROME}
Context switching (by day) for the shared window: n / avg / busiest / trend when the sample is thick enough. Legend: a switch is a pen change — one block ending and another beginning.`,
  },
  {
    file: "07-analytics-regret.png",
    area: "Analytics → Regret",
    view: "Analytics tab → Regret",
    sources: ["components/Analytics/RegretView.tsx", "lib/regret-store.ts"],
    description: `${ANALYTICS_CHROME}
One line: regret is the accrued cost of important items sitting undone past their due date. n days with accrued regret in the shared window; bars + heaviest + by reason when the sample is thick enough. Open heaviest in Lists.`,
  },
  {
    file: "07-analytics-overcommit.png",
    area: "Analytics → Overcommit",
    view: "Analytics tab → Behavior → Overcommit",
    sources: [
      "components/Analytics/OvercommitmentView.tsx",
      "lib/overcommitment.ts",
    ],
    description: `${ANALYTICS_CHROME}
One sentence + n on reconstructed day-pushes and logged minutes over the shared range. Thin windows are watermarked, not findings. Does not reschedule.`,
  },
  {
    file: "07-analytics-cross-section.png",
    area: "Analytics → Cross-section",
    view: "Analytics tab → Meta → Cross-section",
    sources: [
      "components/Analytics/CrossSection.tsx",
      "components/Analytics/cross-section.ts",
    ],
    description: `${ANALYTICS_CHROME}
Linked density small-multiples over the shared range: Habits, Tracking, Sleep, Completed, Points, Operations, Regret, Mood, Joy, Switches, Places, Goals. Hover/pin a day to highlight the same column in every series. Missing nights stay blank; n is on every row. Empty canvas: one sentence in the frame.`,
  },
  {
    file: "07-analytics-observatory.png",
    area: "Analytics → Observatory",
    view: "Analytics tab → Meta → Observatory",
    sources: ["components/Analytics/Observatory.tsx", "components/Analytics/observatory-findings.ts"],
    description: `${ANALYTICS_CHROME}
Classical Pearson findings over aligned series (habit %, tracking, sleep, points, joy, switches). Thin overlap is watermarked. Linked Cross-section beneath.`,
  },
  {
    file: "07-analytics-velocity.png",
    area: "Analytics → Velocity",
    view: "Analytics tab → Behavior → Velocity",
    sources: ["components/Analytics/VelocityView.tsx"],
    description: `${ANALYTICS_CHROME}
Completions and points per day, median cycle time, optional reward vs actual minutes. Display only.`,
  },
  {
    file: "07-analytics-circadian.png",
    area: "Analytics → Circadian",
    view: "Analytics tab → Time → Circadian",
    sources: ["components/Analytics/CircadianView.tsx", "components/Analytics/hour-day.ts"],
    description: `${ANALYTICS_CHROME}
Hour × day occupancy atlas. Instants stay off the heat. Missing hours are empty, not occupancy.`,
  },
  {
    file: "07-analytics-places.png",
    area: "Analytics → Places",
    view: "Analytics tab → Time → Places",
    sources: ["components/Analytics/PlacesView.tsx"],
    description: `${ANALYTICS_CHROME}
Location scope as a time-at-pen mosaic (country → park via displayDepth). Not a geo map.`,
  },
  {
    file: "07-analytics-mood-field.png",
    area: "Analytics → Mood field",
    view: "Analytics tab → Time → Mood field",
    sources: ["components/Analytics/MoodFieldView.tsx"],
    description: `${ANALYTICS_CHROME}
Spec §15 cognitive-state: painted Mood pens plus overlay of logged wellbeing metrics.`,
  },
  {
    file: "07-analytics-diversity.png",
    area: "Analytics → Diversity",
    view: "Analytics tab → Time → Diversity",
    sources: ["components/Analytics/DiversityView.tsx", "components/Analytics/signal-stats.ts", "lib/metrics.ts"],
    description: `${ANALYTICS_CHROME}
Shannon entropy of Tracking pens per day (H = −Σ p log₂ p), Gini of the window's pen totals, weekday vs weekend occupancy. Phosphor trace. Thin windows watermarked.`,
  },
  {
    file: "07-analytics-transitions.png",
    area: "Analytics → Transitions",
    view: "Analytics tab → Time → Transitions",
    sources: ["components/Analytics/TransitionsView.tsx", "components/Analytics/signal-stats.ts"],
    description: `${ANALYTICS_CHROME}
Markov matrix of Tracking pen changes. P(to | from) among switches only; same-pen continuation omitted. Rows sum to 1.`,
  },
  {
    file: "07-analytics-operations.png",
    area: "Analytics → Operations",
    view: "Analytics tab → Time → Operations",
    sources: ["components/Analytics/OperationsAnalytics.tsx", "lib/operations.ts"],
    description: `${ANALYTICS_CHROME}
Operation stage/category mosaic and work vs neglect heatmap from timeLogs. Does not restyle the Operations module.`,
  },
  {
    file: "07-analytics-cycle.png",
    area: "Analytics → Cycle",
    view: "Analytics tab → Accuracy → Cycle",
    sources: ["components/Analytics/CycleView.tsx"],
    description: `${ANALYTICS_CHROME}
daysPushed distribution, open important items, estimate confirmation rate.`,
  },
  {
    file: "07-analytics-goals.png",
    area: "Analytics → Goals",
    view: "Analytics tab → Accuracy → Goals",
    sources: ["components/Analytics/GoalsAnalytics.tsx"],
    description: `${ANALYTICS_CHROME}
Goal progress, neglected goals, contributing completions in the window. Open those items in Lists.`,
  },
  {
    file: "07-analytics-lists-areas.png",
    area: "Analytics → Lists & areas",
    view: "Analytics tab → Library → Lists & areas",
    sources: ["components/Analytics/ListsAreasView.tsx"],
    description: `${ANALYTICS_CHROME}
Category performance. Default **Size by items** (area ∝ count). Completion rate is a toggle. Click a tile to open the list.`,
  },
  {
    file: "07-analytics-attributes.png",
    area: "Analytics → Attributes",
    view: "Analytics tab → Library → Attributes",
    sources: ["components/Analytics/AttributesView.tsx"],
    description: `${ANALYTICS_CHROME}
Fixed histograms of typed attributes (including catalog fields). Not a custom chart builder.`,
  },
  {
    file: "07-analytics-item-types.png",
    area: "Analytics → Item Types",
    view: "Analytics tab → Library → Item Types",
    sources: [
      "components/Analytics/ItemTypesLibrary.tsx",
      "components/ItemTypes/ItemTypeEditor.tsx",
    ],
    description: `${ANALYTICS_CHROME}
Item Types library: mosaic of types by item count, sortable list (name / count / kind), system/catalog/user filter, drill into items and Open in Lists. Settings still edits schemas. Edit type opens the existing editor.`,
  },
  {
    file: "07-analytics-tags.png",
    area: "Analytics → Tags",
    view: "Analytics tab → Library → Tags",
    sources: ["components/Analytics/LibraryCuts.tsx"],
    description: `${ANALYTICS_CHROME}
Free-form item tags as a treemap (area ∝ count). Click a tile to open those items.`,
  },
  {
    file: "07-analytics-stages.png",
    area: "Analytics → Stages",
    view: "Analytics tab → Library → Stages",
    sources: ["components/Analytics/LibraryCuts.tsx"],
    description: `${ANALYTICS_CHROME}
Task.stage buckets (inbox / clarified / scheduled / completed / list). Area ∝ count.`,
  },
  {
    file: "07-analytics-weight.png",
    area: "Analytics → Weight",
    view: "Analytics tab → Library → Weight",
    sources: ["components/Analytics/LibraryCuts.tsx"],
    description: `${ANALYTICS_CHROME}
Importance, cognitive load, and entropy already on items. Missing stays missing.`,
  },

  // ── Global dialogs & detail ─────────────────────────────────────────────────
  {
    file: "20-dialog-reviews.png",
    area: "Review dialog",
    view: "Header → Review → day review dialog",
    sources: ["components/Reviews/reviews.tsx", "components/Reviews/AssumedTimesSection.tsx", "components/Reviews/DayReviewTomorrowSection.tsx"],
    description: `Day Review. Unfinished scheduled items: Done / Push / Reflect / Why blocked? Assumed times (Looks right, Finished, Took, Confirm all as-is). Summary. Gratitude (+ Add). Your period plan. Reflection: What went well? / better? / learned? Day only: Tomorrow's plan + to-do search/New/tier/Add. Cancel / Save Review. PNG may omit Assumed times.`,
  },
  {
    file: "20-dialog-morning-review.png",
    area: "Morning review dialog",
    view: "Header → Morning dialog",
    sources: [
      "components/Reviews/MorningReview.tsx",
      "components/Reviews/AffirmationsDialog.tsx",
      "lib/sleep-store.ts",
      "lib/sleep-inference.ts",
    ],
    description: `Morning Review. Fell asleep / Wake time — a view onto the sleep log rather than a second copy, so saving paints the night on the Sleep pen, logs it in Done and feeds sleep habits; a blank field opens pre-filled from sleep painted on the grid. A line below reports the night's length. Dream journal. Intentions (+ Add). Affirmations (+ Add) + Affirmations spoken dialog (Start / meters / Next / Finish). Consciously postpone checkboxes. Cancel / Save Morning Review.`,
  },
  {
    file: "20-dialog-settings.png",
    area: "Settings dialog",
    view: "Header → Settings",
    sources: [
      "components/Settings/SettingsDialog.tsx",
      "components/Settings/HomeLocationField.tsx",
      "components/Settings/DayAnchorField.tsx",
      "components/Settings/BackupRestore.tsx",
      "components/Settings/MessageIngestPanel.tsx",
      "components/Settings/ScreenTimePanel.tsx",
    ],
    description: `Settings. Home location (City). Default time of day: what is assumed when work is ticked off after the day has ended and there is no tracked time to read a real finish from. Once a few nights are logged this reports that the sleep log is answering it instead — your usual bedtime, less half an hour — and the Assumed finish time field below it is the fallback for days with no sleep data at all. Full App Backup: Export Full Backup / Restore From Backup. Phone↔Desktop Live Sync: Check hub / Force push now / Force pull now. Message ingest: enable, Telegram token (desktop), pairing code, cheat-sheet, simulate a phrase. **Screen Time**: ActivityWatch URL, connection lamp, lookback, Sync now. Item Types → Manage Item Types. Second Brain seed. PNG may need scroll.`,
  },
  {
    file: "20-dialog-inbox.png",
    area: "Inbox dialog",
    view: "Header → Inbox",
    sources: ["components/inbox.tsx"],
    description: `Inbox — Clarify Your Ideas. Per capture: title, added time, chips, Clarify, Delete. Clarify All Ideas. Clarify Idea form: description, duration, reward, urgency/importance, Lists, attributes, Save & Clarify.`,
  },
  {
    file: "20-dialog-bulk-add.png",
    area: "Bulk Add dialog",
    view: "Header → Bulk Add",
    sources: ["components/enhanced-bulk-add.tsx", "lib/smart-parse.ts", "lib/capture-target.ts"],
    description: `Bulk Add Tasks with Lists. Multi-line textarea (one item/line; headers list: or folder: list:). Send to Inbox checkbox. Shorthand & where items go. Ready count. Add Tasks. ×.`,
  },
  {
    file: "20-dialog-quick-add.png",
    area: "Quick Add dialog",
    view: "Header → Quick Add",
    sources: ["components/quick-add.tsx", "lib/smart-parse.ts", "lib/capture-target.ts"],
    description: `Add Idea. Single-line Idea (colon paths folder: list: item). Send to Inbox checkbox. Shorthand help. Live destination chips. Add to Inbox (or Add if skip Inbox). ×.`,
  },
  {
    file: "20-dialog-global-search.png",
    area: "Global search",
    view: "Cmd/Ctrl+K search palette",
    sources: ["components/Search/GlobalSearch.tsx", "lib/search.ts"],
    description: `Search folders, lists, tasks, tags, notes…. Advanced: Folders / Lists / Items, Title only, Include hidden items. Ranked results (item/list/folder). ↑↓ navigate · ↵ open · esc close.`,
  },
  {
    file: "20-dialog-time-tracking.png",
    area: "Time Tracking dialog",
    view: "Header → Tracking",
    sources: ["components/cognitive-state.tsx", "components/Home/Tracking/time-grid.tsx"],
    description: `Time Tracking dialog — same stack as Home Time Grid: Working now (if ops); pen tray; view-mode bar (Activity / Location / Mood / Company / Screen Time / iPhone Screen Time / iPhone Calls / iPhone Texts / …); TIME/DIV + Cell + Fill; grid; Untracked.`,
  },
  {
    file: "20-dialog-metrics.png",
    area: "Metrics dialog",
    view: "Header → Metrics",
    sources: ["components/Tracking/MetricLogger.tsx", "lib/metrics-store.ts"],
    description: `Wellbeing metrics. Log a datapoint: Joy / Suffering / Alignment / Self satisfaction / Situational satisfaction (/100 + color). When, Context, Details. Log datapoint. Recent datapoints (+ delete).`,
  },
  {
    file: "21-item-detail-popup.png",
    area: "Item detail popup",
    view: "Item detail popup (from Lists)",
    sources: [
      "components/ItemDetail/ItemDetailPopup.tsx",
      "components/ItemDetail/useItemDetailDraft.ts",
      "components/ItemDetail/ItemAttributesSection.tsx",
    ],
    description: `Item detail. Title. Delete / Complete / Save Changes. Tabs: Details / Scheduling / Dependencies / Subtasks / Analysis / Time / Body. Details: description, duration, reward, urgency/importance, Show in Scheduler, repeat, Type, Lists (+ New list), Tags, Related, Attributes, Completion status (Active/Partial/Deferred/Cancelled/Done). Scheduling: dates, deadline, constraints. Deps, subtasks, why/if-not notes, estimated vs actual logs, body.`,
  },
]

export const COVERAGE_AREAS = [
  { area: "App shell & global header", shots: ["20-dialog-*", "Global chrome visible in all full-page shots"] },
  { area: "Home → Habits", shots: ["01-home-daily-habits.png", "01-home-habits-weekly.png", "01-home-habits-monthly.png"] },
  { area: "Home → Plan", shots: ["02-home-plan.png", "02-home-plan-week.png", "02-home-plan-day.png"] },
  { area: "Home → To Do", shots: ["03-home-todo.png", "03-home-todo-week.png", "03-home-todo-month.png"] },
  { area: "Home → Goals", shots: ["04-home-goals.png"] },
  {
    area: "Home → Tracking",
    shots: [
      "08-home-tracking.png",
      "08-home-tracking-week.png",
      "08-home-tracking-activity.png",
      "08-home-tracking-daylog.png",
    ],
  },
  { area: "Lists folder views", shots: ["05-lists.png", "05-lists-list.png", "05-lists-details.png", "05-lists-cards.png"] },
  { area: "Lists content displays", shots: ["05-lists-content-*.png"] },
  { area: "Scheduler", shots: ["06-scheduler.png", "06-scheduler-day.png", "06-scheduler-gantt.png", "06-scheduler-dependencies.png"] },
  { area: "Operations", shots: ["10-operations.png", "10-operations-workspace.png"] },
  { area: "Modules", shots: ["09-modules.png", "09-modules-workspace.png"] },
  { area: "Analytics (all tabs)", shots: ["07-analytics*.png"] },
  { area: "Item detail popup", shots: ["21-item-detail-popup.png"] },
]
