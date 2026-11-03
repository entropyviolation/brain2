/**
 * Search, the idea scroller, day plates, and rows.
 * The scroll pin stays with the parent. This well stays mounted on the Links tab (`hidden`).
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { inboxTitleLines, toggleSelectedId, type InboxPartition } from "@/lib/inbox-batch"
import { itemTitle } from "@/lib/item-utils"
import type { Task } from "@/lib/types"
import { Edit, InboxIcon, Trash } from "lucide-react"
import { CaptureChips } from "./capture-chips"
import { inboxAgeMark, inboxClock, type InboxDayGroup } from "./time"

export function InboxRows({
  partition,
  query,
  setQuery,
  rowsScrollRef,
  releaseRowsScrollPin,
  restoringRowsScroll,
  restorePinnedRowsScroll,
  walking,
  inboxTasks,
  pileTasks,
  queryActive,
  dayGroups,
  selectedIds,
  focusId,
  rowRefs,
  clickRow,
  selectAnchor,
  setFocusId,
  setSelectedIds,
  handleClarifyTask,
  handleDeleteIdea,
}: {
  partition: InboxPartition
  query: string
  setQuery: Dispatch<SetStateAction<string>>
  rowsScrollRef: { current: HTMLDivElement | null }
  releaseRowsScrollPin: () => void
  restoringRowsScroll: { current: boolean }
  restorePinnedRowsScroll: () => void
  walking: boolean
  inboxTasks: Task[]
  pileTasks: Task[]
  queryActive: boolean
  dayGroups: InboxDayGroup[]
  selectedIds: string[]
  focusId: string | null
  rowRefs: { current: Map<string, HTMLDivElement> }
  clickRow: (id: string, shift: boolean) => void
  selectAnchor: { current: string | null }
  setFocusId: Dispatch<SetStateAction<string | null>>
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  handleClarifyTask: (task: Task) => void
  handleDeleteIdea: (task: Task) => void
}) {
  return (
    <div className="inbox-list-well" hidden={partition === "links"}>
      <div className="inbox-search">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search ideas"
          aria-label="Search ideas"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <div
        className="inbox-rows-scroll"
        ref={rowsScrollRef}
        onWheel={releaseRowsScrollPin}
        onScroll={() => {
          if (restoringRowsScroll.current) return
          restorePinnedRowsScroll()
        }}
      >
      {walking ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Walking this pile.</p>
        </div>
      ) : inboxTasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <InboxIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          {pileTasks.length > 0 ? (
            <p>{queryActive ? "Nothing matches." : "Nothing in this slice."}</p>
          ) : partition === "monkey" ? (
            <>
              <p>Monkey brain is quiet.</p>
              <p className="text-sm">Flag a capture with -mb or -monkey, or send a selection here from Inbox.</p>
            </>
          ) : (
            <>
              <p>Nothing waiting to revisit.</p>
              <p className="text-sm">Use Quick Add or Bulk Add to capture new ideas.</p>
            </>
          )}
        </div>
      ) : (
        <div className="inbox-rows">
          {dayGroups.map((group) => (
            <div key={group.key}>
              <div className="inbox-day-plate">{group.plate}</div>
              {group.tasks.map((task) => {
                const selected = selectedIds.includes(task.id)
                const focused = focusId === task.id
                const { line, aside } = inboxTitleLines(itemTitle(task))
                const age = inboxAgeMark(task.createdAt)
                return (
                  <div
                    key={task.id}
                    ref={(node) => {
                      if (node) rowRefs.current.set(task.id, node)
                      else rowRefs.current.delete(task.id)
                    }}
                    data-inbox-row={task.id}
                    data-focused={focused ? "true" : undefined}
                    data-selected={selected ? "true" : undefined}
                    className="inbox-row"
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      aria-label={`Select ${itemTitle(task)}`}
                      onClick={(event) => {
                        if (!event.shiftKey) return
                        event.preventDefault()
                        clickRow(task.id, true)
                      }}
                      onChange={() => {
                        selectAnchor.current = task.id
                        setFocusId(task.id)
                        setSelectedIds((ids) => toggleSelectedId(ids, task.id))
                      }}
                    />
                    <button
                      type="button"
                      className="inbox-row-title"
                      onClick={(event) => clickRow(task.id, event.shiftKey)}
                    >
                      <span>{line || "Untitled"}</span>
                      {aside ? <span className="inbox-row-aside">{aside}</span> : null}
                      <CaptureChips task={task} />
                    </button>
                    <span className="inbox-row-when">
                      {inboxClock(task.createdAt)}
                      {age ? <i className="inbox-age">{age}</i> : null}
                    </span>
                    <span className="inbox-row-tools">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="inbox-row-tool"
                        title="Clarify this idea"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleClarifyTask(task)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="inbox-row-tool"
                        title="Delete this idea"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDeleteIdea(task)
                        }}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
