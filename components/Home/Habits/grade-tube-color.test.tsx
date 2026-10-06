import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { GradeBreakdownDialog } from "./grade-breakdown-dialog"
import { OutputGradeBreakdownDialog } from "./output-grade-breakdown-dialog"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { DEFAULT_GRADE_TUBE_COLOR, DEFAULT_OUTPUT_TUBE_COLOR } from "@/lib/habit-tube"
import type { OutputGradeResult, WeekGradeResult } from "@/lib/calculations"

const weekResult: WeekGradeResult = {
  grade: 80,
  rawGrade: 80,
  daysIncluded: 1,
  days: [
    {
      date: new Date("2026-09-20T12:00:00"),
      dateKey: "2026-09-20",
      raw: 80,
      curved: 80,
    },
  ],
  tolerance: 100,
  curveBonus: 0,
}

const outputResult: OutputGradeResult = {
  grade: 70,
  rawGrade: 70,
  daysIncluded: 1,
  habits: [{ taskId: "h1", name: "Read", raw: 70, curved: 70 }],
  tolerance: 100,
  curveBonus: 0,
}

describe("grade tube color pickers", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("writes Week grade discharge color onto the store", () => {
    expect(useHabitsStore.getState().gradeTubeColor).toBe(DEFAULT_GRADE_TUBE_COLOR)
    render(
      <GradeBreakdownDialog
        open
        onOpenChange={() => {}}
        result={weekResult}
        onToleranceChange={() => {}}
      />,
    )
    fireEvent.change(screen.getByLabelText("Week grade tube color"), {
      target: { value: "#aabbcc" },
    })
    expect(useHabitsStore.getState().gradeTubeColor).toBe("#aabbcc")
  })

  it("shows the average week grade across weeks with data beside the current grade", () => {
    render(
      <GradeBreakdownDialog
        open
        onOpenChange={() => {}}
        result={{ ...weekResult, grade: 41, rawGrade: 41 }}
        onToleranceChange={() => {}}
        weekAverage={62.4}
      />,
    )
    expect(document.querySelector(".hab-grade-sheet-crt-value")).toHaveTextContent("41%")
    const line = document.querySelector(".hab-grade-sheet-crt-ordinary")
    expect(line).toHaveTextContent("▼ 21 from avg 62% across weeks")
    expect(line).toHaveAttribute("title", "Average week grade across all weeks with data")
    expect(line?.textContent).not.toMatch(/ordinary/)
  })

  it("states the whole-point gap with a stock triangle when above, below, or equal", () => {
    const { unmount } = render(
      <GradeBreakdownDialog
        open
        onOpenChange={() => {}}
        result={{ ...weekResult, grade: 76, rawGrade: 40 }}
        onToleranceChange={() => {}}
        weekAverage={33}
      />,
    )
    expect(document.querySelector(".hab-grade-sheet-crt")).toHaveTextContent("76%")
    expect(document.querySelector(".hab-grade-sheet-crt-ordinary")).toHaveTextContent(
      "▲ 43 from avg 33% across weeks",
    )
    unmount()

    const below = render(
      <GradeBreakdownDialog
        open
        onOpenChange={() => {}}
        result={{ ...weekResult, grade: 31, rawGrade: 31 }}
        onToleranceChange={() => {}}
        weekAverage={33}
      />,
    )
    expect(document.querySelector(".hab-grade-sheet-crt-ordinary")).toHaveTextContent(
      "▼ 2 from avg 33% across weeks",
    )
    below.unmount()

    const even = render(
      <GradeBreakdownDialog
        open
        onOpenChange={() => {}}
        result={{ ...weekResult, grade: 33, rawGrade: 33 }}
        onToleranceChange={() => {}}
        weekAverage={33}
      />,
    )
    const evenLine = document.querySelector(".hab-grade-sheet-crt-ordinary")
    expect(evenLine).toHaveTextContent("same as avg 33% across weeks")
    expect(evenLine?.textContent).not.toMatch(/[▲▼]/)
    even.unmount()

    const outputBelow = render(
      <OutputGradeBreakdownDialog
        open
        onOpenChange={() => {}}
        result={{
          ...outputResult,
          grade: 68,
          rawGrade: 70,
          curveBonus: 2,
          habits: [{ taskId: "h1", name: "Read", raw: 70, curved: 68 }],
        }}
        onToleranceChange={() => {}}
      />,
    )
    expect(document.querySelector(".hab-grade-sheet-crt-value")).toHaveTextContent("68%")
    expect(document.querySelector(".hab-grade-sheet-crt-ordinary")).toHaveTextContent(
      "▼ 2 from ordinary 70%",
    )
    outputBelow.unmount()

    const outputEven = render(
      <OutputGradeBreakdownDialog
        open
        onOpenChange={() => {}}
        result={{ ...outputResult, grade: 70, rawGrade: 70, curveBonus: 1 }}
        onToleranceChange={() => {}}
      />,
    )
    const outputEvenLine = document.querySelector(".hab-grade-sheet-crt-ordinary")
    expect(outputEvenLine).toHaveTextContent("same as ordinary 70%")
    expect(outputEvenLine?.textContent).not.toMatch(/[▲▼]/)
    outputEven.unmount()
  })

  it("writes Perfect output discharge color onto the store", () => {
    expect(useHabitsStore.getState().outputGradeTubeColor).toBe(DEFAULT_OUTPUT_TUBE_COLOR)
    render(
      <OutputGradeBreakdownDialog
        open
        onOpenChange={() => {}}
        result={outputResult}
        onToleranceChange={() => {}}
      />,
    )
    fireEvent.change(screen.getByLabelText("Perfect output tube color"), {
      target: { value: "#cc44aa" },
    })
    expect(useHabitsStore.getState().outputGradeTubeColor).toBe("#cc44aa")
  })
})
