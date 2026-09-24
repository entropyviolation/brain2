/**
 * components/Lists/dialogs/ConnectedListsEditor.tsx — Connected-list settings
 *
 * Pick another list and a direction so items auto-join without nesting.
 * Uses the shared searchable ListPicker (same as item “in lists”), not
 * wrapping name chips. Canonical write is A→B on the source; this list's
 * settings also shows inbound "receives from" links. See LIST_LINKS.md.
 */
"use client"

import { useMemo, useState } from "react"
import { Link2, Unlink } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { isLinkableListId, linksForList } from "@/lib/list-links"
import { ListPicker } from "@/components/Lists/list-picker"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export function ConnectedListsEditor({ listId }: { listId: string }) {
  const lists = useTaskStore((s) => s.lists)
  const addListLink = useTaskStore((s) => s.addListLink)
  const removeListLink = useTaskStore((s) => s.removeListLink)

  const [picked, setPicked] = useState<string[]>([])
  const [direction, setDirection] = useState<"push" | "receive">("push")

  const self = lists.find((l) => l.id === listId)
  const connections = useMemo(() => linksForList(lists, listId), [lists, listId])

  const alreadyForDirection = useMemo(() => {
    const ids = connections
      .filter((c) => c.role === direction)
      .map((c) => (direction === "push" ? c.targetListId : c.sourceListId))
    return new Set(ids)
  }, [connections, direction])

  const excludeIds = useMemo(() => {
    const hide = new Set<string>([listId])
    for (const list of lists) {
      if (!isLinkableListId(list.id)) hide.add(list.id)
    }
    for (const id of alreadyForDirection) hide.add(id)
    return [...hide]
  }, [alreadyForDirection, listId, lists])

  const linkableOthers = lists.filter((l) => l.id !== listId && isLinkableListId(l.id))

  const connect = () => {
    const otherId = picked[0]
    if (!otherId || otherId === listId) return
    if (direction === "push") addListLink(listId, otherId)
    else addListLink(otherId, listId)
    setPicked([])
  }

  if (!self || !isLinkableListId(listId)) return null

  return (
    <section className="space-y-3 rounded-lg border p-3" aria-labelledby="connected-lists-heading">
      <div className="space-y-0.5">
        <Label id="connected-lists-heading" className="flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Connected lists
        </Label>
        <p className="text-xs text-muted-foreground">
          Share membership without nesting. Items appear on both lists as the same
          record. Removing the connection does not delete items already added.
        </p>
      </div>

      {connections.length > 0 && (
        <ul className="space-y-1.5" aria-label="Current connections">
          {connections.map((link) => {
            const otherId = link.role === "push" ? link.targetListId : link.sourceListId
            const other = lists.find((l) => l.id === otherId)
            const label =
              link.role === "push"
                ? `Also shows these items on ${other?.name ?? otherId}`
                : `Receives all items from ${other?.name ?? otherId}`
            return (
              <li
                key={`${link.sourceListId}->${link.targetListId}:${link.role}`}
                className="flex items-center gap-2 rounded border bg-muted/30 px-2 py-1.5 text-sm"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: other?.color }} />
                <span className="min-w-0 flex-1 leading-snug">{label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2"
                  onClick={() => removeListLink(link.sourceListId, link.targetListId)}
                  aria-label={`Remove connection with ${other?.name ?? otherId}`}
                >
                  <Unlink className="h-3.5 w-3.5 mr-1" />
                  Remove
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {linkableOthers.length === 0 ? (
        <p className="text-xs text-muted-foreground">Create another list first to connect.</p>
      ) : (
        <div className="space-y-2">
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Direction</legend>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name={`list-link-dir-${listId}`}
                checked={direction === "push"}
                onChange={() => {
                  setDirection("push")
                  setPicked([])
                }}
                className="mt-1"
              />
              <span>Every item in this list also appears on…</span>
            </label>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name={`list-link-dir-${listId}`}
                checked={direction === "receive"}
                onChange={() => {
                  setDirection("receive")
                  setPicked([])
                }}
                className="mt-1"
              />
              <span>Every item on that list also appears here</span>
            </label>
          </fieldset>
          <ListPicker
            selected={picked}
            onChange={setPicked}
            mode="single"
            excludeIds={excludeIds}
            showSelectedChips
          />
          <Button type="button" variant="outline" size="sm" onClick={connect} disabled={!picked[0]}>
            Connect
          </Button>
        </div>
      )}
    </section>
  )
}
