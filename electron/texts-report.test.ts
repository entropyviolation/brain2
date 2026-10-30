import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

const nodeRequire = createRequire(import.meta.url)

type TextsReport = {
  textsHome: (env?: Record<string, string | undefined>) => string
  textsPort: (env?: Record<string, string | undefined>) => number
  lastDayClose: (now: Date) => Date
  dailyRunDue: (lastRunISO: string | null | undefined, now?: Date) => boolean
}
const texts = nodeRequire("./texts-report.js") as TextsReport

describe("texts report home and port", () => {
  it("defaults to ~/texts-analysis on 8765", () => {
    expect(texts.textsHome({})).toBe(path.join(os.homedir(), "texts-analysis"))
    expect(texts.textsPort({})).toBe(8765)
  })

  it("reads BRAIN2_TEXTS_HOME and BRAIN2_TEXTS_PORT", () => {
    expect(texts.textsHome({ BRAIN2_TEXTS_HOME: "~/elsewhere" })).toBe(path.join(os.homedir(), "elsewhere"))
    expect(texts.textsPort({ BRAIN2_TEXTS_PORT: "9001" })).toBe(9001)
    expect(texts.textsPort({ BRAIN2_TEXTS_PORT: "80" })).toBe(8765)
  })
})

describe("daily refresh", () => {
  // Local-time constructors: the day closes at 04:00 on this machine.
  const noon = new Date(2026, 9, 21, 12, 0)
  const before = new Date(2026, 9, 22, 3, 59)
  const after = new Date(2026, 9, 22, 4, 0)

  it("finds the last 04:00", () => {
    const close = texts.lastDayClose(noon)
    expect(close.getHours()).toBe(4)
    expect(close.getDate()).toBe(21)
    expect(texts.lastDayClose(before).getDate()).toBe(21)
    expect(texts.lastDayClose(after).getDate()).toBe(22)
  })

  it("is due with no run or a run before the close", () => {
    expect(texts.dailyRunDue(null, noon)).toBe(true)
    expect(texts.dailyRunDue("not a date", noon)).toBe(true)
    expect(texts.dailyRunDue(new Date(2026, 9, 21, 3, 0).toISOString(), noon)).toBe(true)
  })

  it("is not due again until the next close", () => {
    const ran = new Date(2026, 9, 21, 9, 5).toISOString()
    expect(texts.dailyRunDue(ran, noon)).toBe(false)
    expect(texts.dailyRunDue(ran, before)).toBe(false)
    expect(texts.dailyRunDue(ran, after)).toBe(true)
  })
})
