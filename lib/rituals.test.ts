/**
 * lib/rituals.test.ts — Ritual slots + available/undone board
 */
import { describe, expect, it } from "vitest"
import type { PeriodReview } from "./types"
import {
  countAvailableRituals,
  endRitualPhase,
  formatRitualsBoard,
  listAvailableRituals,
  listRitualSlots,
  startRitualPhase,
} from "./rituals"

const NOW = new Date("2026-06-20T12:00:00")

function emptyEnd(period: PeriodReview["period"], key: string, extra: Partial<PeriodReview> = {}): PeriodReview {
  return {
    id: `${period}:${key}`,
    period,
    periodKey: key,
    completedAt: NOW,
    summary: "",
    gratitude: [],
    nextPlans: "",
    reflections: {},
    resolvedTaskIds: [],
    pushedTaskIds: [],
    ...extra,
  }
}

describe("endRitualPhase", () => {
  it("treats legacy empty end saves as done", () => {
    expect(endRitualPhase(emptyEnd("day", "2026-06-19"))).toBe("done")
  })

  it("does not treat morning-only shells as end done", () => {
    expect(
      endRitualPhase(
        emptyEnd("day", "2026-06-19", {
          morning: { completed: true, wakeTime: "07:00" },
        }),
      ),
    ).toBe("none")
  })

  it("respects endCompleted", () => {
    expect(endRitualPhase(emptyEnd("week", "2026-W24", { endCompleted: true }))).toBe("done")
    expect(
      endRitualPhase(emptyEnd("week", "2026-W24", { endCompleted: false, summary: "hi" })),
    ).toBe("partial")
  })
})

describe("startRitualPhase", () => {
  it("reads completed flag and legacy content", () => {
    expect(startRitualPhase(undefined)).toBe("none")
    expect(startRitualPhase({ completed: false, priorities: "A" })).toBe("partial")
    expect(startRitualPhase({ completed: true })).toBe("done")
    expect(startRitualPhase({ mustDo: "ship" })).toBe("done")
  })
})

describe("listAvailableRituals", () => {
  it("lists morning, night, starts, and ends when empty", () => {
    const slots = listAvailableRituals([], NOW)
    expect(slots.some((s) => s.kind === "day-morning")).toBe(true)
    expect(slots.some((s) => s.kind === "day-night" && s.telegramCommand === "gn")).toBe(true)
    expect(slots.some((s) => s.kind === "period-start" && s.period === "week")).toBe(true)
    expect(slots.some((s) => s.kind === "period-end" && s.period === "week")).toBe(true)
    expect(countAvailableRituals([], NOW)).toBe(slots.length)
  })

  it("drops completed morning from available", () => {
    const reviews = [
      emptyEnd("day", "2026-06-20", {
        morning: { completed: true, wakeTime: "07:00" },
      }),
    ]
    const open = listAvailableRituals(reviews, NOW)
    expect(open.some((s) => s.kind === "day-morning")).toBe(false)
    expect(open.some((s) => s.kind === "day-night" && s.periodKey === "2026-06-20")).toBe(true)
  })
})

describe("formatRitualsBoard", () => {
  it("names Telegram commands and app paths", () => {
    const board = formatRitualsBoard([], NOW)
    expect(board).toContain("Rituals board")
    expect(board).toContain("gm")
    expect(board).toContain("gn")
    expect(board).toContain("ritual start week")
    expect(board).toContain("Header → Rituals")
    expect(board).toContain("Available / undone")
  })

  it("lists every slot", () => {
    const slots = listRitualSlots([], NOW)
    expect(slots.length).toBeGreaterThan(8)
  })
})
