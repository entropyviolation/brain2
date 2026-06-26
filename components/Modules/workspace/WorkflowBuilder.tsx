/**
 * components/Modules/workspace/WorkflowBuilder.tsx — Visual workflow manager
 *
 * The "Zapier for personal ideas" surface: lists a module's authored workflows,
 * lets the user add / edit / enable / delete them, and run a manual one on the
 * spot. Each workflow is composed in `WorkflowStepEditor` and persisted as a
 * serializable `WorkflowDefinition` in `useWorkflowsStore` — the engine then runs
 * them on real item mutations.
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Plus, Pencil, Trash2, Play, Zap, ArrowLeft } from "lucide-react"
import type { WorkflowDefinition, WorkflowTrigger } from "@/lib/types"
import { useWorkflowsStore } from "@/lib/workflows-store"
import { runWorkflowManually } from "@/lib/services/item-mutation-service"
import { WorkflowStepEditor } from "./WorkflowStepEditor"

function triggerSummary(t: WorkflowTrigger): string {
  switch (t.kind) {
    case "item":
      return `On item ${t.event}`
    case "attribute":
      return `On "${t.attrId}" change`
    case "manual":
      return `Manual: ${t.buttonLabel || "Run"}`
    case "schedule":
      return `Every ${t.intervalMinutes ?? 60} min`
  }
}

export function WorkflowBuilder({
  open,
  onClose,
  moduleId,
}: {
  open: boolean
  onClose: () => void
  /** When set, workflows are listed/created against this module instance. */
  moduleId?: string
}) {
  const workflows = useWorkflowsStore((s) => s.workflows)
  const addWorkflowDefinition = useWorkflowsStore((s) => s.addWorkflowDefinition)
  const updateWorkflow = useWorkflowsStore((s) => s.updateWorkflow)
  const removeWorkflow = useWorkflowsStore((s) => s.removeWorkflow)
  const setEnabled = useWorkflowsStore((s) => s.setEnabled)

  const [editing, setEditing] = useState<WorkflowDefinition | null>(null)
  const [creating, setCreating] = useState(false)
  const [runMsg, setRunMsg] = useState<string | null>(null)

  const list = moduleId ? workflows.filter((w) => w.moduleId === moduleId) : workflows

  const handleSave = (def: WorkflowDefinition) => {
    if (workflows.some((w) => w.id === def.id)) {
      updateWorkflow(def.id, def)
    } else {
      addWorkflowDefinition(def)
    }
    setEditing(null)
    setCreating(false)
  }

  const handleRun = (id: string) => {
    const res = runWorkflowManually(id)
    setRunMsg(
      res.blocked
        ? `Blocked: ${res.errors[0]?.message ?? "a condition stopped it"}`
        : `Ran — ${res.effects.length} effect${res.effects.length === 1 ? "" : "s"}.`,
    )
    setTimeout(() => setRunMsg(null), 4000)
  }

  const inEditor = creating || editing
  const close = () => {
    setEditing(null)
    setCreating(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {inEditor ? (editing ? "Edit workflow" : "New workflow") : "Workflows"}
          </DialogTitle>
        </DialogHeader>

        {inEditor ? (
          <div className="space-y-3">
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => (setEditing(null), setCreating(false))}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to list
            </Button>
            <WorkflowStepEditor
              initial={editing ?? undefined}
              moduleId={moduleId}
              onSave={handleSave}
              onCancel={() => (setEditing(null), setCreating(false))}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Build automations that run when items change. Pick a trigger, add conditions, and chain actions —
              like Zapier for your own data.
            </p>
            {runMsg && (
              <div className="rounded border border-primary/30 bg-primary/10 px-3 py-2 text-sm">{runMsg}</div>
            )}

            {list.length === 0 ? (
              <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
                No workflows yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {list.map((w) => (
                  <li key={w.id} className="flex items-center gap-2 rounded-md border p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{w.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {triggerSummary(w.trigger)} · {w.actions.length} action
                        {w.actions.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Switch
                      checked={w.enabled !== false}
                      onCheckedChange={(c) => setEnabled(w.id, c)}
                      aria-label={`Enable ${w.name}`}
                    />
                    {w.trigger.kind === "manual" && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRun(w.id)} title="Run now">
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(w)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeWorkflow(w.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" /> New workflow
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
