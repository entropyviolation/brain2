import { beforeEach, describe, expect, it } from "vitest"
import { LOG_KEYWORDS_STORAGE_KEY, sanitizeLogKeywords, useLogKeywordsStore } from "./log-keywords-store"

describe("log keywords store", () => {
  beforeEach(() => {
    localStorage.clear()
    useLogKeywordsStore.setState({ keywords: [] })
  })

  it("starts empty and round-trips add, rename, and remove", async () => {
    expect(useLogKeywordsStore.getState().keywords).toEqual([])
    expect(LOG_KEYWORDS_STORAGE_KEY).toBe("brain2-log-keywords")

    expect(useLogKeywordsStore.getState().addKeyword("  went   outside ")).toBe(true)
    expect(useLogKeywordsStore.getState().addKeyword("drank water")).toBe(true)
    expect(useLogKeywordsStore.getState().addKeyword("Went Outside")).toBe(false)
    expect(useLogKeywordsStore.getState().addKeyword("   ")).toBe(false)
    expect(useLogKeywordsStore.getState().keywords).toEqual(["went outside", "drank water"])

    const raw = localStorage.getItem(LOG_KEYWORDS_STORAGE_KEY)
    expect(raw).toContain("went outside")
    expect(raw).toContain("drank water")

    expect(useLogKeywordsStore.getState().renameKeyword("drank water", "smoked weed")).toBe(true)
    expect(useLogKeywordsStore.getState().keywords).toEqual(["went outside", "smoked weed"])
    expect(useLogKeywordsStore.getState().removeKeyword("smoked weed")).toBeUndefined()
    expect(useLogKeywordsStore.getState().keywords).toEqual(["went outside"])

    useLogKeywordsStore.setState({ keywords: [] })
    localStorage.setItem(
      LOG_KEYWORDS_STORAGE_KEY,
      JSON.stringify({ state: { keywords: ["walked", "walked", "  "] }, version: 1 }),
    )
    await useLogKeywordsStore.persist.rehydrate()
    expect(useLogKeywordsStore.getState().keywords).toEqual(["walked"])
  })

  it("does not write cycle marks", () => {
    localStorage.setItem("brain2-cycle-marks", JSON.stringify({ state: { marks: { "2026-07-04": { bleeding: true } } } }))
    useLogKeywordsStore.getState().addKeyword("went outside")
    expect(localStorage.getItem("brain2-cycle-marks")).toContain("bleeding")
    expect(sanitizeLogKeywords(null)).toEqual([])
  })

  it("keeps countId on rename and rehydrate", async () => {
    localStorage.setItem(
      LOG_KEYWORDS_STORAGE_KEY,
      JSON.stringify({
        state: {
          keywords: [
            { phrase: "  went   outside ", countId: " steps " },
            { phrase: "   ", countId: "skip" },
            "walked",
          ],
        },
        version: 1,
      }),
    )
    await useLogKeywordsStore.persist.rehydrate()
    expect(useLogKeywordsStore.getState().keywords).toEqual([
      { phrase: "went outside", countId: "steps" },
      "walked",
    ])
    expect(useLogKeywordsStore.getState().renameKeyword("went outside", "stepped out")).toBe(true)
    expect(useLogKeywordsStore.getState().keywords[0]).toEqual({ phrase: "stepped out", countId: "steps" })
    useLogKeywordsStore.getState().removeKeyword("stepped out")
    expect(useLogKeywordsStore.getState().keywords).toEqual(["walked"])
    expect(useLogKeywordsStore.getState().addKeyword("   ")).toBe(false)
  })
})
