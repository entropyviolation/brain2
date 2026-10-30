/**
 * components/ItemDetail/type-views/LogItemDetail.tsx — Log desk
 *
 * The item points at a tracking row. The desk stays in the item. Edit the
 * clock opens EntryDialog, and Close dismisses that editor. Food opens
 * FoodDetailDialog for that entry's date; line edits stay on EntryDialog.
 * A count is a read of the count store. A missing row stays missing.
 *
 * A log entry pointer can count toward an existing tally and attach another
 * log. Count toward calls the count store. Attach stores `related` on the
 * other log, pointing at this one. Copy duplicates the other row first.
 */
"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import { FoodDetailDialog } from "@/components/Home/Tracking/tracking-log/food/food-detail-dialog"
import {
  asLogEntry,
  classifyLogBookRow,
  logRowWhenLabel,
  type LogBookEntry,
} from "@/components/Home/Tracking/tracking-log-model"
import { ItemPicker } from "@/components/Lists/item-picker"
import { parseLocalDate } from "@/lib/date-utils"
import { commitItemEdit } from "@/lib/commit-item-edit"
import {
  incrementCountForEntry,
  removeCountTickForEntry,
  useCountStatusesStore,
  type CountTick,
} from "@/lib/count-statuses"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { addLink } from "@/lib/links"
import {
  LOG_COUNT_TYPE_ID,
  LOG_FOOD_TYPE_ID,
  LOG_SUBTYPE_IDS,
} from "@/lib/log-item-types"
import { useTaskStore } from "@/lib/task-store"
import { duplicateLogEntry } from "@/lib/tracking-log-ops"
import { syncTrackingLists, trackingItemId } from "@/lib/tracking-lists"
import { LOG_TYPE_ID, THOUGHT_PROCESS_TYPE_ID, TRACKING_ITEM_ATTR } from "@/lib/tracking-item-types"
import { minutesToLabel, type TimeEntry } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Task } from "@/lib/types"

const TRACKING_ENTRY_PREFIX = "tracking-entry-"
const ATTACH_RELATION = "related"

export function isLogItemDetailType(typeId: string | null | undefined): boolean {
  if (!typeId) return false
  if (typeId === LOG_TYPE_ID || typeId === THOUGHT_PROCESS_TYPE_ID) return true
  return (LOG_SUBTYPE_IDS as readonly string[]).includes(typeId)
}

function entryPointer(task: Task): string {
  const value = task.attributes?.[TRACKING_ITEM_ATTR.entryId]
  return typeof value === "string" ? value.trim() : ""
}

/** Attribute first. A `tracking-entry-` id is the same pointer when the attribute is empty. */
function entryIdOf(task: Task): string {
  const fromAttr = entryPointer(task)
  if (fromAttr) return fromAttr
  return task.id.startsWith(TRACKING_ENTRY_PREFIX) ? task.id.slice(TRACKING_ENTRY_PREFIX.length) : ""
}

function tickSourceEntryId(tick: CountTick): string {
  const source = (tick as { sourceEntryId?: string }).sourceEntryId
  return typeof source === "string" ? source : ""
}

function entryWhen(entry: TimeEntry | undefined): string {
  if (!entry) return ""
  const label = logRowWhenLabel(asLogEntry(entry), { showDate: true })
  return label.badge ? `${label.when} ${label.badge}` : label.when
}

function isAttachableLog(task: Task): boolean {
  return isLogItemDetailType(task.type) && task.type !== LOG_COUNT_TYPE_ID && entryIdOf(task) !== ""
}

/** The other log is the child. `related` on that item points at this log. */
function linkRelated(childId: string, parentId: string) {
  if (!childId || childId === parentId) return
  const child = useTaskStore.getState().tasks.find((row) => row.id === childId)
  if (!child) return
  const links = addLink(child.links, ATTACH_RELATION, parentId, child.id)
  if (links === child.links) return
  commitItemEdit(child.id, { links }, { surface: "log-item-detail" })
}

function attachLog(parentId: string, other: Task, mode: "copy" | "move") {
  const otherEntryId = entryIdOf(other)
  if (!otherEntryId) return
  if (mode === "move") {
    linkRelated(other.id, parentId)
    return
  }
  const copiedId = duplicateLogEntry(otherEntryId)
  if (!copiedId) return
  syncTrackingLists()
  const tasks = useTaskStore.getState().tasks
  const pointer =
    tasks.find((row) => row.id === trackingItemId(copiedId)) ??
    tasks.find((row) => entryIdOf(row) === copiedId)
  if (pointer) linkRelated(pointer.id, parentId)
}

