/**
 * Metadata for docs/screenshots/*.png — used by capture-screenshots.mjs and
 * generate-screenshot-docs.mjs.
 */
export const GLOBAL_HEADER = `
The COGS title and global action bar appear on every screen (app/page.tsx):
  Review (+ pending badge) | Morning | Settings | Tracking | Inbox | Metrics |
  Bulk Add | Quick Add
Global shortcuts: Cmd/Ctrl+K → search palette; quick-capture hotkey → Quick Add.
Top-level tabs (7): Home | Lists | Scheduler | Operations | Modules | Graph | Analytics
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
      "components/Home/points-stats.tsx",
      "components/Home/daily-progress-quickview.tsx",
      "components/Home/NeedsAttention.tsx",
      "lib/habits-store.ts",
    ],
    description: `Week navigation, frequency tabs (Daily/Weekly/Monthly), hide-completed toggle, Settings, and the spreadsheet habit grid (boolean/time/count/incremental/text types). Points stats and Today's Progress cards sit above the sub-tabs; Needs Attention surfaces stale or blocked items.`,
  },
  {
    file: "01-home-habits-weekly.png",
    area: "Home → Habits → Weekly",
    view: "Home tab → Habits → Weekly frequency",
    sources: ["components/Home/Habits/habit-tracker.tsx", "components/Home/Habits/period-habit-list.tsx"],
    description: `Weekly habits render as period cards (PeriodHabitList) instead of the day grid. Same store as Lists → Daily/Weekly/Monthly Habits smart lists.`,
  },
  {
    file: "01-home-habits-monthly.png",
    area: "Home → Habits → Monthly",
    view: "Home tab → Habits → Monthly frequency",
    sources: ["components/Home/Habits/habit-tracker.tsx", "components/Home/Habits/period-habit-list.tsx"],
    description: `Monthly habit cards for longer-cycle routines. Completion feeds Analytics → Habits heatmap and points.`,
  },
  {
    file: "02-home-plan.png",
    area: "Home → Plan → Month",
    view: "Home tab → Plan sub-tab → Month View",
    sources: [
      "components/Home/Plan/plan-panel.tsx",
      "components/Home/Plan/month-view.tsx",
      "components/Home/Plan/event-dialog.tsx",
      "lib/event-store.ts",
    ],
    description: `Calendar month grid with scheduled tasks and calendar events. Toolbar: Add Event, Settings (import/export events). Click cells to create events; drag tasks from the planned-tasks sidebar.`,
  },
  {
    file: "02-home-plan-week.png",
    area: "Home → Plan → Week",
    view: "Home tab → Plan → Week View",
    sources: ["components/Home/Plan/week-view.tsx", "components/Home/Plan/planned-tasks-sidebar.tsx"],
    description: `Seven-day agenda columns with hour bands. Planned-tasks sidebar lists unscheduled items for drag-in scheduling.`,
  },
  {
    file: "02-home-plan-day.png",
    area: "Home → Plan → Day",
    view: "Home tab → Plan → Day View",
    sources: ["components/Home/Plan/day-view.tsx", "components/Home/Plan/agenda-grid.tsx"],
    description: `Single-day timeline with events and scheduled tasks. Supports click-to-create and inline task open (detail popup).`,
  },
  {
    file: "03-home-todo.png",
    area: "Home → To Do → Day",
    view: "Home tab → To Do sub-tab → Day period",
    sources: [
      "components/Home/ToDo/todo-panel.tsx",
      "components/Home/ToDo/TodoTable.tsx",
      "components/Home/ToDo/todo-utils.ts",
      "components/Focus/JustStartMode.tsx",
    ],
    description: `Tier-grouped to-do table (A+…D) for the focused day. Priority weights panel, status filters, Just Start focus mode, Add Task dialog, and done section.`,
  },
  {
    file: "03-home-todo-week.png",
    area: "Home → To Do → Week",
    view: "Home tab → To Do → Week period",
    sources: ["components/Home/ToDo/todo-panel.tsx", "components/Home/ToDo/TodoPeriodNav.tsx"],
    description: `Week-scoped to-dos with period navigation. Same priority formula and completion flow as the day view.`,
  },
  {
    file: "03-home-todo-month.png",
    area: "Home → To Do → Month",
    view: "Home tab → To Do → Month period",
    sources: ["components/Home/ToDo/todo-panel.tsx"],
    description: `Month-scoped open and done tasks. Useful for longer-horizon planning reviews.`,
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
    description: `Objectives, key results, and direction report for the active month/quarter. Objective detail dialog for editing targets and linking items.`,
  },
  {
    file: "08-home-tracking.png",
    area: "Home → Tracking → Time Grid",
    view: "Home tab → Tracking → Time Grid",
    sources: [
      "components/Home/Tracking/time-grid.tsx",
      "components/cognitive-state.tsx",
      "lib/time-tracking-store.ts",
    ],
    description: `Scope pens (Activity, Location, Mood, …) and 15-minute slot grid for logging how time was spent. Same grid opens from header Tracking dialog.`,
  },
  {
    file: "08-home-tracking-daylog.png",
    area: "Home → Tracking → Day Log",
    view: "Home tab → Tracking → Day Log",
    sources: ["components/Home/Tracking/actual-day-view.tsx"],
    description: `Chronological day log derived from time-grid entries — readable narrative of the day's tracked blocks.`,
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
    description: `Win95-style file manager: sidebar (Home, All, Next Actions, Scheduled folders), toolbar, search, orb icons on velvet desktop. Double-click opens a list.`,
  },
  {
    file: "05-lists-list.png",
    area: "Lists → Home → List",
    view: "Lists tab → Home → List folder view",
    sources: ["components/Lists/views/FolderViewList.tsx"],
    description: `Compact list rows with metadata columns for folders and lists at the current location.`,
  },
  {
    file: "05-lists-details.png",
    area: "Lists → Home → Details",
    view: "Lists tab → Home → Details folder view",
    sources: ["components/Lists/views/FolderViewDetails.tsx"],
    description: `Wide details columns (description, counts, dates) for every entry in the folder.`,
  },
  {
    file: "05-lists-cards.png",
    area: "Lists → Home → Cards",
    view: "Lists tab → Home → Cards folder view",
    sources: ["components/Lists/views/FolderViewCards.tsx"],
    description: `Card grid layout for browsing lists and subfolders visually.`,
  },
  {
    file: "05-lists-content-default.png",
    area: "Lists → list → Default",
    view: "Lists tab → Example List → Default display",
    sources: ["components/Lists/list-content/ListContentDefault.tsx", "components/Lists/list-content/ListContentPanel.tsx"],
    description: `Default list table: title, attributes, scheduling chips, complete/edit actions. Attribute schema from list settings.`,
  },
  {
    file: "05-lists-content-checklist.png",
    area: "Lists → list → Checklist",
    view: "Lists tab → Example List → Checklist display",
    sources: ["components/Lists/list-content/ListContentChecklist.tsx"],
    description: `Checkbox-first checklist mode for quick completion workflows.`,
  },
  {
    file: "05-lists-content-kanban.png",
    area: "Lists → list → Kanban",
    view: "Lists tab → Example List → Kanban display",
    sources: ["components/Lists/list-content/ListContentKanban.tsx", "components/Lists/list-content/kanban-utils.ts"],
    description: `Kanban board grouped by a status/select attribute; drag cards between columns.`,
  },
  {
    file: "05-lists-content-spreadsheet.png",
    area: "Lists → list → Spreadsheet",
    view: "Lists tab → Example List → Spreadsheet display",
    sources: ["components/Lists/list-content/ListContentSpreadsheet.tsx"],
    description: `Editable spreadsheet grid over list items and custom attributes; supports pop-out window (#popout/sheet/…).`,
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
    description: `Scheduler inbox of scheduleable tasks, category filters, sort controls, and overview boxes. Drag tasks into period buckets to refine scheduling.`,
  },
  {
    file: "06-scheduler-day.png",
    area: "Scheduler → Day",
    view: "Scheduler tab → Funnel → Day period",
    sources: ["components/Scheduler/DayTab.tsx", "components/Scheduler/DayAgenda.tsx"],
    description: `Day funnel with 24-hour agenda for time-level scheduling. Today navigation in header.`,
  },
  {
    file: "06-scheduler-gantt.png",
    area: "Scheduler → Gantt",
    view: "Scheduler tab → Gantt view",
    sources: ["components/Scheduler/GanttView.tsx"],
    description: `Gantt timeline of scheduled tasks with dependencies and duration bars (plan-vs-reality input).`,
  },
  {
    file: "06-scheduler-dependencies.png",
    area: "Scheduler → Dependencies",
    view: "Scheduler tab → Dependencies graph",
    sources: ["components/Scheduler/DependencyGraph.tsx"],
    description: `Dependency DAG across tasks — see blockers before scheduling downstream work.`,
  },

  // ── Operations ────────────────────────────────────────────────────────────
  {
    file: "10-operations.png",
    area: "Operations list",
    view: "Operations tab → list landing",
    sources: ["components/Operations/OperationsView.tsx", "components/Operations/operation-actions.ts"],
    description: `All operation-typed items with stage badges. Inline create field spins up a new directed enterprise.`,
  },
  {
    file: "10-operations-workspace.png",
    area: "Operations workspace",
    view: "Operations tab → Operation workspace",
    sources: [
      "components/Operations/OperationWorkspace.tsx",
      "components/Operations/OperationHome.tsx",
      "components/Operations/PhasesPanel.tsx",
      "components/Operations/ResourcesPanel.tsx",
      "components/Operations/ToDoNextRail.tsx",
    ],
    description: `Mini-app for one operation: Home / Phases / Resources / Log tabs plus persistent To-do-next rail, rename, stage badge, post-mortem.`,
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
    description: `Workspaces (full mini-apps) and widgets (single dashboard cards). Build module opens template chooser.`,
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
    description: `Full-screen workspace composed of bound views (spreadsheet, agenda, summary, …), workflow editor, settings, and pop-out window support.`,
  },

  // ── Graph ─────────────────────────────────────────────────────────────────
  {
    file: "11-graph.png",
    area: "Knowledge Graph",
    view: "Graph tab",
    sources: ["components/Graph/KnowledgeGraph.tsx", "components/Graph/LinkGraph.tsx", "lib/graph-layout.ts"],
    description: `Force-directed graph of all items and typed links (stance-colored edges). Click nodes to open item detail popup.`,
  },

  // ── Analytics ─────────────────────────────────────────────────────────────
  {
    file: "07-analytics.png",
    area: "Analytics → Habits",
    view: "Analytics tab → Habits",
    sources: ["components/Analytics/enhanced-analytics.tsx"],
    description: `GitHub-style habit completion heatmap and per-habit completion rates.`,
  },
  {
    file: "07-analytics-points.png",
    area: "Analytics → Points",
    view: "Analytics tab → Points",
    sources: ["components/Analytics/enhanced-analytics.tsx", "lib/points-store.ts"],
    description: `Cumulative and daily points charts plus top point-earning tasks.`,
  },
  {
    file: "07-analytics-tracking.png",
    area: "Analytics → Tracking",
    view: "Analytics tab → Tracking",
    sources: ["components/Analytics/enhanced-analytics.tsx", "lib/time-tracking-store.ts"],
    description: `Time distribution pie/bar charts from Time Grid scopes.`,
  },
  {
    file: "07-analytics-plan-vs-reality.png",
    area: "Analytics → Plan vs Reality",
    view: "Analytics tab → Plan vs Reality",
    sources: ["components/Analytics/PlanVsReality.tsx"],
    description: `Compare planned schedule vs actual time logs and completions.`,
  },
  {
    file: "07-analytics-calibration.png",
    area: "Analytics → Calibration",
    view: "Analytics tab → Calibration",
    sources: ["components/Analytics/CalibrationView.tsx"],
    description: `Estimate vs actual duration calibration curves to improve planning.`,
  },
  {
    file: "07-analytics-streaks.png",
    area: "Analytics → Streaks",
    view: "Analytics tab → Streaks",
    sources: ["components/Analytics/StreaksWidget.tsx"],
    description: `Habit and completion streak counters with milestone highlights.`,
  },
  {
    file: "07-analytics-reflection.png",
    area: "Analytics → Reflection",
    view: "Analytics tab → Reflection",
    sources: ["components/Analytics/enhanced-analytics.tsx", "components/Reviews/PostMortemDialog.tsx"],
    description: `Browse completion reflections and launch post-mortem on selected tasks.`,
  },
  {
    file: "07-analytics-reviews.png",
    area: "Analytics → Reviews",
    view: "Analytics tab → Reviews",
    sources: ["components/Analytics/enhanced-analytics.tsx", "lib/reviews-store.ts"],
    description: `Archive of saved end-of-period reviews with gratitude, plans, and carry-over stats.`,
  },
  {
    file: "07-analytics-metrics.png",
    area: "Analytics → Metrics",
    view: "Analytics tab → Metrics",
    sources: ["components/Analytics/MetricsTrends.tsx", "lib/metrics-store.ts"],
    description: `Self-tracking metric trends (joy, alignment, satisfaction, …) over time.`,
  },
  {
    file: "07-analytics-correlation.png",
    area: "Analytics → Correlation",
    view: "Analytics tab → Correlation",
    sources: ["components/Analytics/CorrelationExplorer.tsx"],
    description: `Explore correlations between logged metrics and outcomes.`,
  },
  {
    file: "07-analytics-context-switch.png",
    area: "Analytics → Context Switch",
    view: "Analytics tab → Context Switch",
    sources: ["components/Analytics/ContextSwitchHeatmap.tsx"],
    description: `Heatmap of context-switching patterns from time-grid activity changes.`,
  },
  {
    file: "07-analytics-regret.png",
    area: "Analytics → Regret",
    view: "Analytics tab → Regret",
    sources: ["components/Analytics/RegretView.tsx", "lib/regret-store.ts"],
    description: `Regret ledger fed by reviews — tasks consciously skipped or blocked.`,
  },
  {
    file: "07-analytics-item-types.png",
    area: "Analytics → Item Types",
    view: "Analytics tab → Item Types",
    sources: ["components/ItemTypes/ItemTypesPanel.tsx", "lib/item-type-store.ts"],
    description: `Compact item-type manager (types, attributes, completion tiers) embedded in Analytics.`,
  },

  // ── Global dialogs & detail ─────────────────────────────────────────────────
  {
    file: "20-dialog-reviews.png",
    area: "Review dialog",
    view: "Header → Review → day review dialog",
    sources: ["components/Reviews/reviews.tsx", "components/Reviews/DayReviewTomorrowSection.tsx"],
    description: `End-of-period review: carry-over unfinished tasks, gratitude, reflection questions, plan text, tomorrow section.`,
  },
  {
    file: "20-dialog-morning-review.png",
    area: "Morning review dialog",
    view: "Header → Morning dialog",
    sources: ["components/Reviews/MorningReview.tsx", "components/Reviews/AffirmationsDialog.tsx"],
    description: `Start-of-day ritual: wake time, dream, intentions, affirmations, conscious postponements.`,
  },
  {
    file: "20-dialog-settings.png",
    area: "Settings dialog",
    view: "Header → Settings",
    sources: ["components/Settings/SettingsDialog.tsx", "components/Settings/BackupRestore.tsx"],
    description: `JSON backup/restore, Second Brain type seeding, and link to Item Types manager.`,
  },
  {
    file: "20-dialog-inbox.png",
    area: "Inbox dialog",
    view: "Header → Inbox",
    sources: ["components/inbox.tsx"],
    description: `Unclarified captures with Clarify / Delete, smart-parse chips, and Clarify All.`,
  },
  {
    file: "20-dialog-bulk-add.png",
    area: "Bulk Add dialog",
    view: "Header → Bulk Add",
    sources: ["components/enhanced-bulk-add.tsx"],
    description: `Multi-line capture; Category: headers route lines into lists.`,
  },
  {
    file: "20-dialog-quick-add.png",
    area: "Quick Add dialog",
    view: "Header → Quick Add",
    sources: ["components/quick-add.tsx", "lib/smart-parse.ts"],
    description: `Single-line smart capture with live parse chips (date, time, list, priority).`,
  },
  {
    file: "20-dialog-global-search.png",
    area: "Global search",
    view: "Cmd/Ctrl+K search palette",
    sources: ["components/Search/GlobalSearch.tsx", "lib/search.ts"],
    description: `Ranked search across items, lists, and folders with advanced filters.`,
  },
  {
    file: "20-dialog-time-tracking.png",
    area: "Time Tracking dialog",
    view: "Header → Tracking",
    sources: ["components/cognitive-state.tsx", "components/Home/Tracking/time-grid.tsx"],
    description: `Compact Time Grid dialog for quick logging without leaving the current tab.`,
  },
  {
    file: "20-dialog-metrics.png",
    area: "Metrics dialog",
    view: "Header → Metrics",
    sources: ["components/Tracking/MetricLogger.tsx", "lib/metrics-store.ts"],
    description: `Log wellbeing datapoints (joy, alignment, satisfaction, …) with color pickers and history.`,
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
    description: `Compact modal editor: details, scheduling, dependencies, subtasks, links/tags, body, attributes, link graph, completion.`,
  },
]

