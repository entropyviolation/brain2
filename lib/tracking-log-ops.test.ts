import { beforeEach, describe, expect, it } from "vitest"
import { classifyLogBookRow, type LogBookList } from "@/components/Home/Tracking/tracking-log-model"
import { useKitchenStore } from "@/lib/kitchen-store"
import { useTaskStore } from "@/lib/task-store"
import type { TimeEntry } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { LOG_TYPE_ID, THOUGHT_PROCESS_TYPE_ID } from "@/lib/tracking-item-types"
import { LOG_LIST_ID, THOUGHT_PROCESS_LIST_ID, trackingItemId } from "@/lib/tracking-lists"
import { resetAllStores } from "@/tests/test-utils"
import { duplicateLogEntry, reassignLogBookList } from "./tracking-log-ops"

const CLOCK = {
  date: "2026-04-02",
  startMin: 615,
  endMin: 615,
  clockCertainty: "estimated" as const,
}

beforeEach(() => {
  resetAllStores()
  useKitchenStore.setState({ plates: [], stock: [] })
})

function put(entry: TimeEntry): void {
  useTimeTrackingStore.setState({ entries: [...useTimeTrackingStore.getState().entries, entry] })
}

function instant(patch: Partial<TimeEntry> & Pick<TimeEntry, "id">): TimeEntry {
  return {
    ...CLOCK,
    scopeId: "activity",
    penId: "act-work",
    kind: "instant",
    title: "coffee",
    eventKind: "coffee",
    ...patch,
  }
}

function clockOf(id: string) {
  const entry = useTimeTrackingStore.getState().entries.find((row) => row.id === id)
  return {
    date: entry?.date,
    startMin: entry?.startMin,
    endMin: entry?.endMin,
    clockCertainty: entry?.clockCertainty,
  }
}

function shelf(id: string): LogBookList | null {
  const entry = useTimeTrackingStore.getState().entries.find((row) => row.id === id)
  if (!entry) return null
  const pen = useTimeTrackingStore
    .getState()
    .scopes.find((scope) => scope.id === entry.scopeId)
    ?.pens.find((row) => row.id === entry.penId)?.name
  return classifyLogBookRow(entry, pen)?.list ?? null
}

describe("reassignLogBookList", () => {
  it("moves across shelves without changing the logged clock", () => {
    put(instant({ id: "e1" }))
    const targets: LogBookList[] = ["food", "drink", "drug", "intake", "note", "thought", "spend", "switch", "event"]
    for (const target of targets) {
      expect(reassignLogBookList("e1", target)).toBe(true)
      expect(shelf("e1")).toBe(target)
      expect(clockOf("e1")).toEqual(CLOCK)
    }
  })

  it("keeps a switch on its scope and keeps spend amounts when the shelf stays spend", () => {
    put(
      instant({
        id: "sw",
        scopeId: "location",
        penId: "loc-home",
        title: "Home → Work",
        eventKind: "switch",
        switchFrom: "Home",
        switchTo: "Work",
        clockCertainty: "unknown",
        startMin: 90,
        endMin: 90,
      }),
    )
    expect(reassignLogBookList("sw", "switch")).toBe(true)
    const kept = useTimeTrackingStore.getState().entries.find((row) => row.id === "sw")
    expect(kept).toMatchObject({
      scopeId: "location",
      switchFrom: "Home",
      switchTo: "Work",
      date: "2026-04-02",
      startMin: 90,
      clockCertainty: "unknown",
    })

    put(
      instant({
        id: "paid",
        eventKind: "spend",
        title: "tea",
        spendAmount: 250,
        spendOn: "tea",
        spendSource: "Cash",
      }),
    )
    expect(reassignLogBookList("paid", "spend")).toBe(true)
    expect(useTimeTrackingStore.getState().entries.find((row) => row.id === "paid")).toMatchObject({
      spendAmount: 250,
      spendOn: "tea",
      spendSource: "Cash",
      ...CLOCK,
    })
  })

  it("moves a thought pointer onto Log and does not restore a deleted one", () => {
    put(instant({ id: "idea", title: "open the editor" }))
    expect(reassignLogBookList("idea", "thought")).toBe(true)
    const id = trackingItemId("idea")
    expect(useTaskStore.getState().tasks.find((task) => task.id === id)).toMatchObject({
      type: THOUGHT_PROCESS_TYPE_ID,
      lists: [THOUGHT_PROCESS_LIST_ID],
    })
    expect(reassignLogBookList("idea", "event")).toBe(true)
    expect(useTaskStore.getState().tasks.filter((task) => task.id === id)).toHaveLength(1)
    expect(useTaskStore.getState().tasks.find((task) => task.id === id)).toMatchObject({
      type: LOG_TYPE_ID,
      lists: [LOG_LIST_ID],
    })
    expect(clockOf("idea")).toEqual(CLOCK)

    useTaskStore.getState().deleteTask(id)
    expect(reassignLogBookList("idea", "thought")).toBe(true)
    expect(useTaskStore.getState().tasks.some((task) => task.id === id)).toBe(false)
    expect(useTaskStore.getState().removedTaskIds).toContain(id)
  })

  it("returns false for a missing row and for an interval", () => {
    expect(reassignLogBookList("missing", "event")).toBe(false)
    put(instant({ id: "span", kind: "interval", endMin: 630 }))
    expect(reassignLogBookList("span", "note")).toBe(false)
    expect(clockOf("span").endMin).toBe(630)
  })
})

