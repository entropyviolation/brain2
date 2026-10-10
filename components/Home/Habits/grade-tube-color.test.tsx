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
    expect(document.querySelector(".hab-grade-sheet-crt")?.textContent).not.toMatch(/avg|ordinary/)
    const line = document.querySelector(".hab-grade-sheet-hero-line")
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
    expect(document.querySelector(".hab-grade-sheet-crt")?.textContent).not.toMatch(/avg/)
    expect(document.querySelector(".hab-grade-sheet-hero-line")).toHaveTextContent(
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
    expect(document.querySelector(".hab-grade-sheet-hero-line")).toHaveTextContent(
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
    const evenLine = document.querySelector(".hab-grade-sheet-hero-line")
    expect(evenLine).toHaveTextContent("same as avg 33% across weeks")
    expect(evenLine?.textContent).not.toMatch(/[▲▼]/)
    even.unmount()

    const outputOff = render(
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
        usePriority={false}
      />,
    )
    expect(document.querySelector(".hab-grade-sheet-crt-value")).toHaveTextContent("68%")
    expect(document.querySelector(".hab-grade-sheet-crt")?.textContent).not.toMatch(/ordinary/)
    expect(document.querySelector(".hab-grade-sheet-blend")).toBeNull()
    outputOff.unmount()

    const outputBelow = render(
      <OutputGradeBreakdownDialog
        open
        onOpenChange={() => {}}
        result={{ ...outputResult, grade: 70, rawGrade: 70 }}
        onToleranceChange={() => {}}
        usePriority
        priorityScore={50}
      />,
    )
    expect(document.querySelector(".hab-grade-sheet-crt-value")).toHaveTextContent("60%")
    expect(document.querySelector(".hab-grade-sheet-crt")?.textContent).not.toMatch(/ordinary|Priority/)
    const blend = document.querySelector(".hab-grade-sheet-blend")
    expect(blend).toHaveTextContent("Priority blend, from 70%")
    expect(document.querySelector(".hab-grade-sheet-crt")?.contains(blend)).toBe(false)
    outputBelow.unmount()

    const outputEven = render(
      <OutputGradeBreakdownDialog
        open
        onOpenChange={() => {}}
        result={{ ...outputResult, grade: 70, rawGrade: 70, curveBonus: 1 }}
        onToleranceChange={() => {}}
        usePriority
        priorityScore={70}
      />,
    )
    const outputEvenLine = document.querySelector(".hab-grade-sheet-blend")
    expect(outputEvenLine).toHaveTextContent("Priority blend, same 70%")
    expect(outputEvenLine?.textContent).not.toMatch(/[▲▼]|ordinary/)
    expect(document.querySelector(".hab-grade-sheet-crt")?.contains(outputEvenLine)).toBe(false)
    outputEven.unmount()
  })

  it("pins the week list under the figure and keeps the floor control beside the switch", () => {
    render(
      <GradeBreakdownDialog
        open
        onOpenChange={() => {}}
        periodUnit="week"
        result={{
          grade: 46,
          rawGrade: 33,
          daysIncluded: 2,
          tolerance: 75,
          curveBonus: 25,
          days: [
            {
              date: new Date(2026, 8, 7, 12),
              dateKey: "2026-09-07",
              raw: 0,
              curved: 0,
            },
            {
              date: new Date(2026, 8, 14, 12),
              dateKey: "2026-09-14",
              raw: 67,
              curved: 92,
            },
          ],
        }}
        onToleranceChange={() => {}}
        onUsePriorityChange={() => {}}
        usePriority={false}
      />,
    )

    const hero = document.querySelector(".hab-grade-sheet-hero")
    const proof = document.querySelector(".hab-grade-sheet-proof")
    const curve = screen.getByText("Curve")
    const plasma = screen.getByText("Plasma")
    expect(hero).toBeTruthy()
    expect(proof).toBeTruthy()
    expect(hero!.compareDocumentPosition(proof!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(proof!.compareDocumentPosition(curve) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(curve.compareDocumentPosition(plasma) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const scroll = document.querySelector(".hab-grade-sheet-proof-scroll")
    const average = document.querySelector(".hab-grade-sheet-row.is-avg")
    expect(scroll?.contains(average)).toBe(false)
    expect(scroll!.compareDocumentPosition(average!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    expect(screen.getByRole("columnheader", { name: "Week of" })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "Sep 7" })).toBeInTheDocument()
    expect(screen.queryByText(/w\/c/)).not.toBeInTheDocument()
    expect(document.querySelector(".hab-grade-sheet-eq p")?.textContent?.replace(/\s+/g, " ").trim()).toMatch(
      /^Sep 7 0\b/,
    )
    expect(screen.getByRole("button", { name: "How the 50% floor works" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /the ledger/i })).not.toBeInTheDocument()
    expect(document.querySelector(".hab-grade-sheet-crt")?.textContent).not.toMatch(/ordinary/)
    expect(document.querySelector(".hab-grade-sheet-blend")).toBeNull()

    const raw = document.querySelector(".hab-grade-sheet-row-readout.is-raw")
    const curved = document.querySelector(".hab-grade-sheet-row-readout.is-curved")
    expect(raw).toHaveTextContent("0%")
    expect(raw).not.toHaveClass("is-curved")
    expect(curved).toHaveTextContent("0%")
    expect(curved).toHaveClass("is-curved")
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