function tickLabel(tick: CountTick): string {
  if (tick.clockCertainty === "unknown") return `${tick.date} Unknown`
  const time = minutesToLabel(tick.startMin)
  if (tick.clockCertainty === "estimated") return `${tick.date} ${time} Estimated`
  return `${tick.date} ${time}`
}

function MissingRecord() {
  return (
    <section className="id-bay" aria-label="Log">
      <p>This record is no longer on the grid.</p>
    </section>
  )
}

function CountRead({ countId }: { countId: string }) {
  const count = useCountStatusesStore((state) => state.counts.find((row) => row.id === countId) ?? null)
  if (!count) return <MissingRecord />
  return (
    <section className="id-bay" aria-label="Count">
      <header className="id-attrs-head">
        <span className="id-attrs-plate">{count.name}</span>
        <span>{count.ticks.length}</span>
      </header>
      <ul aria-label={`${count.name} ticks`}>
        {count.ticks.map((tick) => (
          <li key={tick.id}>{tickLabel(tick)}</li>
        ))}
      </ul>
      <p>Editing stays on the Tracking count shelf.</p>
    </section>
  )
}

/** The entry dialog is modal and mounts after paint. These bays sit in it so they can be used. */
function EntryDeskBays({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const look = () => document.querySelector<HTMLElement>(".trk-entry")
    const found = look()
    if (found) {
      setHost(found)
      return
    }
    const observer = new MutationObserver(() => {
      const next = look()
      if (!next) return
      setHost(next)
      observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  if (!host) return null
  return createPortal(<div className="id95">{children}</div>, host)
}

function foodRows(entries: readonly TimeEntry[], penName: ReadonlyMap<string, string>): LogBookEntry[] {
  const rows: LogBookEntry[] = []
  for (const entry of entries) {
    const row = classifyLogBookRow(asLogEntry(entry), penName.get(entry.penId))
    if (row?.list === "food") rows.push(row)
  }
  return rows
}

function CountTowardBay({ entryId }: { entryId: string }) {
  const counts = useCountStatusesStore((state) => state.counts)
  const [chosen, setChosen] = useState("")
  const linked = counts.filter((count) => count.ticks.some((tick) => tickSourceEntryId(tick) === entryId))

  return (
    <section className="id-bay id-attrs" aria-label="Count toward">
      <header className="id-attrs-head">
        <span className="id-attrs-plate">Count toward</span>
        <button
          type="button"
          className="id-keycap"
          aria-label="Add to count"
          disabled={!chosen}
          onClick={() => incrementCountForEntry(chosen, entryId)}
        >
          Add
        </button>
      </header>
      <ItemPicker
        compact
        mode="single"
        searchLabel="Counts"
        placeholder="Counts"
        emptyLabel="No counts."
        choices={counts.map((count) => ({ id: count.id, title: count.name || "Untitled" }))}
        selected={chosen ? [chosen] : []}
        onChange={(ids) => setChosen(ids[0] ?? "")}
      />
      {linked.length > 0 ? (
        <ul aria-label="Counts for this log">
          {linked.map((count) => (
            <li key={count.id}>
              <div className="id-attrs-head">
                <span>{count.name}</span>
                <button
                  type="button"
                  className="id-keycap"
                  aria-label={`Remove ${count.name}`}
                  onClick={() => removeCountTickForEntry(count.id, entryId)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function AttachLogBay({ parent }: { parent: Task }) {
  const tasks = useTaskStore((state) => state.tasks)
  const entries = useTimeTrackingStore((state) => state.entries)
  const [chosen, setChosen] = useState("")
  const [mode, setMode] = useState<"copy" | "move">("copy")
  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries])
  const choices = useMemo(
    () =>
      tasks
        .filter((row) => row.id !== parent.id && isAttachableLog(row))
        .map((row) => {
          const when = entryWhen(entryById.get(entryIdOf(row)))
          return { id: row.id, title: itemTitleOrUntitled(row), ...(when ? { hint: when } : {}) }
        }),
    [tasks, parent.id, entryById],
  )
  const attached = useMemo(
    () =>
      tasks
        .filter(
          (row) =>
            isAttachableLog(row) &&
            row.id !== parent.id &&
            (row.links ?? []).some((link) => link.relation === ATTACH_RELATION && link.targetId === parent.id),
        )
        .sort((a, b) => itemTitleOrUntitled(a).localeCompare(itemTitleOrUntitled(b)) || a.id.localeCompare(b.id)),
    [tasks, parent.id],
  )

  return (
    <section className="id-bay id-attrs" aria-label="Attach">
      <header className="id-attrs-head">
        <span className="id-attrs-plate">Attach</span>
        <button type="button" className="id-keycap" aria-pressed={mode === "copy"} onClick={() => setMode("copy")}>
          Copy
        </button>
        <button type="button" className="id-keycap" aria-pressed={mode === "move"} onClick={() => setMode("move")}>
          Move
        </button>
        <button
          type="button"
          className="id-keycap"
          disabled={!chosen}
          onClick={() => {
            const other = useTaskStore.getState().tasks.find((row) => row.id === chosen)
            if (!other) return
            attachLog(parent.id, other, mode)
            setChosen("")
          }}
        >
          Attach
        </button>
      </header>
      <ItemPicker
        compact
        mode="single"
        searchLabel="Logs"
        placeholder="Logs"
        emptyLabel="No logs."
        choices={choices}
        selected={chosen ? [chosen] : []}
        onChange={(ids) => setChosen(ids[0] ?? "")}
      />
      {attached.length > 0 ? (
        <ul aria-label="Attached logs">
          {attached.map((row) => {
            const when = entryWhen(entryById.get(entryIdOf(row)))
            return (
              <li key={row.id}>
                {itemTitleOrUntitled(row)}
                {when ? ` ${when}` : ""}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

export function LogItemDetail({ task, typeId }: { task: Task; typeId: string }) {
  const pointerId = typeId === LOG_COUNT_TYPE_ID ? entryPointer(task) : entryIdOf(task)
  const entries = useTimeTrackingStore((state) => state.entries)
  const scopes = useTimeTrackingStore((state) => state.scopes)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [forTask, setForTask] = useState(task.id)
  const [clockOpen, setClockOpen] = useState(false)
  const [foodOpen, setFoodOpen] = useState(false)

  if (forTask !== task.id) {
    setForTask(task.id)
    setFocusId(null)
    setClockOpen(false)
    setFoodOpen(false)
  }

  const penName = useMemo(() => {
    const map = new Map<string, string>()
    for (const scope of scopes) {
      for (const pen of scope.pens) map.set(pen.id, pen.name)
    }
    return map
  }, [scopes])

  if (typeId === LOG_COUNT_TYPE_ID) return <CountRead countId={pointerId} />

  const pointer = entries.find((entry) => entry.id === pointerId) ?? null
  if (!pointer) return <MissingRecord />

  const shown = entries.find((entry) => entry.id === (focusId ?? pointer.id)) ?? pointer
  const foods = foodRows(entries, penName)
  const anchor = parseLocalDate(pointer.date) ?? new Date()
  const when = entryWhen(pointer)
  const bays = (
    <>
      <CountTowardBay key={pointer.id} entryId={pointer.id} />
      <AttachLogBay key={task.id} parent={task} />
    </>
  )

  return (
    <>
      <section className="id-bay" aria-label="Log">
        <header className="id-attrs-head">
          <span className="id-attrs-plate">{(pointer.title ?? "").trim() || "Untitled"}</span>
          {when ? <span>{when}</span> : null}
          <button type="button" className="id-keycap" onClick={() => setClockOpen(true)}>
            Edit the clock
          </button>
          {typeId === LOG_FOOD_TYPE_ID ? (
            <button type="button" className="id-keycap" onClick={() => setFoodOpen(true)}>
              Food
            </button>
          ) : null}
        </header>
      </section>
      {clockOpen ? (
        <>
          <EntryDialog entry={shown} onClose={() => setClockOpen(false)} />
          <EntryDeskBays>{bays}</EntryDeskBays>
        </>
      ) : (
        bays
      )}
      {typeId === LOG_FOOD_TYPE_ID ? (
        <FoodDetailDialog
          open={foodOpen}
          onOpenChange={setFoodOpen}
          anchor={anchor}
          entries={foods}
          onOpenEntry={(id) => {
            const row = useTimeTrackingStore.getState().entries.find((entry) => entry.id === id)
            if (row) {
              setFocusId(row.id)
              setClockOpen(true)
            }
          }}
        />
      ) : null}
    </>
  )
}
