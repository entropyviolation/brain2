/**
 * components/Home/Tracking/tracking-log/open-log-entry.test.ts
 */
import { beforeEach, describe, expect, it } from "vitest"
import { OPEN_ITEM_POPUP_EVENT } from "@/lib/points-ledger-nav"
import { trackingItemId } from "@/lib/tracking-lists"
import { useTaskStore } from "@/lib/task-store"
import { TIMEBLOCK_TYPE_ID } from "@/lib/timeblock-types"
import { resetAllStores } from "@/tests/test-utils"
import { submitTrackingLog } from "@/components/Home/Tracking/tracking-log-model"
import { isLogItemDetailType } from "@/components/ItemDetail/type-views/LogItemDetail"
import { openLogEntry } from "./open-log-entry"

describe("openLogEntry", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("files the log pointer and opens that item", () => {
    const entryId = submitTrackingLog({
      date: "2026-06-20",
      title: "left room",
      mode: "event",
      clock: "exact",
      minute: 8 * 60,
    })
    expect(entryId).toBeTruthy()
    const opened: string[] = []
    const onOpen = (event: Event) => {
      opened.push((event as CustomEvent<{ id: string }>).detail.id)
    }
    window.addEventListener(OPEN_ITEM_POPUP_EVENT, onOpen)
    openLogEntry(entryId!)
    window.removeEventListener(OPEN_ITEM_POPUP_EVENT, onOpen)

    const itemId = trackingItemId(entryId!)
    const task = useTaskStore.getState().tasks.find((row) => row.id === itemId)
    expect(task?.type).not.toBe(TIMEBLOCK_TYPE_ID)
    expect(isLogItemDetailType(task?.type)).toBe(true)
    expect(opened).toEqual([itemId])
  })

  it("does not revive a pointer that was removed", () => {
    const entryId = submitTrackingLog({
      date: "2026-06-20",
      title: "left room",
      mode: "event",
      clock: "exact",
      minute: 9 * 60,
    })!
    openLogEntry(entryId)
    const itemId = trackingItemId(entryId)
    useTaskStore.getState().deleteTask(itemId)
    const opened: string[] = []
    const onOpen = (event: Event) => {
      opened.push((event as CustomEvent<{ id: string }>).detail.id)
    }
    window.addEventListener(OPEN_ITEM_POPUP_EVENT, onOpen)
    openLogEntry(entryId)
    window.removeEventListener(OPEN_ITEM_POPUP_EVENT, onOpen)
    expect(opened).toEqual([])
    expect(useTaskStore.getState().tasks.some((row) => row.id === itemId)).toBe(false)
    expect(useTaskStore.getState().removedTaskIds).toContain(itemId)
  })
})
