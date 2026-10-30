import { beforeEach, describe, expect, it } from "vitest"
import { applyThoughtProcess } from "@/lib/ingest/apply-discrete-event"
import { getBuiltinItemTypes } from "@/lib/item-types"
import { createListItem } from "@/lib/item-utils"
import { paintLogInstant } from "@/components/Home/Tracking/tracking-log-model"
import { SHOWER_COUNT_ID, useCountStatusesStore } from "@/lib/count-statuses"
import { LOG_COUNT_TYPE_ID, LOG_DRINK_TYPE_ID, LOG_FOOD_TYPE_ID, LOG_NOTE_TYPE_ID } from "@/lib/log-item-types"
import { countItemId } from "@/lib/log-item-role"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { LOG_TYPE_ID, THOUGHT_PROCESS_TYPE_ID, TRACKING_ITEM_ATTR } from "@/lib/tracking-item-types"
import {
  LOG_LIST_ID,
  LOG_LIST_NAME,
  THOUGHT_PROCESS_LIST_ID,
  THOUGHT_PROCESS_LIST_NAME,
  TRACKING_FOLDER_ID,
  ensureTrackingLists,
  newCountsNeedPointers,
  newEntriesNeedPointers,
  syncTrackingLists,
  trackingItemId,
  trackingListRole,
} from "@/lib/tracking-lists"
import { resetAllStores } from "@/tests/test-utils"
import type { TimeEntry } from "@/lib/time-entries"

beforeEach(() => {
  resetAllStores()
})

function textLogPen(): string {
  return useTimeTrackingStore.getState().addPen("activity", { name: "Text log", color: "#12315c" })
}

function entry(patch: Partial<TimeEntry> & Pick<TimeEntry, "id" | "eventKind">): TimeEntry {
  return {
    date: "2026-10-24",
    scopeId: "activity",
    penId: textLogPen(),
    startMin: 600,
    endMin: 600,
    kind: "instant",
    title: "left room",
    ...patch,
  }
}

