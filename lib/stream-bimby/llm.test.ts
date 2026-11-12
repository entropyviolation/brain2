import { describe, expect, it } from "vitest"
import { filingsFromModel, withCoverage } from "./llm"
import { pieces } from "./parse"

const TEXT = `8:17 hit dab pen once
8:17 - 9:15 doing dishes
coffee around 9:15 add to drinks tracking
Gonna eat the samosa, maybe watch a video.
Thinking very positive and proud of myself.`
const NOW = new Date(2026, 10, 9, 13, 57)
const { pieces: ps } = pieces(TEXT, NOW)

describe("filingsFromModel", () => {
  it("builds the grammar line from the model's route, payload and time", () => {
    const { filed, dropped } = filingsFromModel(
      { filings: [
        { route: "count", payload: "dab pen", time: "08:17", source: "8:17 hit dab pen once", reason: "tap" },
        { route: "activity", payload: "dishes", time: "08:17", end: "09:15", source: "8:17 - 9:15 doing dishes" },
        { route: "drink", payload: "coffee", time: "09:15", est: true, source: "coffee around 9:15 add to drinks tracking" },
      ] },
      ps,
    )
    expect(dropped).toEqual([])
    expect(filed.map((f) => f.filing.line)).toEqual(["log: dab pen at 08:17", "track: dishes 08:17-09:15", "intake drink: coffee at 09:15 est"])
    expect(filed[0]!.filing.reasoning).toMatch(/\(model\)$/)
  })
  it("drops a filing whose source is not in the text, and an unknown route", () => {
    const { filed, dropped } = filingsFromModel(
      { filings: [
        { route: "food", payload: "pizza", time: "10:00", source: "I ate pizza at ten" },
        { route: "dance", payload: "x", source: "8:17 hit dab pen once" },
      ] },
      ps,
    )
    expect(filed).toEqual([])
    expect(dropped).toHaveLength(2)
  })
  it("takes the time from the piece when the model gives none, and files an activity with no end as a note", () => {
    const { filed } = filingsFromModel({ filings: [{ route: "activity", payload: "scrolling", time: "", source: "8:17 hit dab pen once" }] }, ps)
    expect(filed[0]!.filing.line).toBe("note: scrolling at 08:17")
  })
  it("takes an activity's end from its window when the model leaves it out", () => {
    const { filed } = filingsFromModel({ filings: [{ route: "activity", payload: "dishes", time: "08:17", source: "8:17 - 9:15 doing dishes" }] }, ps)
    expect(filed[0]!.filing.line).toBe("track: dishes 08:17-09:15")
  })
  it("strips a leading count from a food payload", () => {
    const { filed } = filingsFromModel({ filings: [{ route: "food", payload: "1 samosa", time: "09:19", source: "coffee around 9:15 add to drinks tracking" }] }, ps)
    expect(filed[0]!.filing.line).toBe("intake food: samosa at 09:19")
  })
  it("rejects a link with no web address", () => {
    const { filed, dropped } = filingsFromModel({ filings: [{ route: "link", payload: "my blog", source: "8:17 hit dab pen once" }] }, ps)
    expect(filed).toEqual([])
    expect(dropped[0]).toMatch(/no web address/)
  })
})

describe("withCoverage", () => {
  it("files the rules' line for any piece the model skipped", () => {
    const { filed } = filingsFromModel({ filings: [{ route: "count", payload: "dab pen", time: "08:17", source: "8:17 hit dab pen once" }] }, ps)
    const { filed: all, backfilled } = withCoverage(filed, ps)
    expect(backfilled).toBe(ps.length - 1)
    expect(all).toHaveLength(ps.length)
    expect(all.map((f) => f.piece.index)).toEqual([...all.map((f) => f.piece.index)].sort((a, b) => a - b))
  })
})
