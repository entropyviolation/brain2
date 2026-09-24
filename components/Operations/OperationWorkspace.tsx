/**
 * components/Operations/OperationWorkspace.tsx — Operation mini-app
 *
 * The full-screen workspace for a single Operation. Its tab strip is **not
 * fixed**: it is built from the panels this operation has switched on
 * (`resolveOperationPanels`), so a computer-work op can be Home + Tasks + Log
 * while a trip adds Timeline, Locations, and a Plan doc. The **Settings** dialog
 * on the menubar is where that choice (plus categories, mission, stage, target
 * date) is made.
 *
 * Self-contained: it reads/writes only through the task store + the
 * `operation-actions` helpers, so mounting it needs just an `operationId` (and
 * optional `onBack` / `onOpenItem`).
 */
"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Rocket } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import {
  OPERATION_ATTR,
  getOperationCategories,
  getOperationPanel,
  isWideOperationPanel,
  resolveOperationPanels,
  canonicalOperationPanelId,
  type OperationPanelId,
  type OperationStage,
} from "@/lib/operation-types"
import { APP_NAV_KEYS, opsPanelScrollSlot, readStoredRecord, writeStoredRecordField } from "@/lib/app-navigation"
import { usePersistedScroll } from "@/lib/use-persisted-scroll"
import { renameOperation } from "./operation-actions"
import { OperationHome } from "./OperationHome"
import { OperationTasksPanel } from "./OperationTasksPanel"
import { PhasesPanel } from "./PhasesPanel"
import { PartsPanel } from "./PartsPanel"
import { ResourcesPanel } from "./ResourcesPanel"
import { OperationLogFeed } from "./OperationLogFeed"
import { ToDoNextRail } from "./ToDoNextRail"
import { OperationPostMortemDialog } from "./OperationPostMortemDialog"
import { OperationSettingsDialog } from "./OperationSettingsDialog"
import { WorkingNowControl } from "./WorkingNowControl"
import {
  OperationLocationsPanel,
  OperationPlanDocPanel,
  OperationTimelinePanel,
} from "./OperationFieldPlanPanels"
import type { Task } from "@/lib/types"
import "./operations-chrome.css"

/** Body for one enabled tab panel. */
function PanelBody({
  panelId,
  operation,
  onOpenItem,
}: {
  panelId: OperationPanelId
  operation: Task
  onOpenItem?: (id: string) => void
}) {
  switch (panelId) {
    case "home":
      return <OperationHome operation={operation} />
    case "tasks":
      return <OperationTasksPanel operation={operation} onOpenItem={onOpenItem} />
    case "phases":
      return <PhasesPanel operation={operation} onOpenItem={onOpenItem} />
    case "parts":
      return <PartsPanel operation={operation} />
    case "timeline":
      return <OperationTimelinePanel operation={operation} onOpenItem={onOpenItem} />
    case "locations":
      return <OperationLocationsPanel operation={operation} onOpenItem={onOpenItem} />
    case "plan":
      return <OperationPlanDocPanel operation={operation} />
    case "resources":
      return <ResourcesPanel operation={operation} onOpenItem={onOpenItem} />
    case "log":
      return <OperationLogFeed operation={operation} />
    default:
      return null
  }
}

