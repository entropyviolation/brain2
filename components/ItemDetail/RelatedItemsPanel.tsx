/**
 * components/ItemDetail/RelatedItemsPanel.tsx — Relationship overview for an item
 *
 * Renders an item's outgoing typed links (grouped by relation, each removable)
 * and its discovered backlinks (other items that link to this one), labelling the
 * backlinks with the inverse relation so e.g. "Y blocks X" surfaces as "blocked by
 * Y" on X. Target titles resolve through the task store; rows open the linked item.
 *
 * Spec: §5 (tags & links) — docs/SPEC_MAPPING.md §5.
 */
"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, ArrowUpRight } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { relationLabel, inverseRelation } from "@/lib/links"
import type { Task } from "@/lib/types"

interface RelatedItemsPanelProps {
  task: Task
  onOpenItem: (id: string) => void
  onRemoveLink: (linkId: string) => void
}

interface BacklinkRow {
  sourceId: string
  title: string
  relation: string
}

/** Forward links (grouped, removable) + inverse-labelled backlinks (clickable). */
export function RelatedItemsPanel({ task, onOpenItem, onRemoveLink }: RelatedItemsPanelProps) {
  const allTasks = useTaskStore((s) => s.tasks)
  const getBacklinks = useTaskStore((s) => s.getBacklinks)

  const titleFor = (id: string) => allTasks.find((t) => t.id === id)?.description ?? "Unknown item"

  const grouped = useMemo(() => {
    const map = new Map<string, { id: string; targetId: string }[]>()
    for (const link of task.links ?? []) {
      const list = map.get(link.relation) ?? []
      list.push({ id: link.id, targetId: link.targetId })
      map.set(link.relation, list)
    }
    return Array.from(map.entries())
  }, [task.links])

  const backlinks = useMemo<BacklinkRow[]>(() => {
    const rows: BacklinkRow[] = []
    for (const source of getBacklinks(task.id)) {
      for (const link of source.links ?? []) {
        if (link.targetId === task.id) {
          rows.push({ sourceId: source.id, title: source.description, relation: inverseRelation(link.relation) })
        }
      }
    }
    return rows
  }, [getBacklinks, task.id, allTasks])

  const hasForward = grouped.length > 0
  const hasBack = backlinks.length > 0

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Links</h4>
        {!hasForward ? (
          <p className="text-sm text-muted-foreground italic">No links</p>
        ) : (
          grouped.map(([relation, links]) => (
            <div key={relation} className="space-y-1">
              <Badge variant="outline" className="text-xs font-medium">
                {relationLabel(relation)}
              </Badge>
              {links.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-md border bg-background/50 px-3 py-2"
                >
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm font-medium text-left hover:underline"
                    onClick={() => onOpenItem(link.targetId)}
                  >
                    <ArrowUpRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{titleFor(link.targetId)}</span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove link"
                    onClick={() => onRemoveLink(link.id)}
                    className="h-6 w-6 focus-ring"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Backlinks</h4>
        {!hasBack ? (
          <p className="text-sm text-muted-foreground italic">No backlinks</p>
        ) : (
          backlinks.map((row) => (
            <button
              key={`${row.sourceId}-${row.relation}`}
              type="button"
              className="flex w-full items-center gap-2 rounded-md border bg-background/50 px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => onOpenItem(row.sourceId)}
            >
              <Badge variant="outline" className="text-xs font-medium shrink-0">
                {relationLabel(row.relation)}
              </Badge>
              <span className="truncate font-medium">{row.title}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
