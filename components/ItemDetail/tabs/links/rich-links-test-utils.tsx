/**
 * Test harness for the Links furniture: a draft held in state, edges read
 * through `egoEdges` against the store, like the host panel will (6.5).
 */
import { useState } from "react"
import { LinkComposer } from "@/components/ItemDetail/tabs/links/LinkComposer"
import { LinkLedger, visibleEdges } from "@/components/ItemDetail/tabs/links/LinkLedger"
import { useLinkItems } from "@/components/ItemDetail/tabs/links/link-items"
import { egoEdges } from "@/lib/link-graph"
import { addLink, removeLink } from "@/lib/links"
import type { Task } from "@/lib/types"

export function LinksHarness({
  initial,
  onDraft,
  onDuplicate,
}: {
  initial: Task
  onDraft?: (task: Task) => void
  onDuplicate?: (key: string) => void
}) {
  const [task, setTaskState] = useState(initial)
  const [flash, setFlash] = useState<string | null>(null)
  const { tasks, facts, factsFor } = useLinkItems()
  const setTask = (next: Task) => {
    setTaskState(next)
    onDraft?.(next)
  }
  const edges = visibleEdges(egoEdges(task, tasks), task.dismissedLinkSuggestions)
  const add = (relation: string, targetId: string) => setTask({ ...task, links: addLink(task.links, relation, targetId, task.id) })
  return (
    <div>
      <LinkComposer
        centerId={task.id}
        centerTitle={task.title ?? task.description}
        fromTypeId={task.type}
        fromTypeName={task.type}
        edges={edges}
        tasks={tasks}
        facts={facts}
        onAdd={add}
        onDuplicate={(key) => {
          setFlash(key)
          onDuplicate?.(key)
        }}
      />
      <LinkLedger
        edges={edges}
        factsFor={factsFor}
        flashKey={flash}
        onRemove={(id) => setTask({ ...task, links: removeLink(task.links, id) })}
        onConfirm={add}
        onPin={add}
        onDismiss={(key) =>
          setTask({ ...task, dismissedLinkSuggestions: [...(task.dismissedLinkSuggestions ?? []), key] })
        }
      />
    </div>
  )
}
