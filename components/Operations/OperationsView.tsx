/**
 * components/Operations/OperationsView.tsx — Top-level Operations surface
 *
 * The integration entry point for Feature 2 (Operations / directed enterprises).
 * Lists every operation-typed item and, when one is selected, mounts the
 * `OperationWorkspace` mini-app for it. New operations can be created inline.
 *
 * Mounted from the app shell's "Operations" tab (`app/page.tsx`).
 */
"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Rocket, Plus } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { OPERATION_TYPE_ID, OPERATION_ATTR, type OperationStage } from "@/lib/operation-types"
import { OperationWorkspace } from "./OperationWorkspace"
import { createOperation } from "./operation-actions"

const STAGE_BADGE: Record<OperationStage, string> = {
  planning: "bg-slate-100 text-slate-700",
  active: "bg-teal-100 text-teal-800",
  paused: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-800",
  abandoned: "bg-rose-100 text-rose-800",
}

interface OperationsViewProps {
  /** Optional callback to open a non-operation item elsewhere in the app. */
  onTaskSelect?: (taskId: string) => void
}

export function OperationsView({ onTaskSelect }: OperationsViewProps) {
  const tasks = useTaskStore((s) => s.tasks)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState("")

  const operations = useMemo(() => tasks.filter((t) => t.type === OPERATION_TYPE_ID), [tasks])

  if (selectedId) {
    return (
      <OperationWorkspace
        operationId={selectedId}
        onBack={() => setSelectedId(null)}
        onOpenItem={onTaskSelect}
      />
    )
  }

  const handleCreate = () => {
    const title = newTitle.trim()
    if (!title) return
    const op = createOperation(title)
    setNewTitle("")
    setSelectedId(op.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Rocket className="h-6 w-6" />
          Operations
        </h2>
      </div>

      <div className="flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New operation name…"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate()
          }}
          className="max-w-sm"
        />
        <Button onClick={handleCreate} disabled={!newTitle.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          New Operation
        </Button>
      </div>

      {operations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No operations yet. Create one above, or upgrade an existing task from its detail view.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {operations.map((op) => {
            const stage = (op.attributes?.[OPERATION_ATTR.stage] as OperationStage) ?? "planning"
            return (
              <Card
                key={op.id}
                className="cursor-pointer card-hover"
                onClick={() => setSelectedId(op.id)}
              >
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{op.description}</span>
                    <Badge className={STAGE_BADGE[stage]}>{stage}</Badge>
                  </div>
                  {typeof op.attributes?.[OPERATION_ATTR.mission] === "string" && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {op.attributes[OPERATION_ATTR.mission] as string}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default OperationsView
