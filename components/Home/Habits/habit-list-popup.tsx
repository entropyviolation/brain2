/**
 * components/Home/Habits/habit-list-popup.tsx — List checklist above the habit form
 *
 * Open list on a Lists source. Names and a Sent or Completed tick (the Lists
 * checklist row, `.fm-checkbox`), Undone only, and Show sent. Sent rows stay
 * hidden until Show sent. A Target line (`0 of 5`) appears when the target is
 * the list length or this period’s set. No list photograph. Closing leaves the draft.
 */
"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { describeListRoutingPreview, listRoutingFromLink } from "@/lib/habit-completion-pipeline"
import { itemTitle } from "@/lib/item-utils"
import { isSentOnList, withSentMark } from "@/lib/list-sent"
import { runWithoutCompletionPopup } from "@/lib/completion-events"
import { toggleCompletion } from "@/lib/services/completion-service"
import { useTaskStore } from "@/lib/task-store"
import type { HabitFrequency, HabitListSentLink, Task } from "@/lib/types"
import "./habit-form-dialog.css"

export interface HabitListPopupProps {
  listId: string | null
  link: HabitListSentLink | null | undefined
  frequency: HabitFrequency | undefined
  container: HTMLElement | null
  onClose: () => void
}

function markedForMeasure(item: Task, listId: string, measure: string): boolean {
  if (measure === "sent") return isSentOnList(item, listId)
  if (measure === "completed") return item.completed === true
  return false
}

export function HabitListPopup({ listId, link, frequency, container, onClose }: HabitListPopupProps) {
  const vaultItems = useTaskStore((s) => s.tasks)
  const vaultLists = useTaskStore((s) => s.lists)
  const updateTask = useTaskStore((s) => s.updateTask)
  const [showSent, setShowSent] = useState(false)
  const [undoneOnly, setUndoneOnly] = useState(false)

  useEffect(() => {
    setShowSent(false)
    setUndoneOnly(false)
  }, [listId])

  const list = listId ? vaultLists.find((row) => row.id === listId) ?? null : null
  const routing = listRoutingFromLink(link)
  const measure = routing.measure
  const markLabel = measure === "sent" ? "Sent" : measure === "completed" ? "Completed" : ""
  const members = listId ? vaultItems.filter((item) => (item.lists ?? []).includes(listId)) : []
  const visible = listId
    ? members.filter((item) => {
        const marked = markedForMeasure(item, listId, measure)
        if (measure === "sent" && marked && !showSent) return false
        if (undoneOnly && marked) return false
        return true
      })
    : []
  const showTarget = routing.target === "listLength" || routing.target === "periodSet"
  const preview =
    listId && showTarget
      ? describeListRoutingPreview(vaultItems, listId, routing, frequency, new Date())
      : null

  const toggle = (item: Task) => {
    if (!listId) return
    if (measure === "sent") {
      updateTask(withSentMark(item, [listId], !isSentOnList(item, listId), new Date()))
      return
    }
    if (measure === "completed") runWithoutCompletionPopup(() => toggleCompletion(item.id))
  }

  return (
    <Dialog
      open={!!listId}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="habit95-dialog habit95-list-popup" container={container} hideClose>
        <DialogHeader className="habit95-title-bar flex-row items-center space-y-0 text-left">
          <DialogTitle className="habit95-title-text">{list?.name || "List"}</DialogTitle>
          <DialogDescription className="sr-only">
            The list checklist, above the habit form. Closing it leaves the draft.
          </DialogDescription>
          <button type="button" className="habit95-title-btn b2-close-key" aria-label="Close list" onClick={onClose}>
            ×
          </button>
        </DialogHeader>
        <div className="habit95-list-popup-body" data-testid="habit-list-popup">
          <div className="habit95-list-popup-tools">
            <button
              type="button"
              className="habit95-btn"
              aria-pressed={undoneOnly}
              onClick={() => setUndoneOnly((on) => !on)}
            >
              Undone only
            </button>
            {measure === "sent" ? (
              <button
                type="button"
                className="habit95-btn"
                aria-pressed={showSent}
                onClick={() => setShowSent((on) => !on)}
              >
                Show sent
              </button>
            ) : null}
          </div>
          {preview ? (
            <p className="habit95-list-target" data-testid="habit-list-target">
              Target {preview.summary}
            </p>
          ) : null}
          <div className="fm98 habit95-list-rows">
            {markLabel ? (
              <div className="fm-linklist fm-checklist">
                <div
                  className="fm-link-row fm-check-head"
                  style={{ gridTemplateColumns: "4.6rem minmax(0, 1fr)" }}
                >
                  <span className="fm-check-head-col">{markLabel}</span>
                  <span className="fm-check-head-rest" />
                </div>
                {visible.map((item) => {
                  const name = itemTitle(item) || "Untitled"
                  const marked = listId ? markedForMeasure(item, listId, measure) : false
                  return (
                    <div
                      key={item.id}
                      className="fm-link-row"
                      style={{ gridTemplateColumns: "4.6rem minmax(0, 1fr)" }}
                    >
                      <button
                        type="button"
                        className="fm-checkbox"
                        aria-pressed={marked}
                        aria-label={`${markLabel} ${name}`}
                        onClick={() => toggle(item)}
                      >
                        {marked ? "✓" : ""}
                      </button>
                      <span
                        className="fm-link-text"
                        style={{ color: "#000", textDecoration: marked ? "line-through" : "none" }}
                      >
                        {name}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <ul className="habit95-list-names">
                {visible.map((item) => (
                  <li key={item.id}>{itemTitle(item) || "Untitled"}</li>
                ))}
              </ul>
            )}
            {visible.length === 0 ? (
              <p className="habit95-list-empty">{members.length === 0 ? "No items on this list." : "Nothing undone."}</p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
