import { beforeEach, describe, expect, it } from "vitest"
import { APP_NAV_KEYS, APP_TABS, readStoredDate, readStoredTab } from "@/lib/app-navigation"
import { closeTaskCard, openTaskCard, useTaskCardStore } from "@/lib/task-card"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetAllStores } from "@/tests/test-utils"
import { showBlockInTimegrid } from "./show-in-timegrid"
import { peekTimegridReveal, resetTimegridReveal, timegridBlockHour, timegridHourScrollTop } from "./timegrid-reveal"

beforeEach(() => {
  resetAllStores()
  resetTimegridReveal()
  closeTaskCard()
})

describe("timegrid reveal math", () => {
  it("picks the hour that holds the minute and parks it under the ruler", () => {
    expect(timegridBlockHour(15 * 60 + 30)).toBe(15)
    expect(timegridBlockHour(-4)).toBe(0)
    expect(timegridBlockHour(24 * 60)).toBe(23)
    expect(timegridHourScrollTop(15, 24, 15 * 24, 28)).toBe(15 * 24 - 28)
    expect(timegridHourScrollTop(15, 24, null, 0)).toBe(15 * 24)
    expect(timegridHourScrollTop(0, 24, 10, 28)).toBe(0)
  })
})

describe("showBlockInTimegrid", () => {
  it("does nothing when the block id is missing", () => {
    useTimeTrackingStore.getState().setGridSpan("week")
    showBlockInTimegrid("")
    expect(peekTimegridReveal()).toBeNull()
    expect(useTimeTrackingStore.getState().gridSpan).toBe("week")
  })

  it("opens Home Tracking's day grid on that block, even from another view and day", () => {
    useTimeTrackingStore.getState().setGridSpan("week")
    useTimeTrackingStore.getState().setInfiniteScroll(true)
    useTimeTrackingStore.getState().paintMinutes("2026-09-17", "activity", 9 * 60, 10 * 60, "act-work")
    useTimeTrackingStore.getState().paintMinutes("2026-09-17", "mood", 15 * 60, 16 * 60, "mood-meh")
    const mood = useTimeTrackingStore.getState().entriesFor("2026-09-17", "mood")[0]
    const earlier = useTimeTrackingStore.getState().entriesFor("2026-09-17", "activity")[0]
    openTaskCard("task-1")

    showBlockInTimegrid(mood.id)

    expect(peekTimegridReveal()).toEqual({
      entryId: mood.id,
      date: "2026-09-17",
      scopeId: "mood",
      startMin: 15 * 60,
    })
    expect(peekTimegridReveal()?.entryId).not.toBe(earlier.id)
    expect(useTimeTrackingStore.getState().activeScopeId).toBe("mood")
    expect(useTimeTrackingStore.getState().gridSpan).toBe("day")
    expect(useTimeTrackingStore.getState().infiniteScroll).toBe(false)
    expect(useTaskCardStore.getState().taskId).toBeNull()
    expect(readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "analytics")).toBe("home")
    expect(readStoredTab(APP_NAV_KEYS.homeTab, ["habits", "plan", "todo", "goals", "tracking"], "habits")).toBe(
      "tracking",
    )
    expect(readStoredTab(APP_NAV_KEYS.homeTrackingTab, ["grid", "activity", "daylog", "log"], "activity")).toBe("grid")
    const pinned = readStoredDate(APP_NAV_KEYS.homeDate)
    expect(pinned?.getFullYear()).toBe(2026)
    expect(pinned?.getMonth()).toBe(8)
    expect(pinned?.getDate()).toBe(17)
  })
})