function OpsScrollPane({ slot, children }: { slot: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  usePersistedScroll(slot, ref)
  return (
    <div ref={ref} className="h-full min-h-0 overflow-auto">
      {children}
    </div>
  )
}

export function OperationWorkspace({
  operationId,
  onBack,
  onOpenItem,
}: {
  operationId: string
  onBack?: () => void
  onOpenItem?: (id: string) => void
}) {
  const operation = useTaskStore((s) => s.tasks.find((t) => t.id === operationId))
  const [renaming, setRenaming] = useState(false)
  const [titleDraft, setTitleDraft] = useState("")
  const [postMortemOpen, setPostMortemOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useState<OperationPanelId>(() => {
    const stored = readStoredRecord(APP_NAV_KEYS.opsPanel)[operationId]
    return canonicalOperationPanelId(stored) ?? "home"
  })

  const panels = useMemo(() => resolveOperationPanels(operation), [operation])
  const tabPanels = useMemo(
    () => panels.filter((id) => getOperationPanel(id)?.surface === "tab"),
    [panels],
  )
  const showRail = panels.includes("queue")

  // Switching a panel off in Settings must not leave the workspace on a dead tab.
  useEffect(() => {
    if (tabPanels.length > 0 && !tabPanels.includes(tab)) setTab(tabPanels[0])
  }, [tabPanels, tab])

  useEffect(() => {
    writeStoredRecordField(APP_NAV_KEYS.opsPanel, operationId, tab)
  }, [operationId, tab])

  if (!operation) {
    return (
      <div
        className="ops95"
        data-ui-name="Operations"
        data-ui-help="Command center for project operations — board, panels, and working-now clock."
        data-ui-docs="components/Operations/README.md"
      >
        <div className="ops-window">
          <div className="ops-fascia">
            <div className="ops-mark">
              <span className="ops-power-lamp" aria-hidden />
              <Rocket className="ops-title-icon" aria-hidden />
              <h2>Operations</h2>
            </div>
            {onBack && (
              <button type="button" className="ops-title-btn" onClick={onBack} aria-label="Back">
                ×
              </button>
            )}
          </div>
          <div className="ops-body">
            <div className="ops-empty">
              <p>Operation not found.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const stage = (operation.attributes?.[OPERATION_ATTR.stage] as OperationStage) ?? "planning"
  const categories = getOperationCategories(operation)
  const wideTab = isWideOperationPanel(tab)

  const commitRename = () => {
    renameOperation(operation.id, titleDraft)
    setRenaming(false)
  }

  return (
    <div
      className="ops95"
      data-ui-name="Operations"
      data-ui-help="Command center for project operations — board, panels, and working-now clock."
      data-ui-docs="components/Operations/README.md"
    >
      <div className="ops-window">
        <div className="ops-fascia">
          <div className="ops-fascia-row">
            {onBack && (
              <button type="button" className="ops-title-btn" onClick={onBack} title="Back to board" aria-label="Back">
                ←
              </button>
            )}
            <div className="ops-mark">
              <span className="ops-power-lamp is-on" aria-hidden />
              <Rocket className="ops-title-icon" aria-hidden />
              {renaming ? (
                <input
                  autoFocus
                  className="ops-input ops-title-rename"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  aria-label="Operation name"
                />
              ) : (
                <h2>
                  <button
                    type="button"
                    className="ops-title-name"
                    data-no95
                    onClick={() => {
                      setTitleDraft(operation.description)
                      setRenaming(true)
                    }}
                    title="Rename"
                  >
                    {operation.description}
                  </button>
                </h2>
              )}
            </div>
            <span className={`ops-stage ops-stage-${stage}`}>{stage}</span>
          </div>

          <div className="ops-menubar">
            {onBack && (
              <button type="button" className="ops-btn" onClick={onBack}>
                Board
              </button>
            )}
            <button type="button" className="ops-btn" onClick={() => setSettingsOpen(true)}>
              Settings
            </button>
            <button type="button" className="ops-btn" onClick={() => setPostMortemOpen(true)}>
              After-action report
            </button>
            {categories.length > 0 && (
              <span className="ops-chip-row ops-menubar-chips">
                {categories.map((name) => (
                  <span key={name} className="ops-chip ops-chip-static">
                    {name}
                  </span>
                ))}
              </span>
            )}
            <WorkingNowControl operationId={operation.id} operationName={operation.description} />
          </div>
        </div>

        <div className={`ops-body ops-split${wideTab || !showRail ? " ops-split-wide" : ""}`}>
          <Tabs
            value={tab}
            onValueChange={(next) => setTab(next as OperationPanelId)}
            className="ops-main min-w-0 flex min-h-0 flex-col"
          >
            <TabsList className="ops-view-keys flex h-auto w-full flex-wrap justify-start rounded-none">
              {tabPanels.map((id) => (
                <TabsTrigger key={id} value={id}>
                  {getOperationPanel(id)?.label ?? id}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabPanels.map((id) => (
              <TabsContent key={id} value={id} className="ops-tab-pane mt-2 min-h-0 flex-1 overflow-hidden">
                <OpsScrollPane slot={opsPanelScrollSlot(operation.id, id)}>
                  <PanelBody panelId={id} operation={operation} onOpenItem={onOpenItem} />
                </OpsScrollPane>
              </TabsContent>
            ))}
          </Tabs>

          {showRail && !wideTab && (
            <aside className="ops-rail">
              <ToDoNextRail operation={operation} onOpenItem={onOpenItem} />
            </aside>
          )}
        </div>

        <div className="ops-status">
          <span className="ops-status-led" aria-hidden />
          {tabPanels.length} panel{tabPanels.length === 1 ? "" : "s"} on · Settings picks which
        </div>
      </div>

      <OperationSettingsDialog
        operation={operation}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onDeleted={onBack}
      />

      <OperationPostMortemDialog
        operation={operation}
        open={postMortemOpen}
        onClose={() => setPostMortemOpen(false)}
      />
    </div>
  )
}

export default OperationWorkspace
