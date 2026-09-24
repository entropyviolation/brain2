/**
 * lib/ingest/apply-ritual.test.ts — Morning GM + skip helpers
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { localDayKey, useReviewsStore } from "@/lib/reviews-store"
import { useSleepStore } from "@/lib/sleep-store"
import { advanceRitual, isRitualSkip, startMorningReview, type RitualDraft } from "./apply-ritual"
import type { ApplyResult, PendingClarify } from "./types"

const NOW = new Date(2026, 8, 21, 18, 48, 0)

beforeEach(() => {
  resetAllStores()
})

function pendingOf(result: ApplyResult): PendingClarify & { ritual: RitualDraft } {
  if (result.status !== "needs_clarify") throw new Error("expected needs_clarify")
  return result.pending as PendingClarify & { ritual: RitualDraft }
}

function runMorning(answers: string[], now = NOW): ApplyResult {
  let result = startMorningReview(now)
  for (const answer of answers) {
    if (result.status !== "needs_clarify") break
    result = advanceRitual(pendingOf(result), answer, now)
  }
  return result
}

describe("isRitualSkip", () => {
  it("recognizes skip tokens and blank", () => {
    expect(isRitualSkip("")).toBe(true)
    expect(isRitualSkip("  ")).toBe(true)
    expect(isRitualSkip("skip")).toBe(true)
    expect(isRitualSkip("n/a")).toBe(true)
    expect(isRitualSkip("—")).toBe(true)
    expect(isRitualSkip("hello")).toBe(false)
  })
})

describe("startMorningReview", () => {
  it("all nighter skips sleep questions and still saves", () => {
    // all nighter → 5 affirmations → no/skip todos → skip priorities → skip circumstances → skip best → skip gratitude
    const answers = [
      "all nighter",
      "ok",
      "ok",
      "ok",
      "ok",
      "ok",
      "skip",
      "skip",
      "skip",
      "skip",
      "skip",
    ]
    const result = runMorning(answers)
    expect(result.status).toBe("ok")
    expect(result.kind).toBe("morning")

    const morning = useReviewsStore.getState().getMorningReview(localDayKey(NOW))
    expect(morning?.allNighter).toBe(true)
    expect(morning?.source).toBe("telegram")
    expect(morning?.affirmations?.length).toBe(5)
    expect(useSleepStore.getState().nights[localDayKey(NOW)]?.allNighter).toBe(true)
  })

  it("stores an answered dream when not an all-nighter", () => {
    const answers = [
      "skip", // bed
      "skip", // wake
      "flying over the bay", // dream
      "ok",
      "ok",
      "ok",
      "ok",
      "ok", // 5 affirmations
      "skip", // todos
      "skip", // priorities
      "skip", // circumstances
      "skip", // best day
      "skip", // gratitude
    ]
    const result = runMorning(answers)
    expect(result.status).toBe("ok")

    const morning = useReviewsStore.getState().getMorningReview(localDayKey(NOW))
    expect(morning?.dream).toBe("flying over the bay")
    expect(morning?.allNighter).toBeFalsy()
  })
})