export const COVERAGE_AREAS = [
  { area: "App shell & global header", shots: ["20-dialog-*", "Global chrome visible in all full-page shots"] },
  { area: "Home → Habits", shots: ["01-home-daily-habits.png", "01-home-habits-weekly.png", "01-home-habits-monthly.png"] },
  { area: "Home → Plan", shots: ["02-home-plan.png", "02-home-plan-week.png", "02-home-plan-day.png"] },
  { area: "Home → To Do", shots: ["03-home-todo.png", "03-home-todo-week.png", "03-home-todo-month.png"] },
  { area: "Home → Goals", shots: ["04-home-goals.png"] },
  { area: "Home → Tracking", shots: ["08-home-tracking.png", "08-home-tracking-daylog.png"] },
  { area: "Lists folder views", shots: ["05-lists.png", "05-lists-list.png", "05-lists-details.png", "05-lists-cards.png"] },
  { area: "Lists content displays", shots: ["05-lists-content-*.png"] },
  { area: "Scheduler", shots: ["06-scheduler.png", "06-scheduler-day.png", "06-scheduler-gantt.png", "06-scheduler-dependencies.png"] },
  { area: "Operations", shots: ["10-operations.png", "10-operations-workspace.png"] },
  { area: "Modules", shots: ["09-modules.png", "09-modules-workspace.png"] },
  { area: "Knowledge Graph", shots: ["11-graph.png"] },
  { area: "Analytics (all tabs)", shots: ["07-analytics*.png"] },
  { area: "Item detail popup", shots: ["21-item-detail-popup.png"] },
]
