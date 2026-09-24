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
    <div className="ops-panel">
      <div className="ops-deck">
        <div className="ops-deck-head">
          Resources
        </div>
        {resources.length === 0 ? (
          <p className="ops-hint">
            No resources attached. Add references, assets, or contacts this operation relies on.
          </p>
        ) : (
          <ul className="space-y-2">
            {resources.map((res) => (
              <li key={res.id} className="ops-row">
                <span className="min-w-0 flex-1 truncate text-sm">{res.description}</span>
                {onOpenItem && (
                  <button
                    type="button"
                    className="ops-btn ops-icon-btn"
                    title="Open resource"
                    onClick={() => onOpenItem(res.id)}
                  >
                    ↗
                  </button>
                )}
                <button
                  type="button"
                  className="ops-btn ops-icon-btn"
                  title="Detach resource"
                  onClick={() => unlinkChild(operation.id, OP_REL.hasResource, res.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ops-add-row">
        <input
          className="ops-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Add a resource…"
        />
        <button type="button" className="ops-btn ops-btn-default" onClick={submit} disabled={!draft.trim()}>
          Add
        </button>
      </div>
    </div>
  )
}

export default ResourcesPanel