describe("duplicateLogEntry", () => {
  it("copies the clock onto a new id and keeps later title edits apart", () => {
    put(instant({ id: "src", title: "coffee", notes: "hot" }))
    const copyId = duplicateLogEntry("src")
    expect(copyId).toBeTruthy()
    expect(copyId).not.toBe("src")
    expect(clockOf(copyId!)).toEqual(CLOCK)
    expect(clockOf("src")).toEqual(CLOCK)
    useTimeTrackingStore.getState().updateEntry(copyId!, { title: "tea" })
    const rows = useTimeTrackingStore.getState().entries
    expect(rows.find((row) => row.id === "src")?.title).toBe("coffee")
    expect(rows.find((row) => row.id === copyId)?.title).toBe("tea")
    expect(rows.find((row) => row.id === "src")?.notes).toBe("hot")
    expect(trackingItemId(copyId!)).not.toBe(trackingItemId("src"))
    expect(useTaskStore.getState().tasks.some((task) => task.id === trackingItemId(copyId!))).toBe(true)
    expect(useTaskStore.getState().tasks.some((task) => task.id === trackingItemId("src"))).toBe(false)
  })

  it("reassigns only the copy and duplicates a food plate without a second stock draw", () => {
    put(instant({ id: "meal", eventKind: "intake.food", intakeClass: "food", title: "oats" }))
    useKitchenStore.setState({
      plates: [
        {
          id: "plt-meal",
          entryId: "meal",
          accepted: true,
          slot: "meal",
          mode: "single",
          lines: [{ foodId: "oats", grams: 100 }],
          fromKitchen: true,
          drawn: [{ stockId: "stk-1", amount: 40 }],
        },
      ],
      stock: [{ id: "stk-1", foodId: "oats", room: "pantry", amount: 200, unit: "g", boughtOn: "2026-04-01" }],
    })
    const copyId = duplicateLogEntry("meal", { targetList: "note" })
    expect(copyId).toBeTruthy()
    expect(shelf("meal")).toBe("food")
    expect(shelf(copyId!)).toBe("note")
    expect(clockOf(copyId!)).toEqual(clockOf("meal"))
    const plates = useKitchenStore.getState().plates
    const source = plates.find((plate) => plate.entryId === "meal")
    const copy = plates.find((plate) => plate.entryId === copyId)
    expect(copy?.id).not.toBe(source?.id)
    expect(copy?.lines).toEqual([{ foodId: "oats", grams: 100 }])
    expect(copy?.drawn).toEqual([])
    expect(source?.drawn).toEqual([{ stockId: "stk-1", amount: 40 }])
    expect(useKitchenStore.getState().stock.find((lot) => lot.id === "stk-1")?.amount).toBe(200)
    copy!.lines[0]!.grams = 5
    expect(source?.lines[0]?.grams).toBe(100)
  })

  it("returns null when the source is missing", () => {
    expect(duplicateLogEntry("missing")).toBeNull()
  })
})
