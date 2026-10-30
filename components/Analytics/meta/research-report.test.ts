import { describe, expect, it } from "vitest"
import { buildResearchReport, type ResearchReportInput } from "./research-report"

const today = new Date(2026, 9, 9)

function emptyInput(): ResearchReportInput {
  return {
    windowLabel: "last 30 days",
    habitDays: [],
    habitMetDates: [],
    today,
    trackingDays: [],
    sleepNights: [],
    metrics: [],
    weekGrade: null,
    plannedMinutes: null,
    trackedMinutes: null,
    phoneStamped: 0,
    otherRows: 0,
    gratitude: [],
    whyNotes: [],
  }
}

describe("buildResearchReport", () => {
  it("includes a habit-day section when one day stands off the median", () => {
    const habitDays = ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"].map(
      (date, index) => ({ date, value: index === 6 ? 100 : 40 }),
    )
    const report = buildResearchReport({
      ...emptyInput(),
      habitDays,
      habitMetDates: ["2026-10-07", "2026-10-08", "2026-10-09"],
      gratitude: [{ date: "2026-10-09", lines: 4, sample: "the walk home" }],
    })
    expect(report.sections.map((section) => section.id)).toContain("habit-day")
    expect(report.sections.find((section) => section.id === "habit-day")?.n).toMatch(/n = 7/)
    expect(report.sections.map((section) => section.id)).toContain("streak")
    expect(report.sections.map((section) => section.id)).toContain("gratitude")
    expect(report.sections.map((section) => section.id)).not.toContain("sleep-night")
    expect(report.leftOutBecause).toContain("no sleep nights in the window")
    expect(report.lede).toMatch(/last 30 days/)
  })

  it("leaves an empty window out of the report", () => {
    const report = buildResearchReport(emptyInput())
    expect(report.sections).toEqual([])
    expect(report.leftOutBecause).toContain("no habit days in the window")
    expect(report.leftOutBecause).toContain("no sleep nights in the window")
    expect(report.leftOutBecause).toContain("no gratitude lines")
    expect(report.lede).toMatch(/Nothing in this window/)
  })
})
