import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

const nodeRequire = createRequire(import.meta.url)

type TextsReport = {
  textsHome: (env?: Record<string, string | undefined>) => string
  textsPort: (env?: Record<string, string | undefined>) => number
  lastWeekClose: (now: Date) => Date
  weeklyRunDue: (lastRunISO: string | null | undefined, now?: Date) => boolean
}
const texts = nodeRequire("./texts-report.js") as TextsReport

describe("texts report home and port", () => {
  it("defaults to ~/texts-analysis on 8765", () => {
    expect(texts.textsHome({})).toBe(path.join(os.homedir(), "texts-analysis"))
    expect(texts.textsPort({})).toBe(8765)
  })

  it("reads COGS_TEXTS_HOME and COGS_TEXTS_PORT", () => {
    expect(texts.textsHome({ COGS_TEXTS_HOME: "~/elsewhere" })).toBe(path.join(os.homedir(), "elsewhere"))
    expect(texts.textsPort({ COGS_TEXTS_PORT: "9001" })).toBe(9001)
    expect(texts.textsPort({ COGS_TEXTS_PORT: "80" })).toBe(8765)
  })
})

describe("weekly refresh", () => {
  // Local-time constructors: the week closes Sunday 21:00 on this machine.
  const wed = new Date(2026, 9, 21, 12, 0) // Wed 21 Oct 2026
  const sunBefore = new Date(2026, 9, 25, 20, 59)
  const sunAfter = new Date(2026, 9, 25, 21, 0)

  it("finds the last Sunday 21:00", () => {
    const close = texts.lastWeekClose(wed)
    expect(close.getDay()).toBe(0)
    expect(close.getHours()).toBe(21)
    expect(close.getDate()).toBe(18)
    expect(texts.lastWeekClose(sunBefore).getDate()).toBe(18)
    expect(texts.lastWeekClose(sunAfter).getDate()).toBe(25)
  })

  it("is due with no run or a run before the close", () => {
    expect(texts.weeklyRunDue(null, wed)).toBe(true)
    expect(texts.weeklyRunDue("not a date", wed)).toBe(true)
    expect(texts.weeklyRunDue(new Date(2026, 9, 18, 20, 0).toISOString(), wed)).toBe(true)
  })

  it("is not due again until the next close", () => {
    const ran = new Date(2026, 9, 18, 21, 5).toISOString()
    expect(texts.weeklyRunDue(ran, wed)).toBe(false)
    expect(texts.weeklyRunDue(ran, sunBefore)).toBe(false)
    expect(texts.weeklyRunDue(ran, sunAfter)).toBe(true)
  })
})
