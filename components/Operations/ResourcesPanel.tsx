/**
 * components/Operations/ResourcesPanel.tsx — Operation resources
 *
 * Lists the resource items attached to an operation (linked via
 * `has-resource`/`resource-of`) — references, assets, links, people. Resources
 * can be added inline (creates a lightweight task linked as a resource) or
 * detached. Opening a resource delegates to the parent.
 */
"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, X, ArrowUpRight, Boxes } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { getResources, OP_REL } from "@/lib/operations"
import type { Task } from "@/lib/types"
import { addResource, unlinkChild } from "./operation-actions"

export function ResourcesPanel({
  operation,
  onOpenItem,
}: {
  operation: Task
  onOpenItem?: (id: string) => void
}) {
  const allTasks = useTaskStore((s) => s.tasks)
  const resources = useMemo(() => getResources(operation.id, allTasks), [operation.id, allTasks])
  const [draft, setDraft] = useState("")

  const submit = () => {
    if (!draft.trim()) return
    addResource(operation.id, draft)
    setDraft("")
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Boxes className="h-4 w-4 text-teal-600" />
        Resources
      </div>

      {resources.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          No resources attached. Add references, assets, or contacts this operation relies on.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {resources.map((res) => (
            <li key={res.id} className="flex items-center gap-2 rounded-md border bg-background/50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{res.description}</span>
              {onOpenItem && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="Open resource"
                  onClick={() => onOpenItem(res.id)}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive"
                title="Detach resource"
                onClick={() => unlinkChild(operation.id, OP_REL.hasResource, res.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Add a resource…"
        />
        <Button onClick={submit} disabled={!draft.trim()}>
          <Plus className="h-4 w-4 mr-1.5" /> Add
        </Button>
      </div>
    </div>
  )
}

export default ResourcesPanel
