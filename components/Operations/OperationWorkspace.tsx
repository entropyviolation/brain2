/**
 * components/Operations/OperationWorkspace.tsx — Operation mini-app
 *
 * The full-screen workspace for a single Operation (directed enterprise). Reads
 * the operation task from the task store by id and lays out a header (back,
 * rename, stage badge, post-mortem) over a two-column body: the main tabs
 * (Home / Phases / Resources / Log) and a persistent "To do next" rail.
 *
 * Self-contained: it reads/writes only through the task store + the
 * `operation-actions` helpers, so the integration pass just needs to mount it
 * with an `operationId` (and optional `onBack` / `onOpenItem`).
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Pencil, ClipboardCheck, Rocket } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { OPERATION_ATTR, type OperationStage } from "@/lib/operation-types"
import type { Task } from "@/lib/types"
import { renameOperation } from "./operation-actions"
import { OperationHome } from "./OperationHome"
import { PhasesPanel } from "./PhasesPanel"
import { ResourcesPanel } from "./ResourcesPanel"
import { OperationLogFeed } from "./OperationLogFeed"
import { ToDoNextRail } from "./ToDoNextRail"
import { OperationPostMortemDialog } from "./OperationPostMortemDialog"

const STAGE_BADGE: Record<OperationStage, string> = {
  planning: "bg-slate-100 text-slate-700",
  active: "bg-teal-100 text-teal-800",
  paused: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-800",
  abandoned: "bg-rose-100 text-rose-800",
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

  if (!operation) {
    return (
      <div className="space-y-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        )}
        <p className="text-sm text-muted-foreground">Operation not found.</p>
      </div>
    )
  }

  const stage = (operation.attributes?.[OPERATION_ATTR.stage] as OperationStage) ?? "planning"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} title="Back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Rocket className="h-5 w-5 text-teal-600 shrink-0" />
          {renaming ? (
            <Input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                renameOperation(operation.id, titleDraft)
                setRenaming(false)
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="h-9 max-w-xs text-lg font-bold"
            />
          ) : (
            <button
              type="button"
              className="group flex items-center gap-2 truncate text-2xl font-bold"
              onClick={() => {
                setTitleDraft(operation.description)
                setRenaming(true)
              }}
            >
              <span className="truncate">{operation.description}</span>
              <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-60" />
            </button>
          )}
          <Badge className={`shrink-0 border-0 ${STAGE_BADGE[stage]}`}>{stage}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPostMortemOpen(true)}>
          <ClipboardCheck className="mr-2 h-4 w-4" />
          Post-mortem
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <Tabs defaultValue="home" className="min-w-0">
          <TabsList>
            <TabsTrigger value="home">Home</TabsTrigger>
            <TabsTrigger value="phases">Phases</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="log">Log</TabsTrigger>
          </TabsList>
          <TabsContent value="home" className="pt-2">
            <OperationHome operation={operation} />
          </TabsContent>
          <TabsContent value="phases" className="pt-2">
            <PhasesPanel operation={operation} onOpenItem={onOpenItem} />
          </TabsContent>
          <TabsContent value="resources" className="pt-2">
            <ResourcesPanel operation={operation} onOpenItem={onOpenItem} />
          </TabsContent>
          <TabsContent value="log" className="pt-2">
            <OperationLogFeed operation={operation} />
          </TabsContent>
        </Tabs>

        <aside className="lg:border-l lg:pl-4">
          <ToDoNextRail operation={operation} onOpenItem={onOpenItem} />
        </aside>
      </div>

      <OperationPostMortemDialog
        operation={operation}
        open={postMortemOpen}
        onClose={() => setPostMortemOpen(false)}
      />
    </div>
  )
}

export default OperationWorkspace
