/**
 * lib/ingest/apply-ritual.test.ts — Morning GM + skip helpers
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { localDayKey, useReviewsStore } from "@/lib/reviews-store"
import { useSleepStore } from "@/lib/sleep-store"
import { advanceRitual, isRitualSkip, startMorningReview, startNightRitual, startPeriodReview, startReviewsBoard, type RitualDraft } from "./apply-ritual"
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
      "skip", // todos
      "skip", // required
      "skip", // priorities
      "skip", // habits
      "skip", // day plan
      "skip", // circumstances
      "skip", // best day
      "skip", // gratitude
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
      "skip", // required
      "skip", // priorities
      "skip", // habits
      "skip", // day plan
      "skip", // circumstances
      "skip", // best day
      "skip", // gratitude
    ]
    const result = runMorning(answers)
    expect(result.status).toBe("ok")

    const morning = useReviewsStore.getState().getMorningReview(localDayKey(NOW))
    expect(morning?.dream).toBe("flying over the bay")
    expect(morning?.allNighter).toBeFalsy()
    expect(morning?.completed).toBe(true)
  })

  it("saves the one answered question and leaves the skipped ones open", () => {
    let result = startMorningReview(NOW)
    result = advanceRitual(pendingOf(result), "skip", NOW)
    result = advanceRitual(pendingOf(result), "skip", NOW)
    result = advanceRitual(pendingOf(result), "flying over the bay", NOW)
    expect(result.status).toBe("needs_clarify")
    result = advanceRitual(pendingOf(result), "STOP", NOW)
    expect(result.status).toBe("ok")
    if (result.status === "ok") expect(result.reply).toMatch(/STOP|saved/i)

    const morning = useReviewsStore.getState().getMorningReview(localDayKey(NOW))
    expect(morning?.dream).toBe("flying over the bay")
    expect(morning?.completed).toBe(false)
    expect(morning?.bedTime).toBeUndefined()
    expect(morning?.wakeTime).toBeUndefined()
    expect(morning?.bestDayWhy).toBeUndefined()
    expect(morning?.gratitude).toBeUndefined()
    expect(morning?.resumeStep).toBe("affirmation")
  })

  it("lets gm start over, continue, or jump when answers already exist", () => {
    let result = startMorningReview(NOW)
    result = advanceRitual(pendingOf(result), "23:30", NOW)
    result = advanceRitual(pendingOf(result), "STOP", NOW)
    expect(result.status).toBe("ok")

    result = startMorningReview(NOW)
    expect(result.status).toBe("needs_clarify")
    if (result.status !== "needs_clarify") return
    expect(result.reply).toMatch(/1 start over/)
    expect(result.reply).toMatch(/2 continue/)
    expect(result.reply).toMatch(/3 jump/)
    expect(result.reply).toMatch(/STOP/)

    result = advanceRitual(pendingOf(result), "2", NOW)
    expect(result.status).toBe("needs_clarify")
    if (result.status !== "needs_clarify") return
    expect(result.reply).toMatch(/Wake time/i)

    result = advanceRitual(pendingOf(result), "STOP", NOW)
    result = startMorningReview(NOW)
    result = advanceRitual(pendingOf(result), "3", NOW)
    expect(result.reply).toMatch(/Jump to which question/)
    result = advanceRitual(pendingOf(result), "3", NOW)
    expect(result.status).toBe("needs_clarify")
    if (result.status !== "needs_clarify") return
    expect(result.reply).toMatch(/Dream/i)

    const kept = useReviewsStore.getState().getMorningReview(localDayKey(NOW))
    expect(kept?.bedTime).toBe("23:30")
  })
})

describe("rituals board + night + start", () => {
  it("rituals board lists available slots and how to open them", () => {
    const result = startReviewsBoard(NOW)
    expect(result.status).toBe("ok")
    expect(result.reply).toMatch(/Rituals board/)
    expect(result.reply).toMatch(/gm/)
    expect(result.reply).toMatch(/gn/)
    expect(result.reply).toMatch(/ritual start week/)
    expect(result.reply).toMatch(/Header → Rituals/)
  })

  it("gn opens today's night ritual", () => {
    const result = startNightRitual(NOW)
    expect(result.status).toBe("needs_clarify")
    if (result.status !== "needs_clarify") return
    expect(result.pending?.ritual?.flow).toBe("period")
    expect(result.pending?.ritual?.period).toBe("day")
    expect(result.pending?.ritual?.periodKey).toBe(localDayKey(NOW))
    expect(result.reply).toMatch(/Unfinished|No unfinished/)
  })

  it("ritual start week opens a start flow", () => {
    const result = startPeriodReview("start week", NOW)
    expect(result.status).toBe("needs_clarify")
    if (result.status !== "needs_clarify") return
    expect(result.pending?.ritual?.flow).toBe("start")
    expect(result.pending?.ritual?.period).toBe("week")
    expect(result.reply).toMatch(/Undone|priorities|Nothing undone/i)
  })

  it("saves a start ritual after the walk", () => {
    let result = startPeriodReview("start week", NOW)
    const answers = ["skip", "Ship core", "Must demo", "skip", "Focus", "Write plan", "health\nfriends"]
    for (const answer of answers) {
      if (result.status !== "needs_clarify") break
      result = advanceRitual(result.pending!, answer, NOW)
    }
    expect(result.status).toBe("ok")
    const weekStart = useReviewsStore.getState().reviews.find((r) => r.period === "week" && r.start)
    expect(weekStart?.start?.completed).toBe(true)
    expect(weekStart?.start?.priorities).toBe("Ship core")
    expect(weekStart?.start?.mustDo).toBe("Must demo")
    expect(weekStart?.start?.source).toBe("telegram")
  })
})
