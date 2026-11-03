import { describe, expect, it } from "vitest"
import { checkReadings, driveAsks, driveBoard, driveSources, feelingWindows, foldLevels, readDrive, taskKey, type DriveReading } from "./drive"
import type { ModelCall } from "./ollama"

const D = 86_400_000
const NOW = Date.parse("2026-10-30T12:00:00")
const rd = (task: string, pole: DriveReading["pole"], strength: number, daysAgo: number, reason = ""): DriveReading => {
  const at = new Date(NOW - daysAgo * D).toISOString()
  return { id: `${task}${pole}${daysAgo}`, at, date: at.slice(0, 10), task, pole, strength, reason, quote: "q", source: "bim" }
}

describe("drive score", () => {
  it("moves halfway to a new reading and fades with a 10 day half-life", () => {
    const f = foldLevels([rd("tax", "resistance", 10, 0)], NOW)
    expect(f.now.resistance).toBe(5)
    const later = foldLevels([rd("tax", "resistance", 10, 10)], NOW)
    expect(later.now.resistance).toBeCloseTo(2.5, 1)
  })
  it("pulls net toward excitement when a newer line is excited", () => {
    const [row] = driveBoard([rd("garlic confit", "resistance", 8, 9, "messy"), rd("garlic confit", "excitement", 9, 0, "new recipe")], NOW)
    expect(row!.pull).toBeGreaterThan(0)
    expect(row!.why).toEqual({ resistance: "messy", excitement: "new recipe" })
    expect(row!.series).toHaveLength(2)
    expect(row!.trend).toBeGreaterThan(0)
  })
  it("merges two phrasings of one task", () => {
    expect(taskKey("emailing the landlord")).toBe(taskKey("email landlord"))
    expect(driveBoard([rd("email landlord", "resistance", 3, 1), rd("emailing the landlord", "resistance", 3, 0)], NOW)).toHaveLength(1)
  })
})

describe("finding feeling", () => {
  const text = "Slept ok. Taxes are due and I keep putting off the taxes. The forms are confusing. Then lunch. Then a walk. Really excited to finish the BIM flow tonight!"
  it("keeps the sentences with feeling and their neighbours", () => {
    const w = feelingWindows(text)
    expect(w).toHaveLength(2)
    expect(w[0]).toContain("forms are confusing")
    expect(w.join(" ")).not.toContain("Then lunch")
  })
  it("drops readings whose quote is not in the text, or with no task", () => {
    const src = { id: "s", at: "2026-10-30T09:00:00", text, source: "bim" }
    const raw = { readings: [
      { task: "file taxes", pole: "resistance", strength: 4, reason: "forms are confusing", quote: "keep putting off the taxes" },
      { task: "gym", pole: "excitement", strength: 3, reason: "", quote: "love the gym" },
      { task: "", pole: "excitement", strength: 3, reason: "", quote: "Really excited" },
    ] }
    const got = checkReadings(raw, src)
    expect(got.map((g) => g.task)).toEqual(["file taxes"])
  })
  it("reads only the feeling windows, and nothing when there are none", async () => {
    let seen = ""
    const call: ModelCall = async ({ user }) => { seen = user; return { readings: [] } }
    expect(await readDrive({ id: "a", at: "2026-10-30T09:00:00", text: "Ate pasta. Walked.", source: "bim" }, call)).toEqual([])
    expect(seen).toBe("")
    await readDrive({ id: "b", at: "2026-10-30T09:00:00", text, source: "bim" }, call, ["file taxes"])
    expect(seen).toContain("KNOWN TASKS: file taxes")
    expect(seen).not.toContain("Then lunch")
  })
  it("lists only texts that carry a cue", () => {
    const got = driveSources({ history: { feed: [{ at: "2026-10-30T09:00:00", text: "dreading the dentist call tomorrow" }, { at: "2026-10-30T10:00:00", text: "made pasta for lunch today" }], logs: [], dayNotes: [] } })
    expect(got).toHaveLength(1)
  })
})

describe("asking", () => {
  it("asks about mixed, unexplained, stale and never-read tasks, in that order", () => {
    const rows = driveBoard([
      rd("a mixed", "resistance", 8, 1, "x"), rd("a mixed", "excitement", 8, 0, "y"),
      rd("big dread", "resistance", 9, 0),
      rd("old one", "resistance", 6, 20, "z"),
    ], NOW)
    const asks = driveAsks(rows, ["Call dentist", "big dread"], NOW)
    expect(asks.map((a) => [a.task, a.why])).toEqual([["a mixed", "mixed"], ["big dread", "no reason"], ["old one", "stale"], ["Call dentist", "no reading"]])
    expect(asks[0]!.question).toContain("1–10")
  })
})
