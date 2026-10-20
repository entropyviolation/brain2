import { describe, expect, it } from "vitest"
import {
  answerPlacement,
  currentItem,
  loadPlacementBank,
  placementResult,
  seededRandom,
  startPlacement,
  type PlacementBank,
  type PlacementState,
} from "@/lib/language-study/placement"
import { CEFR_LEVELS, type CefrLevel } from "@/lib/widgets/language-levels"
import { VOCAB_LANGS } from "@/lib/vocab-words"

/** Answer right through `upTo` and wrong above it. */
function play(state: PlacementState, upTo: CefrLevel | null): PlacementState {
  let s = state
  for (let guard = 0; guard < 100 && !s.done; guard++) {
    const item = currentItem(s)!
    const knows = upTo !== null && CEFR_LEVELS.indexOf(item.level) <= CEFR_LEVELS.indexOf(upTo)
    s = answerPlacement(s, knows ? item.answer : (item.answer + 1) % item.choices.length)
  }
  return s
}

describe("placement banks", () => {
  it.each(VOCAB_LANGS)("%s has five well-formed questions per level", async (lang) => {
    const bank = await loadPlacementBank(lang)
    expect(bank.lang).toBe(lang)
    const ids = new Set<string>()
    for (const level of CEFR_LEVELS) {
      const mine = bank.questions.filter((q) => q.level === level)
      expect(mine.length, `${lang} ${level}`).toBe(5)
    }
    for (const q of bank.questions) {
      expect(ids.has(q.id), q.id).toBe(false)
      ids.add(q.id)
      expect(q.id.startsWith(`${lang}-${q.level.toLowerCase()}-`), q.id).toBe(true)
      expect(q.choices).toHaveLength(4)
      expect(new Set(q.choices).size, q.id).toBe(4)
      expect(q.why.length, q.id).toBeGreaterThan(0)
      if (q.skill === "listening") expect(q.passage, q.id).toBeTruthy()
    }
  })
})

describe("placement ladder", () => {
  let bank: PlacementBank
  const fresh = async (start?: CefrLevel) => {
    bank ??= await loadPlacementBank("fr")
    return startPlacement(bank, { start, random: seededRandom(7) })
  }

  it("shuffles options but keeps the answer pointing at the right one", async () => {
    const s = await fresh()
    const item = currentItem(s)!
    const source = bank.questions.find((q) => q.id === item.id)!
    expect(item.choices[item.answer]).toBe(source.choices[0])
  })

  it("places at the highest level passed", async () => {
    const r = placementResult(play(await fresh(), "B1"))
    expect(r.level).toBe("B1")
    expect(r.belowA1).toBe(false)
    expect(r.byLevel.B1).toEqual([4, 4])
    expect(r.byLevel.C1).toEqual([0, 0])
  })

  it("ends a stage early once a pass is out of reach", async () => {
    const r = placementResult(play(await fresh(), "A2"))
    expect(r.level).toBe("A2")
    expect(r.byLevel.B1).toEqual([0, 2])
  })

  it("places at C2 when everything is right", async () => {
    const r = placementResult(play(await fresh(), "C2"))
    expect(r.level).toBe("C2")
    expect(r.total).toBe(24)
  })

  it("marks below A1 when nothing passes", async () => {
    const r = placementResult(play(await fresh(), null))
    expect(r.level).toBe("A1")
    expect(r.belowA1).toBe(true)
  })

  it("steps down from a high start until a stage passes", async () => {
    const s = play(await fresh("C1"), "A2")
    expect(s.failed).toEqual(["C1", "B2", "B1"])
    expect(placementResult(s).level).toBe("A2")
  })

  it("climbs from a high start that passes", async () => {
    const s = play(await fresh("B2"), "C1")
    expect(s.passed).toEqual(["B2", "C1"])
    expect(placementResult(s).level).toBe("C1")
  })
})
