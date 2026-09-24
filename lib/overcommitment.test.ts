/**
 * Overcommitment series + early-warning sentence.
 */
import { describe, expect, it } from "vitest"
import { OVERCOMMITMENT_SAMPLE_FLOOR, reconstructPushDates, summarizeOvercommitment } from "./overcommitment"
import type { OvercommitmentTask } from "./overcommitment"

function task(overrides: Partial<OvercommitmentTask> & { id: string }): OvercommitmentTask {
  return {
    daysPushed: 0,
    timeLogs: [],
    ...overrides,
  }
}

function keysBetween(start: string, end: string): string[] {
  const out: string[] = []
  const d = new Date(`${start}T12:00:00`)
  const last = new Date(`${end}T12:00:00`)
  while (d <= last) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    out.push(`${y}-${m}-${day}`)
    d.setDate(d.getDate() + 1)
  }
  return out
}

const WINDOW = keysBetween("2026-09-01", "2026-09-20")
const TODAY = new Date(2026, 8, 21, 12, 0, 0)

describe("reconstructPushDates", () => {
  it("places consecutive pushes on the days before the current schedule", () => {
    expect(
      reconstructPushDates(
        task({ id: "a", daysPushed: 3, scheduledDate: new Date(2026, 8, 21) }),
        TODAY,
      ),
    ).toEqual(["2026-09-20", "2026-09-19", "2026-09-18"])
  })

  it("falls back to today when there is no schedule", () => {
    expect(reconstructPushDates(task({ id: "b", daysPushed: 2 }), TODAY)).toEqual([
      "2026-09-20",
      "2026-09-19",
    ])
  })

  it("is empty when nothing was pushed", () => {
    expect(reconstructPushDates(task({ id: "c", daysPushed: 0 }), TODAY)).toEqual([])
  })
})

describe("summarizeOvercommitment", () => {
  it("is empty when the window has no pushes and no logs", () => {
    const report = summarizeOvercommitment([task({ id: "x" })], WINDOW, { today: TODAY })
    expect(report.status).toBe("empty")
    expect(report.n).toBe(0)
    expect(report.warning).toBe(false)
  })

  it("refuses a sparse week as a finding", () => {
    const report = summarizeOvercommitment(
      [
        task({
          id: "thin",
          timeLogs: [
            { id: "l1", date: "2026-09-19", durationMinutes: 40 },
            { id: "l2", date: "2026-09-20", durationMinutes: 90 },
          ],
        }),
      ],
      WINDOW,
      { today: TODAY },
    )
    expect(report.n).toBe(2)
    expect(report.n).toBeLessThan(OVERCOMMITMENT_SAMPLE_FLOOR)
    expect(report.status).toBe("thin")
    expect(report.warning).toBe(false)
  })

  it("warns when logged minutes and day-pushes are both rising", () => {
    const logs = WINDOW.map((date, i) => ({
      id: `l${i}`,
      date,
      durationMinutes: 20 + i * 15,
    }))
    const report = summarizeOvercommitment(
      [
        task({
          id: "load",
          daysPushed: 12,
          scheduledDate: new Date(2026, 8, 21),
          timeLogs: logs,
        }),
      ],
      WINDOW,
      { today: TODAY },
    )
    expect(report.status).toBe("ok")
    expect(report.n).toBeGreaterThanOrEqual(OVERCOMMITMENT_SAMPLE_FLOOR)
    expect(report.minutesTrend.direction).toBe("rising")
    expect(report.pushTrend.direction).toBe("rising")
    expect(report.warning).toBe(true)
    expect(report.sentence).toMatch(/overcommitment early warning/)
    expect(report.sentence).not.toMatch(/reschedule/)
    expect(report.pushedTaskIds).toEqual(["load"])
    expect(report.loggedTaskIds).toEqual(["load"])
  })

  it("stays quiet when both series are falling", () => {
    const logs = WINDOW.map((date, i) => ({
      id: `l${i}`,
      date,
      durationMinutes: 200 - i * 8,
    }))
    const report = summarizeOvercommitment(
      [
        task({
          id: "ease",
          timeLogs: logs,
        }),
      ],
      WINDOW,
      { today: TODAY },
    )
    expect(report.status).toBe("ok")
    expect(report.warning).toBe(false)
    expect(report.minutesTrend.direction).toBe("falling")
    expect(report.sentence).toMatch(/^No overcommitment signal/)
  })

  it("sums minutes per day across tasks and clips pushes to the window", () => {
    const report = summarizeOvercommitment(
      [
        task({
          id: "a",
          timeLogs: [{ id: "1", date: "2026-09-10", durationMinutes: 30 }],
        }),
        task({
          id: "b",
          timeLogs: [{ id: "2", date: "2026-09-10", durationMinutes: 15 }],
          daysPushed: 40,
          scheduledDate: new Date(2026, 8, 21),
        }),
      ],
      ["2026-09-10"],
      { today: TODAY },
    )
    expect(report.minutes[0].value).toBe(45)
    expect(report.pushes[0].value).toBe(1)
    expect(report.n).toBe(1)
  })
})
