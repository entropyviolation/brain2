import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

/** First-wave named roots must point at a living README, not a parallel blurb. */
const STAMPS: [string, string, string][] = [
  ["components/AppHeader.tsx", 'data-ui-name="App header"', 'data-ui-docs="components/README.md"'],
  ["components/AppHeader.tsx", 'data-ui-name="Capture"', 'data-ui-docs="components/README.md"'],
  ["components/baby-animal-nest.tsx", 'data-ui-name="Today\'s friend"', 'data-ui-docs="docs/FRIEND_COMPANION.md"'],
  ["components/Home/home-overview.tsx", 'data-ui-name="Home overview"', 'data-ui-docs="components/Home/README.md"'],
  ["components/Home/NeedsAttention.tsx", 'data-ui-name="Needs Attention"', 'data-ui-docs="components/Home/README.md"'],
  ["components/Home/Habits/habit-tracker.tsx", 'data-ui-name="Habits"', 'data-ui-docs="components/Home/Habits/README.md"'],
  [
    "components/Home/Habits/habits-control-panel.tsx",
    'data-ui-name="Habits control panel"',
    'data-ui-docs="components/Home/Habits/README.md"',
  ],
  ["components/Home/Habits/willpower-gems.tsx", 'data-ui-name="Willpower gems"', 'data-ui-docs="components/Home/Habits/README.md"'],
  ["components/Home/Plan/plan-panel.tsx", 'data-ui-name="Plan"', 'data-ui-docs="components/Home/Plan/README.md"'],
  ["components/Home/Plan/plan-text-log.tsx", 'name: "Month Plan"', "components/Home/Plan/README.md"],
  ["components/Home/Plan/plan-text-log.tsx", 'name: "Plan log"', "components/Home/Plan/README.md"],
  ["components/Home/Plan/plan-text-log.tsx", 'name: "Plan bulk"', "components/Home/Plan/README.md"],
  ["components/Home/Plan/month-view.tsx", 'data-ui-name="Month calendar"', 'data-ui-docs="components/Home/Plan/README.md"'],
  ["components/Home/Plan/week-view.tsx", 'data-ui-name="Week calendar"', 'data-ui-docs="components/Home/Plan/README.md"'],
  ["components/Home/Plan/day-view.tsx", 'data-ui-name="Day schedule"', 'data-ui-docs="components/Home/Plan/README.md"'],
  ["components/Home/Plan/planned-tasks-sidebar.tsx", 'data-ui-name="Planned tasks"', 'data-ui-docs="components/Home/Plan/README.md"'],
  ["components/Home/ToDo/todo-panel.tsx", 'data-ui-name="To Do"', 'data-ui-docs="components/Home/ToDo/README.md"'],
  ["components/Home/Goals/goals-tracker.tsx", 'data-ui-name="Goals"', 'data-ui-docs="components/Home/Goals/README.md"'],
  ["components/Home/home-dashboard.tsx", 'data-ui-name="Home tabs"', 'data-ui-docs="components/Home/README.md"'],
  ["components/Home/home-dashboard.tsx", 'data-ui-name="Tracking"', 'data-ui-docs="components/Home/Tracking/README.md"'],
  [
    "components/Home/Tracking/pen-palette.tsx",
    'data-ui-name="Tracking control panel"',
    'data-ui-docs="components/Home/Tracking/README.md"',
  ],
  ["components/Home/Tracking/tracking-tools-tray.tsx", 'data-ui-name="Paint tools"', 'data-ui-docs="components/Home/Tracking/README.md"'],
  ["components/Home/Tracking/tracking-tools-tray.tsx", 'data-ui-name="View latches"', 'data-ui-docs="components/Home/Tracking/README.md"'],
  ["components/Home/Tracking/time-grid.tsx", 'data-ui-name="Time grid"', 'data-ui-docs="components/Home/Tracking/README.md"'],
  ["components/Analytics/enhanced-analytics.tsx", 'data-ui-name="Analytics"', 'data-ui-docs="components/Analytics/README.md"'],
  ["components/Analytics/AnalyticsNav.tsx", 'data-ui-name="Analytics index"', 'data-ui-docs="components/Analytics/README.md"'],
  ["components/Analytics/Observatory.tsx", 'data-ui-name="Observatory"', 'data-ui-docs="components/Analytics/README.md"'],
  ["components/Analytics/CrossSection.tsx", 'data-ui-name="Cross-section"', 'data-ui-docs="components/Analytics/README.md"'],
  ["components/Lists/enhanced-list-view.tsx", 'data-ui-name="Lists"', 'data-ui-docs="components/Lists/README.md"'],
  ["components/Settings/SettingsDialog.tsx", 'data-ui-name="Settings"', 'data-ui-docs="components/Settings/README.md"'],
  ["components/Docs/DocsPanel.tsx", 'data-ui-name="Docs"', 'data-ui-docs="components/Docs/README.md"'],
  ["components/Completion/CompletionDialog.tsx", 'data-ui-name="Completion"', 'data-ui-docs="components/Completion/README.md"'],
  ["app/page.tsx", 'data-ui-name="App tabs"', 'data-ui-docs="components/README.md"'],
  ["components/ItemDetail/ItemDetailPopup.tsx", 'data-ui-name="Item detail"', 'data-ui-docs="components/ItemDetail/README.md"'],
  ["components/ItemDetail/ItemDetailPage.tsx", 'data-ui-name="Item detail"', 'data-ui-docs="components/ItemDetail/README.md"'],
  ["components/Lists/dialogs/EditListDialog.tsx", 'data-ui-name="List settings"', 'data-ui-docs="components/Lists/README.md"'],
  ["components/Lists/settings-dialog.tsx", 'data-ui-name="Lists settings"', 'data-ui-docs="components/Lists/README.md"'],
  ["components/Lists/dialogs/EditFolderDialog.tsx", 'data-ui-name="Folder settings"', 'data-ui-docs="components/Lists/README.md"'],
  ["components/Lists/dialogs/NewListDialog.tsx", 'data-ui-name="New list"', 'data-ui-docs="components/Lists/README.md"'],
  ["components/Lists/dialogs/NewFolderDialog.tsx", 'data-ui-name="New folder"', 'data-ui-docs="components/Lists/README.md"'],
  ["components/Lists/enhanced-list-view.tsx", 'data-ui-name="List inspector"', 'data-ui-docs="components/Lists/README.md"'],
  ["components/Lists/list-content/SheetFullscreen.tsx", 'data-ui-name="Sheet fullscreen"', 'data-ui-docs="components/Lists/README.md"'],
  ["components/Search/GlobalSearch.tsx", 'data-ui-name="Search"', 'data-ui-docs="components/Search/README.md"'],
  ["components/Reviews/reviews.tsx", 'data-ui-name="Period review"', 'data-ui-docs="components/Reviews/README.md"'],
  ["components/Reviews/MorningReview.tsx", 'data-ui-name="Morning review"', 'data-ui-docs="components/Reviews/README.md"'],
  ["components/inbox.tsx", 'data-ui-name="Inbox"', 'data-ui-docs="components/README.md"'],
  ["components/enhanced-bulk-add.tsx", 'data-ui-name="Bulk Add"', 'data-ui-docs="components/README.md"'],
  ["components/quick-add.tsx", 'data-ui-name="Quick Add"', 'data-ui-docs="components/README.md"'],
  ["components/notes-ingest.tsx", 'data-ui-name="From Notes"', 'data-ui-docs="components/README.md"'],
  ["components/ingest-log-dialog.tsx", 'data-ui-name="Ingest"', 'data-ui-docs="components/README.md"'],
  ["components/Tracking/MetricLogger.tsx", 'data-ui-name="Metrics"', 'data-ui-docs="components/README.md"'],
  ["components/Home/Plan/event-dialog.tsx", 'data-ui-name="Plan event"', 'data-ui-docs="components/Home/Plan/README.md"'],
  ["components/Home/Tracking/entry-dialog.tsx", 'data-ui-name="Tracking entry"', 'data-ui-docs="components/Home/Tracking/README.md"'],
  ["components/Home/Tracking/pen-settings-dialog.tsx", 'data-ui-name="Pen settings"', 'data-ui-docs="components/Home/Tracking/README.md"'],
  [
    "components/Home/Tracking/tracking-view-settings-dialog.tsx",
    'data-ui-name="Tracking view settings"',
    'data-ui-docs="components/Home/Tracking/README.md"',
  ],
  ["components/Home/Tracking/log-activity-dialog.tsx", 'data-ui-name="Log activity"', 'data-ui-docs="components/Home/Tracking/README.md"'],
  ["components/Home/Habits/daily-task-form-dialog.tsx", 'data-ui-name="Habit form"', 'data-ui-docs="components/Home/Habits/README.md"'],
  ["components/Home/Habits/settings-dialog.tsx", 'data-ui-name="Habits settings"', 'data-ui-docs="components/Home/Habits/README.md"'],
  ["components/Home/Goals/ObjectiveDetailDialog.tsx", 'data-ui-name="Objective detail"', 'data-ui-docs="components/Home/Goals/README.md"'],
  ["components/Focus/JustStartMode.tsx", 'data-ui-name="Just Start"', 'data-ui-docs="components/Focus/README.md"'],
]

describe("ui-names overlay css", () => {
  it("beats Radix tablist inline outline:none so App tabs can paint", () => {
    const css = readFileSync(`${ROOT}/components/UiNames/ui-names.css`, "utf8")
    expect(css).toMatch(/html\[data-ui-mode="names"\] \[data-ui-name\] \{[^}]*outline:[^}]*!important/)
  })

  it("floats the nameplate layer above dialogs, Just Start, and From Notes", () => {
    const css = readFileSync(`${ROOT}/components/UiNames/ui-names.css`, "utf8")
    expect(css).toMatch(/\.ui-names-layer \{[^}]*z-index:\s*310/)
    expect(css).toMatch(/\.ui-names-layer \{[^}]*pointer-events:\s*none/)
  })
})

describe("ui-name first-wave stamps", () => {
  it.each(STAMPS)("%s names %s and points at a living README", (file, name, docs) => {
    const src = readFileSync(`${ROOT}/${file}`, "utf8")
    expect(src).toContain(name)
    expect(src).toContain(docs)
  })
})
