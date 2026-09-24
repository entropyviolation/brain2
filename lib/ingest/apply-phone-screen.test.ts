import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { applyScreenTimeEntries } from "@/lib/screentime/sync"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { TimeEntry } from "@/lib/time-entries"
import { applyIphoneScreen } from "./apply-phone-screen"

const NOW = new Date(2026, 8, 21, 17, 42, 0)
const DATE = formatLocalDateKey(NOW)

beforeEach(() => {
  resetAllStores()
})

describe("applyIphoneScreen", () => {
  it("paints iPhone Screen Time, not Mac Screen Time or Activity", () => {
    const result = applyIphoneScreen("Instagram 30m", NOW)
    expect(result.status).toBe("ok")
    if (result.status === "ok") expect(result.reply).toMatch(/iPhone: Instagram/)

    const phone = useTimeTrackingStore.getState().entriesFor(DATE, "iphone-screentime")
    expect(phone).toHaveLength(1)
    expect(phone[0].penId).toBe("iphone-st-app-instagram")
    expect(phone[0].precision).toBe("estimated")
    expect(phone[0].generatedBy).toBeUndefined()
    expect(phone[0].startMin).toBe(17 * 60 + 12)
    expect(phone[0].endMin).toBe(17 * 60 + 42)

    expect(useTimeTrackingStore.getState().entriesFor(DATE, "screentime")).toEqual([])
    expect(useTimeTrackingStore.getState().entriesFor(DATE, "activity")).toEqual([])
    expect(useTimeTrackingStore.getState().activeScopeId).toBe("activity")
  })

  it("creates a hashed app pen under an iPhone category root", () => {
    applyIphoneScreen("Instagram", NOW)
    const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === "iphone-screentime")
    const pen = scope?.pens.find((p) => p.id === "iphone-st-app-instagram")
    expect(pen?.name).toBe("Instagram")
    expect(pen?.parentId).toBe("iphone-st-cat-other")
    expect(pen?.color).toBeTruthy()
    expect(scope?.pens.some((p) => p.id === "st-app-instagram")).toBe(false)
  })

  it("survives Mac ActivityWatch replace of generatedBy screentime", () => {
    applyIphoneScreen("Safari 20m", NOW)
    const phone = useTimeTrackingStore.getState().entriesFor(DATE, "iphone-screentime")
    expect(phone).toHaveLength(1)

    const aw: TimeEntry = {
      id: "st-te-mac",
      date: DATE,
      scopeId: "screentime",
      penId: "st-app-safari",
      startMin: 600,
      endMin: 660,
      generatedBy: { kind: "screentime", id: DATE },
      precision: "estimated",
    }
    const next = applyScreenTimeEntries(useTimeTrackingStore.getState().entries, DATE, [aw])
    expect(next.find((e) => e.id === phone[0].id)).toEqual(phone[0])
    expect(next.some((e) => e.generatedBy?.kind === "screentime" && e.scopeId === "screentime")).toBe(true)
    expect(next.filter((e) => e.scopeId === "iphone-screentime")).toHaveLength(1)
    expect(next.filter((e) => e.scopeId === "activity")).toEqual([])
  })
})
