// Page-only tab keycaps for the full-screen item detail. Not for ItemDetailPopup, the To do drawer, or the task card.

import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { foldPersonNoteLog } from "@/lib/person-notes-fold"
import type { ItemDetailPanel, Task } from "@/lib/types"
import { History, Timer } from "lucide-react"

export function ItemDetailPageTabList({
  detailTabs,
  visiblePanels,
  task,
}: {
  detailTabs: string[]
  visiblePanels: ItemDetailPanel[]
  task: Task
}) {
  const tabCount = detailTabs.length
  // Old person notes still on personProfile.noteLog count too (3.3 fold).
  const noteCount = foldPersonNoteLog(task).noteLog?.length ?? 0

  return (
    <TabsList
      className="id-view-keys b2-keycap-tab"
      style={{ gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` }}
    >
      {visiblePanels.includes("body") && <TabsTrigger value="body">Body</TabsTrigger>}
      <TabsTrigger value="details">Details</TabsTrigger>
      {visiblePanels.includes("scheduling") && <TabsTrigger value="scheduling">Scheduling</TabsTrigger>}
      {visiblePanels.includes("dependencies") && <TabsTrigger value="dependencies">Dependencies</TabsTrigger>}
      {visiblePanels.includes("subtasks") && <TabsTrigger value="subtasks">Subtasks</TabsTrigger>}
      {visiblePanels.includes("notes") && (
        <TabsTrigger value="notes">
          Notes
          {noteCount > 0 && <span className="id-tab-count">{noteCount}</span>}
        </TabsTrigger>
      )}
      {visiblePanels.includes("resources") && (
        <TabsTrigger value="resources">
          Resources
          {(task.resources?.length ?? 0) > 0 && <span className="id-tab-count">{task.resources!.length}</span>}
        </TabsTrigger>
      )}
      {visiblePanels.includes("analysis") && (
        <TabsTrigger value="analysis" className="id-tab-secondary">Analysis</TabsTrigger>
      )}
      {visiblePanels.includes("time") && (
        <TabsTrigger value="time" className="id-tab-secondary">
          <Timer className="h-4 w-4" />
          Time
        </TabsTrigger>
      )}
      {detailTabs.includes("history") && (
        <TabsTrigger value="history" className="id-tab-secondary">
          <History className="h-4 w-4" />
          History
        </TabsTrigger>
      )}
    </TabsList>
  )
}
