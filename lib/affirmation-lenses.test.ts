import { beforeEach, describe, expect, it } from "vitest"
import { AFFIRMATION_BANK } from "@/lib/affirmation-bank"
import { affirmationKey, dailyAffirmationSet, findBankRow, lensText, lensesFor } from "@/lib/affirmation-lenses"
import { recitationStats, useAffirmationLogStore } from "@/lib/affirmation-log-store"

describe("affirmation lenses", () => {
  it("loads every sheet row with all columns", () => {
    expect(AFFIRMATION_BANK).toHaveLength(57)
    for (const row of AFFIRMATION_BANK) {
      expect(row.original && row.eprime && row.fr && row.it && row.es && row.higher).toBeTruthy()
      expect(row.vivid.feel && row.vivid.senses && row.vivid.sincerity).toBeTruthy()
    }
  })

  it("matches a list line to its row regardless of case and punctuation", () => {
    const row = AFFIRMATION_BANK[1]!
    expect(findBankRow(`  ${row.original.toUpperCase().replace(/[;.]/g, "")} `)).toBe(row)
    expect(findBankRow(row.eprime)).toBe(row)
    expect(lensText(row.original, "fr")).toBe(row.fr)
    expect(lensesFor(row.original)).toContain("higher")
  })

  it("leaves a line outside the bank on the Original lens", () => {
    expect(lensesFor("I am a teapot.")).toEqual(["original"])
    expect(lensText("I am a teapot.", "fr")).toBe("I am a teapot.")
  })

  it("draws the same five for the same date", () => {
    const pool = AFFIRMATION_BANK.map((r) => r.original)
    expect(dailyAffirmationSet(pool, "2026-10-16")).toEqual(dailyAffirmationSet(pool, "2026-10-16"))
    expect(new Set(dailyAffirmationSet(pool, "2026-10-16")).size).toBe(5)
  })
})

describe("affirmation log", () => {
  beforeEach(() => useAffirmationLogStore.setState({ recitations: [] }))

  it("counts today, total, days, and streak; undo drops the newest that day", () => {
    const line = "My life is just beginning."
    const { recite, undoRecite } = useAffirmationLogStore.getState()
    recite(line, "2026-10-14", "ritual")
    recite(line, "2026-10-15", "speak")
    recite(line, "2026-10-16", "widget")
    recite("my life is just beginning", "2026-10-16", "widget")
    let stats = recitationStats(useAffirmationLogStore.getState().recitations, line, "2026-10-16")
    expect(stats).toMatchObject({ total: 4, today: 2, days: 3, streak: 3 })
    undoRecite(line, "2026-10-16")
    stats = recitationStats(useAffirmationLogStore.getState().recitations, line, "2026-10-16")
    expect(stats.today).toBe(1)
    expect(affirmationKey(stats.first!.text)).toBe(affirmationKey(line))
  })
})
