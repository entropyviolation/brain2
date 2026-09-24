import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { applyScreenTimeEntries } from "@/lib/screentime/sync"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { TimeEntry } from "@/lib/time-entries"
import { applyIphoneCall, applyIphoneText, splitPersonAndRest } from "./apply-phone-life"

const NOW = new Date(2026, 8, 21, 17, 42, 0)
const DATE = formatLocalDateKey(NOW)

beforeEach(() => {
  resetAllStores()
})

describe("splitPersonAndRest", () => {
  it("keeps a multi-word name when a duration follows", () => {
    expect(splitPersonAndRest("Jane Doe 12m", [])).toEqual({ query: "Jane Doe", rest: "12m" })
    expect(splitPersonAndRest("Mom 3:02-3:17", [])).toEqual({ query: "Mom", rest: "3:02-3:17" })
  })

  it("uses the first word as who when the rest is a text body", () => {
    expect(splitPersonAndRest("Jane on my way", [])).toEqual({ query: "Jane", rest: "on my way" })
  })
})

describe("applyIphoneCall", () => {
  it("paints iPhone Calls, not Screen Time or Activity", () => {
    const result = applyIphoneCall("Jane 12m", NOW)
    expect(result.status).toBe("ok")
    if (result.status === "ok") expect(result.reply).toMatch(/Call: Jane/)

    const calls = useTimeTrackingStore.getState().entriesFor(DATE, "iphone-calls")
    expect(calls).toHaveLength(1)
    expect(calls[0].penId).toBe("iphone-call-jane")
    expect(calls[0].precision).toBe("estimated")
    expect(calls[0].generatedBy).toBeUndefined()
    expect(calls[0].kind).toBeUndefined()
    expect(calls[0].endMin - calls[0].startMin).toBe(12)

    expect(useTimeTrackingStore.getState().entriesFor(DATE, "screentime")).toEqual([])
    expect(useTimeTrackingStore.getState().entriesFor(DATE, "iphone-screentime")).toEqual([])
    expect(useTimeTrackingStore.getState().entriesFor(DATE, "activity")).toEqual([])
    expect(useTimeTrackingStore.getState().activeScopeId).toBe("activity")
  })

  it("survives Mac ActivityWatch replace of generatedBy screentime", () => {
    applyIphoneCall("Mom 3:02-3:17", NOW)
    const calls = useTimeTrackingStore.getState().entriesFor(DATE, "iphone-calls")
    expect(calls).toHaveLength(1)

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
    expect(next.find((e) => e.id === calls[0].id)).toEqual(calls[0])
    expect(next.filter((e) => e.scopeId === "iphone-calls")).toHaveLength(1)
  })
})

describe("applyIphoneText", () => {
  it("paints an instant on iPhone Texts with the body as title", () => {
    const result = applyIphoneText("Jane on my way", NOW)
    expect(result.status).toBe("ok")
    if (result.status === "ok") expect(result.reply).toMatch(/Text: Jane — on my way/)

    const texts = useTimeTrackingStore.getState().entriesFor(DATE, "iphone-texts")
    expect(texts).toHaveLength(1)
    expect(texts[0].penId).toBe("iphone-text-jane")
    expect(texts[0].kind).toBe("instant")
    expect(texts[0].title).toBe("on my way")
    expect(texts[0].notes).toBe("on my way")
    expect(texts[0].startMin).toBe(17 * 60 + 42)
    expect(texts[0].endMin).toBe(17 * 60 + 42)
    expect(texts[0].precision).toBe("estimated")
    expect(texts[0].generatedBy).toBeUndefined()

    expect(useTimeTrackingStore.getState().entriesFor(DATE, "screentime")).toEqual([])
    expect(useTimeTrackingStore.getState().entriesFor(DATE, "activity")).toEqual([])
    expect(useTimeTrackingStore.getState().activeScopeId).toBe("activity")
  })

  it("survives Mac ActivityWatch replace", () => {
    applyIphoneText("Jane running late", NOW)
    const texts = useTimeTrackingStore.getState().entriesFor(DATE, "iphone-texts")
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
    expect(next.find((e) => e.id === texts[0].id)).toEqual(texts[0])
    expect(next.filter((e) => e.scopeId === "iphone-texts")).toHaveLength(1)
  })
})