describe("tracking lists", () => {
  it("ships Thought Process and Log types", () => {
    const ids = getBuiltinItemTypes().map((type) => type.id)
    expect(ids).toContain(THOUGHT_PROCESS_TYPE_ID)
    expect(ids).toContain(LOG_TYPE_ID)
  })

  it("creates Tracking → Thought Process and Log once", () => {
    ensureTrackingLists()
    ensureTrackingLists()
    const state = useTaskStore.getState()
    expect(state.lists.filter((list) => list.name === THOUGHT_PROCESS_LIST_NAME)).toHaveLength(1)
    expect(state.lists.filter((list) => list.name === LOG_LIST_NAME)).toHaveLength(1)
    const folder = state.folders.find((row) => row.id === TRACKING_FOLDER_ID)
    expect(folder?.listIds).toEqual([THOUGHT_PROCESS_LIST_ID, LOG_LIST_ID])
    expect(state.lists.find((list) => list.id === THOUGHT_PROCESS_LIST_ID)?.itemTypeId).toBe(THOUGHT_PROCESS_TYPE_ID)
    expect(state.lists.find((list) => list.id === LOG_LIST_ID)?.itemTypeId).toBe(LOG_TYPE_ID)
  })

  it("adopts a list already named thought process", () => {
    const old = createListItem("fix the car", ["list-old-thought"])
    useTaskStore.getState().addList({
      id: "list-old-thought",
      name: "thought process",
      color: "#888",
      createdAt: new Date(),
      scheduleable: false,
    })
    useTaskStore.getState().addTask(old)
    ensureTrackingLists()
    const state = useTaskStore.getState()
    expect(state.lists.some((list) => list.id === "list-old-thought")).toBe(false)
    const item = state.tasks.find((task) => task.id === old.id)
    expect(item?.lists).toContain(THOUGHT_PROCESS_LIST_ID)
    expect(item?.type).toBe(THOUGHT_PROCESS_TYPE_ID)
    expect(state.folders.find((folder) => folder.id === TRACKING_FOLDER_ID)?.listIds).toContain(THOUGHT_PROCESS_LIST_ID)
  })

  it("files a thought process from the tracking writer and a log from the composer", () => {
    const thought = applyThoughtProcess("opening the editor\nthen the dishes", new Date(2026, 9, 24, 13, 0, 0))
    expect(thought.status).toBe("ok")
    const logged = paintLogInstant({
      date: "2026-10-24",
      title: "left room",
      target: "event",
      clock: "exact",
      minute: 14 * 60,
    })
    expect(logged).toBeTruthy()
    const intake = paintLogInstant({
      date: "2026-10-24",
      title: "coffee",
      target: "drink",
      clock: "exact",
      minute: 15 * 60,
    })
    expect(intake).toBeTruthy()
    const tasks = useTaskStore.getState().tasks
    const thoughtItem = tasks.find((task) => task.type === THOUGHT_PROCESS_TYPE_ID)
    const logItem = tasks.find((task) => task.type === LOG_TYPE_ID)
    expect(thoughtItem?.title).toBe("opening the editor")
    expect(thoughtItem?.notes).toBe("then the dishes")
    expect(thoughtItem?.lists).toContain(THOUGHT_PROCESS_LIST_ID)
    expect(logItem?.title).toBe("left room")
    expect(logItem?.lists).toContain(LOG_LIST_ID)
    const logBefore = {
      id: logItem?.id,
      type: logItem?.type,
      lists: [...(logItem?.lists ?? [])],
    }
    expect(syncTrackingLists()).toBe(2)
    expect(syncTrackingLists()).toBe(0)
    const after = useTaskStore.getState().tasks
    const drink = after.find((task) => task.id === trackingItemId(intake!))
    expect(drink?.type).toBe(LOG_DRINK_TYPE_ID)
    expect(drink?.title).toBe("coffee")
    expect(drink?.lists).toEqual([])
    expect(drink?.lists).not.toContain(LOG_LIST_ID)
    const kept = after.find((task) => task.id === logBefore.id)
    expect(kept?.type).toBe(LOG_TYPE_ID)
    expect(kept?.lists).toEqual(logBefore.lists)
    const still = useTimeTrackingStore.getState().entries.find((row) => row.id === intake)
    expect(still?.id).toBe(intake)
    expect(still?.title).toBe("coffee")
    expect(useTaskStore.getState().lists.some((list) => list.name === "Drink")).toBe(false)
  })

  it("backfills existing rows and leaves a deleted item deleted", () => {
    const pen = textLogPen()
    const kept = {
      ...createListItem("tea", [LOG_LIST_ID]),
      id: trackingItemId("te-kept"),
      type: LOG_TYPE_ID,
    }
    useTaskStore.getState().addTask(kept)
    const rows = [
      entry({ id: "te-thought", eventKind: "thought-process", title: "the strand", penId: pen }),
      entry({ id: "te-log", eventKind: "left room", title: "left room", penId: pen, generatedBy: { kind: "text", id: "2026-10-24" } }),
      entry({ id: "te-note", eventKind: undefined, title: "a note", penId: pen }),
      entry({ id: "te-food", eventKind: "intake.food", title: "soup", penId: pen, intakeClass: "food" }),
      entry({
        id: "te-kept",
        eventKind: "intake.drink",
        title: "tea",
        penId: pen,
        intakeClass: "drink",
      }),
      entry({
        id: "te-block",
        eventKind: "deep work",
        title: "deep work",
        penId: pen,
        kind: "interval",
        startMin: 600,
        endMin: 660,
      }),
    ]
    useTimeTrackingStore.setState({ entries: rows })
    expect(trackingListRole(rows[0]!)).toBe("thought-process")
    expect(trackingListRole(rows[1]!)).toBe("log")
    expect(trackingListRole(rows[2]!)).toBeNull()
    expect(trackingListRole(rows[3]!)).toBeNull()
    expect(newEntriesNeedPointers([], [rows[5]!])).toBe(false)
    expect(syncTrackingLists()).toBe(5)
    expect(syncTrackingLists()).toBe(0)
    const state = useTaskStore.getState()
    const thought = state.tasks.find((task) => task.id === trackingItemId("te-thought"))
    expect(thought?.type).toBe(THOUGHT_PROCESS_TYPE_ID)
    expect(thought?.lists).toContain(THOUGHT_PROCESS_LIST_ID)
    const note = state.tasks.find((task) => task.id === trackingItemId("te-note"))
    expect(note?.type).toBe(LOG_NOTE_TYPE_ID)
    expect(note?.lists).toEqual([])
    const food = state.tasks.find((task) => task.id === trackingItemId("te-food"))
    expect(food?.type).toBe(LOG_FOOD_TYPE_ID)
    expect(food?.lists).toEqual([])
    expect(food?.lists).not.toContain(LOG_LIST_ID)
    const existing = state.tasks.find((task) => task.id === trackingItemId("te-kept"))
    expect(existing?.type).toBe(LOG_TYPE_ID)
    expect(existing?.lists).toContain(LOG_LIST_ID)
    expect(state.tasks.some((task) => task.id === trackingItemId("te-block"))).toBe(false)
    expect(useTimeTrackingStore.getState().entries.map((row) => row.id)).toEqual(rows.map((row) => row.id))
    useTaskStore.getState().deleteTask(trackingItemId("te-log"))
    useTaskStore.getState().deleteTask(trackingItemId("te-food"))
    expect(syncTrackingLists()).toBe(0)
    const gone = useTaskStore.getState().tasks
    expect(gone.some((task) => task.id === trackingItemId("te-log"))).toBe(false)
    expect(gone.some((task) => task.id === trackingItemId("te-food"))).toBe(false)
    expect(useTimeTrackingStore.getState().entries.some((row) => row.id === "te-log")).toBe(true)
  })

  it("files a count pointer and does not recreate a removed Shower", () => {
    const countId = useCountStatusesStore.getState().addCount({ name: "joints" })
    expect(countId).toBeTruthy()
    useCountStatusesStore.getState().incrementCount(countId!, { date: "2026-10-24", startMin: 600 })
    const withTick = useCountStatusesStore.getState().counts.find((row) => row.id === countId)
    expect(withTick?.ticks).toHaveLength(1)
    expect(newCountsNeedPointers([], [{ id: countId!, name: "joints" }], false)).toBe(true)
    expect(
      newCountsNeedPointers(
        useCountStatusesStore.getState().counts,
        useCountStatusesStore.getState().counts.map((row) => ({ ...row, ticks: [...row.ticks] })),
        false,
      ),
    ).toBe(false)
    expect(syncTrackingLists()).toBe(2)
    expect(syncTrackingLists()).toBe(0)
    const joints = useTaskStore.getState().tasks.find((task) => task.id === countItemId(countId!))
    expect(joints?.type).toBe(LOG_COUNT_TYPE_ID)
    expect(joints?.title).toBe("joints")
    expect(joints?.lists).toEqual([])
    expect(joints?.attributes?.[TRACKING_ITEM_ATTR.entryId]).toBe(countId)
    expect(JSON.stringify(joints)).not.toContain("tick")
    const shower = useTaskStore.getState().tasks.find((task) => task.id === countItemId(SHOWER_COUNT_ID))
    expect(shower?.type).toBe(LOG_COUNT_TYPE_ID)
    expect(shower?.attributes?.[TRACKING_ITEM_ATTR.entryId]).toBe(SHOWER_COUNT_ID)
    useTaskStore.getState().deleteTask(countItemId(SHOWER_COUNT_ID))
    expect(syncTrackingLists()).toBe(0)
    expect(useTaskStore.getState().tasks.some((task) => task.id === countItemId(SHOWER_COUNT_ID))).toBe(false)
    useCountStatusesStore.getState().removeCount(SHOWER_COUNT_ID)
    useTaskStore.setState({ removedTaskIds: [] })
    expect(syncTrackingLists()).toBe(0)
    expect(useTaskStore.getState().tasks.some((task) => task.id === countItemId(SHOWER_COUNT_ID))).toBe(false)
    expect(useTaskStore.getState().lists.some((list) => list.name === "Count" || list.name === "Shower")).toBe(false)
  })
})
