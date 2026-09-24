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
