/**
 * components/ItemDetail/popup/PopupTabKeys.tsx
 *
 * Private to TaskDetailPopup. Not for the page, the To do drawer, or the task card.
 * The tab key bay. Same order, same secondary keys, same phosphor counts.
 */
"use client"

import type { ItemDetailPanel } from "@/lib/types"
import {
  Brain,
  Calendar,
  CheckCircle,
  FileText,
  History,
  Link2,
  NotebookPen,
  Paperclip,
  Timer,
  Users,
} from "lucide-react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"

export function PopupTabKeys({
  visiblePanels,
  popupTabs,
  noteCount,
  resourceCount,
  linkCount,
}: {
  visiblePanels: ItemDetailPanel[]
  popupTabs: readonly string[]
  noteCount: number
  resourceCount: number
  linkCount: number
}) {
  return (
              <TabsList className="id-view-keys b2-keycap-tab">
                {visiblePanels.includes("body") && (
                <TabsTrigger value="body" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Body
                </TabsTrigger>
                )}
                {visiblePanels.includes("details") && (
                <TabsTrigger value="details" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Details
                </TabsTrigger>
                )}
                {visiblePanels.includes("scheduling") && (
                <TabsTrigger value="scheduling" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Scheduling
                </TabsTrigger>
                )}
                {visiblePanels.includes("dependencies") && (
                <TabsTrigger value="dependencies" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Dependencies
                </TabsTrigger>
                )}
                {visiblePanels.includes("subtasks") && (
                <TabsTrigger value="subtasks" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Subtasks
                </TabsTrigger>
                )}
                {visiblePanels.includes("notes") && (
                <TabsTrigger value="notes" className="flex items-center gap-2">
                  <NotebookPen className="h-4 w-4" />
                  Notes
                  {noteCount > 0 && <span className="id-tab-count">{noteCount}</span>}
                </TabsTrigger>
                )}
                {visiblePanels.includes("resources") && (
                <TabsTrigger value="resources" className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Resources
                  {resourceCount > 0 && <span className="id-tab-count">{resourceCount}</span>}
                </TabsTrigger>
                )}
                {popupTabs.includes("links") && (
                <TabsTrigger value="links" className="flex items-center gap-2 id-tab-secondary">
                  <Link2 className="h-4 w-4" />
                  Links
                  {linkCount > 0 && <span className="id-tab-count">{linkCount}</span>}
                </TabsTrigger>
                )}
                {visiblePanels.includes("analysis") && (
                <TabsTrigger value="analysis" className="flex items-center gap-2 id-tab-secondary">
                  <Brain className="h-4 w-4" />
                  Analysis
                </TabsTrigger>
                )}
                {visiblePanels.includes("time") && (
                <TabsTrigger value="time" className="flex items-center gap-2 id-tab-secondary">
                  <Timer className="h-4 w-4" />
                  Time
                </TabsTrigger>
                )}
                {popupTabs.includes("history") && (
                <TabsTrigger value="history" className="flex items-center gap-2 id-tab-secondary">
                  <History className="h-4 w-4" />
                  History
                </TabsTrigger>
                )}
              </TabsList>
  )
}
