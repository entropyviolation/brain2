/**
 * lib/plan-text.ts — stamped plan-entry log
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  appendPlanEntry,
  formatPlanEntry,
  formatPlanLog,
  formatPlanStamp,
  getPlanBodies,
  getPlanDraft,
  getPlanEntries,
  getPlanTextViewMode,
  getStoredPlanText,
  savePlanDraft,
  saveStoredPlanText,
  setPlanTextViewMode,
  sortPlanEntriesNewestFirst,
  weekPeriodKeyAliases,
} from "./plan-text"
import { pickPersistItem } from "./vault-guard.js"

function at(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0)
}

describe("plan-text", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(at(2026, 9, 20, 21))
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it("stamps a compact writing time", () => {
    expect(formatPlanStamp(at(2026, 9, 20, 21).toISOString())).toBe("9/20 9pm")
    expect(formatPlanStamp(at(2026, 9, 20, 21, 17).toISOString())).toBe("9/20 9:17pm")
    expect(formatPlanStamp(at(2025, 9, 20, 21).toISOString())).toBe("9/20/25 9pm")
    expect(formatPlanStamp(null)).toBe("earlier")
  })

  it("appends immutable entries newest-first with the writing time", () => {
    const first = appendPlanEntry("day", "2026-09-21", "work really hard on BRAIN2")
    vi.setSystemTime(at(2026, 9, 21, 7))
    appendPlanEntry("day", "2026-09-21", "go on a walk\ndrink coffee")

    const entries = getPlanEntries("day", "2026-09-21")
    expect(entries).toHaveLength(2)
    expect(entries[0].text).toBe("work really hard on BRAIN2")
    expect(sortPlanEntriesNewestFirst(entries)[0].text).toBe("go on a walk\ndrink coffee")
    expect(formatPlanEntry(first!)).toMatch(/^9\/20 9pm - work really hard on BRAIN2$/)

    const log = getStoredPlanText("day", "2026-09-21")
    expect(log).toContain("9/21 7am - go on a walk")
    expect(log).toContain("drink coffee")
    expect(log).toContain("9/20 9pm - work really hard on BRAIN2")
    expect(log!.indexOf("go on a walk")).toBeLessThan(log!.indexOf("work really hard on BRAIN2"))
  })

  it("does not persist empty submits", () => {
    expect(appendPlanEntry("day", "2026-09-21", "   \n  ")).toBeNull()
    expect(getPlanEntries("day", "2026-09-21")).toEqual([])
    expect(getStoredPlanText("day", "2026-09-21")).toBeNull()
  })

  it("migrates a legacy plaintext blob as one earlier entry", () => {
    localStorage.setItem("weekPlan-2026-W25", "Ship feature")
    expect(getPlanEntries("week", "2026-W25")).toEqual([{ id: "legacy", createdAt: null, text: "Ship feature" }])
    expect(getStoredPlanText("week", "2026-W25")).toBe("earlier - Ship feature")
    expect(getPlanBodies("week", "2026-W25")).toBe("Ship feature")
  })

  it("keeps week and month logs on their own keys", () => {
    saveStoredPlanText("week", "2026-W38", "week focus")
    saveStoredPlanText("month", "2026-09", "month focus")
    expect(getPlanBodies("week", "2026-W38")).toBe("week focus")
    expect(getPlanBodies("month", "2026-09")).toBe("month focus")
    expect(JSON.parse(localStorage.getItem("weekPlan-2026-W38")!).entries).toHaveLength(1)
  })

  it("heals an empty month key and restores a brain2- prefixed leftover", () => {
    localStorage.setItem("monthPlan-2026-09", "")
    localStorage.setItem("brain2-monthPlan-2026-09", "historical September plan")
    expect(getPlanBodies("month", "2026-09")).toBe("historical September plan")
    expect(JSON.parse(localStorage.getItem("monthPlan-2026-09")!).entries[0].text).toBe("historical September plan")
  })

  it("migrates an unpadded month key onto YYYY-MM", () => {
    localStorage.setItem("monthPlan-2026-9", "September goals")
    expect(getPlanBodies("month", "2026-09")).toBe("September goals")
    expect(getPlanEntries("month", "2026-9")[0]?.text).toBe("September goals")
    expect(JSON.parse(localStorage.getItem("monthPlan-2026-09")!).entries[0].text).toBe("September goals")
  })

  it("migrates an ISO week key onto the Monday–Sunday range used by Plan", () => {
    localStorage.setItem("weekPlan-2026-W25", "Ship feature")
    const range = weekPeriodKeyAliases("2026-W25").find((key) => key.includes("_"))
    expect(range).toBeTruthy()
    expect(getPlanBodies("week", range!)).toBe("Ship feature")
    expect(localStorage.getItem(`weekPlan-${range}`)).toBeTruthy()
  })

  it("does not let an empty monthPlan tombstone hide a saved draft after hub hydrate", () => {
    localStorage.setItem("monthPlan-2026-09", "")
    savePlanDraft("month", "2026-09", "type this month plan")
    expect(getPlanDraft("month", "2026-09")).toBe("type this month plan")
    const local = localStorage.getItem("monthPlan-2026-09")
    const chosen = pickPersistItem(local, "", "monthPlan-2026-09")
    if (typeof chosen === "string" && chosen !== local) localStorage.setItem("monthPlan-2026-09", chosen)
    expect(getPlanDraft("month", "2026-09")).toBe("type this month plan")
    expect(localStorage.getItem("monthPlan-2026-09")).not.toBe("")
  })

  it("does not keep a submitted paragraph as the composer draft", () => {
    localStorage.setItem(
      "monthPlan-2026-09",
      JSON.stringify({
        v: 1,
        entries: [
          {
            id: "al_sep",
            createdAt: "2026-10-06T22:24:17.404Z",
            text: "Plan for september",
          },
        ],
        draft: "Plan for september ",
      }),
    )
    expect(getPlanDraft("month", "2026-09")).toBe("")
    expect(getPlanEntries("month", "2026-09")).toHaveLength(1)
    expect(getPlanEntries("month", "2026-09")[0]?.text).toBe("Plan for september")
  })

  it("clears the composer draft when that text is submitted", () => {
    savePlanDraft("month", "2026-09", "Focus on shipping ")
    appendPlanEntry("month", "2026-09", "Focus on shipping ")
    expect(getPlanEntries("month", "2026-09")[0]?.text).toBe("Focus on shipping")
    expect(getPlanDraft("month", "2026-09")).toBe("")
    expect(JSON.parse(localStorage.getItem("monthPlan-2026-09")!).draft).toBeUndefined()
  })

  it("keeps an unsubmitted draft that is not already in the log", () => {
    appendPlanEntry("month", "2026-09", "already filed")
    savePlanDraft("month", "2026-09", "still writing this month")
    expect(getPlanDraft("month", "2026-09")).toBe("still writing this month")
    expect(getPlanEntries("month", "2026-09")).toHaveLength(1)
  })

  it("does not refill the composer with the stamped list of submitted entries", () => {
    const text = "ASTROLOGICAL MONTH PREDICTIONS AND NOTES:\n\nOctober body"
    appendPlanEntry("month", "2026-10", text, new Date("2026-10-06T22:07:00.000Z"))
    const entries = getPlanEntries("month", "2026-10")
    savePlanDraft("month", "2026-10", formatPlanLog(entries, "all"))
    expect(getPlanDraft("month", "2026-10")).toBe("")
    expect(getPlanEntries("month", "2026-10")[0]?.text).toBe(text)
  })

  it("restores a draft that mentions a time but is not a submitted entry", () => {
    appendPlanEntry("day", "2026-09-21", "filed earlier")
    const draft = "9/21 4:14pm - plan for literally rn rn: do as many daily tasks as possible"
    savePlanDraft("day", "2026-09-21", draft)
    expect(getPlanDraft("day", "2026-09-21")).toBe(draft)
    expect(getPlanEntries("day", "2026-09-21")).toHaveLength(1)
  })

  it("keeps an unsubmitted month/week/day draft on the same period key across reload", () => {
    savePlanDraft("month", "2026-09", "type this month plan")
    savePlanDraft("week", "2026-W38", "type this week plan")
    savePlanDraft("day", "2026-09-21", "type this day plan")
    expect(getPlanDraft("month", "2026-09")).toBe("type this month plan")
    expect(getPlanDraft("week", "2026-W38")).toBe("type this week plan")
    expect(getPlanDraft("day", "2026-09-21")).toBe("type this day plan")
    expect(getPlanEntries("month", "2026-09")).toEqual([])
    expect(JSON.parse(localStorage.getItem("monthPlan-2026-09")!).draft).toBe("type this month plan")
  })

  it("formats list vs latest dumps", () => {
    appendPlanEntry("day", "2026-09-21", "first")
    vi.setSystemTime(at(2026, 9, 21, 11))
    appendPlanEntry("day", "2026-09-21", "second")
    const entries = getPlanEntries("day", "2026-09-21")
    expect(formatPlanLog(entries, "latest")).toBe("9/21 11am - second")
    expect(formatPlanLog(entries, "all")).toContain("9/20 9pm - first")
  })

  it("remembers the list/bulk/latest view", () => {
    expect(getPlanTextViewMode()).toBe("list")
    setPlanTextViewMode("bulk")
    expect(getPlanTextViewMode()).toBe("bulk")
    setPlanTextViewMode("latest")
    expect(getPlanTextViewMode()).toBe("latest")
  })

  it("shows a day entry written through appendPlanEntry to every reader of that date", () => {
    appendPlanEntry("day", "2026-10-06", "orchard")
    expect(getPlanEntries("day", "2026-10-06").map((entry) => entry.text)).toEqual(["orchard"])
    expect(getPlanBodies("day", "2026-10-06")).toBe("orchard")
    expect(getStoredPlanText("day", "2026-10-06")).toContain("orchard")
  })

  it("keeps week, month, and season keys off the day key", () => {
    const day = "2026-10-06"
    appendPlanEntry("day", day, "day line")
    appendPlanEntry("week", "2026-10-05_2026-10-11", "week line")
    appendPlanEntry("month", "2026-10", "month line")
    appendPlanEntry("quarter", "2026-Q4", "season line")

    expect(getPlanBodies("day", day)).toBe("day line")
    expect(getPlanBodies("week", "2026-10-05_2026-10-11")).toBe("week line")
    expect(getPlanBodies("month", "2026-10")).toBe("month line")
    expect(getPlanBodies("quarter", "2026-Q4")).toBe("season line")
    expect(getPlanEntries("week", day)).toEqual([])
    expect(getPlanEntries("month", day)).toEqual([])
    expect(getPlanEntries("quarter", day)).toEqual([])
    expect(getPlanBodies("day", "2026-10-05_2026-10-11")).toBeNull()
    expect(localStorage.getItem(`dayPlan-${day}`)).toContain("day line")
    expect(localStorage.getItem(`weekPlan-${day}`)).toBeNull()
    expect(localStorage.getItem(`monthPlan-${day}`)).toBeNull()
    expect(localStorage.getItem(`quarterPlan-${day}`)).toBeNull()
  })
})
