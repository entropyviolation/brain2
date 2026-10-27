import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { chineseEncyclopedia } from "@/lib/cycle-lens-chinese"
import { clinicalReference } from "@/lib/cycle-lens-clinical"
import { setCycleFlag } from "@/lib/cycle-marks"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetAllStores } from "@/tests/test-utils"
import { CycleDetailDialog } from "./cycle-detail-dialog"
import { resetLogCycleMarks } from "./tracking-log-model"

function otherDayInMonth(today: Date): string {
  const day = today.getDate() === 1 ? 2 : 1
  return formatLocalDateKey(new Date(today.getFullYear(), today.getMonth(), day))
}

describe("CycleDetailDialog", () => {
  beforeEach(() => {
    resetAllStores()
    resetLogCycleMarks()
  })

  it("keeps the today dot when another day is selected", () => {
    const now = new Date()
    const today = formatLocalDateKey(now)
    const other = otherDayInMonth(now)
    render(<CycleDetailDialog date={today} onClose={() => {}} />)

    expect(screen.getAllByRole("grid")).toHaveLength(4)
    const todayCell = screen.getByTestId(`cycle-day-${today}`)
    expect(todayCell).toHaveAttribute("data-today", "true")
    expect(todayCell).toHaveAttribute("aria-pressed", "true")
    expect(todayCell).not.toHaveAttribute("data-basis")

    fireEvent.click(screen.getByTestId(`cycle-day-${other}`))
    expect(screen.getByTestId(`cycle-day-${today}`)).toHaveAttribute("data-today", "true")
    expect(screen.getByTestId(`cycle-day-${today}`)).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByTestId(`cycle-day-${other}`)).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByTestId(`cycle-day-${other}`)).not.toHaveAttribute("data-today")
    expect(screen.getByTestId("cycle-lens-line")).toHaveTextContent("not a diagnosis")
    fireEvent.click(screen.getByRole("button", { name: "Extra detail" }))
    expect(screen.getByRole("heading", { name: clinicalReference[0].title })).toBeInTheDocument()
    expect(screen.queryByText(/Apple Watch/i)).not.toBeInTheDocument()
  })

  it("shows each lens as headed sections", () => {
    const today = formatLocalDateKey(new Date())
    render(<CycleDetailDialog date={today} onClose={() => {}} />)
    expect(screen.getByText("Estimated")).toBeInTheDocument()
    expect(screen.queryByTestId("cycle-estimate")).not.toBeInTheDocument()
    expect(screen.getByTestId("cycle-basis-note")).toBeInTheDocument()
    expect(screen.queryByTestId("cycle-ovulation-note")).not.toBeInTheDocument()
    expect(screen.queryByText(/Apple Watch/i)).not.toBeInTheDocument()
    expect(document.body.textContent ?? "").toContain("Physiology")
    expect(screen.getByRole("button", { name: "Extra detail" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: clinicalReference[0].title })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Extra detail" }))
    expect(screen.getByRole("heading", { name: clinicalReference[0].title })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Hide extra detail" })).toBeInTheDocument()
    expect(screen.queryByRole("img", { name: /Five phases/ })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Physiology" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Worth not doing" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Chinese medicine" }))
    expect(screen.getByRole("heading", { name: "The phase" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Physiology" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: clinicalReference[0].title })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: chineseEncyclopedia[0].title })).toBeInTheDocument()
    expect(screen.getByTestId("cycle-lens-body")).toHaveTextContent(/bleed history/i)

    fireEvent.click(screen.getByRole("button", { name: "Esoteric" }))
    expect(screen.getByRole("heading", { name: "The season" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: clinicalReference[0].title })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: chineseEncyclopedia[0].title })).not.toBeInTheDocument()

    setCycleFlag(today, "bleeding", true)
    fireEvent.click(screen.getByRole("button", { name: "Clinical" }))
    expect(screen.getByTestId("cycle-detail-phase")).toHaveTextContent("Menstrual")
    expect(screen.getByTestId("cycle-detail-phase")).toHaveAttribute("data-phase", "menstrual")
    expect(screen.getByRole("heading", { name: "Physiology" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "What's typical" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Worth doing" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Worth not doing" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: clinicalReference[0].title })).toBeInTheDocument()
    expect(screen.getByTestId("cycle-lens-body")).toHaveTextContent(/estradiol/i)
    expect(screen.getByText(/Marked: Bleeding/)).toBeInTheDocument()
    expect(screen.queryByTestId("cycle-estimate")).not.toBeInTheDocument()
  })

  it("hides the cycle and unmounts from the open dialog", () => {
    const today = formatLocalDateKey(new Date())
    const onClose = vi.fn()
    useTimeTrackingStore.setState({ cycleDetailsOpen: true })
    render(<CycleDetailDialog date={today} onClose={onClose} />)

    fireEvent.click(screen.getByRole("button", { name: "Hide cycle" }))
    expect(useTimeTrackingStore.getState().cycleDetailsOpen).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("finds in the open reading from Cmd+F", () => {
    const today = formatLocalDateKey(new Date())
    render(<CycleDetailDialog date={today} onClose={() => {}} />)

    const event = new KeyboardEvent("keydown", {
      key: "f",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    act(() => {
      window.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)

    const input = screen.getByRole("textbox", { name: "Find in cycle reading" })
    expect(input).toHaveFocus()
    fireEvent.change(input, { target: { value: "physiology" } })

    const marks = document.querySelectorAll("mark.trk-cycle-find-mark")
    expect(marks.length).toBeGreaterThan(1)
    expect(screen.getByTestId("cycle-find-count")).toHaveTextContent(`1 of ${marks.length}`)
    expect(document.querySelector("mark[data-current='true']")).toHaveAttribute("data-find-index", "0")
    expect(screen.getByRole("heading", { name: "Physiology" })).toBeInTheDocument()

    fireEvent.keyDown(input, { key: "Enter" })
    expect(document.querySelector("mark[data-current='true']")).toHaveAttribute("data-find-index", "1")
    expect(screen.getByTestId("cycle-find-count")).toHaveTextContent(`2 of ${marks.length}`)

    fireEvent.change(input, { target: { value: "" } })
    expect(document.querySelectorAll("mark.trk-cycle-find-mark")).toHaveLength(0)

    fireEvent.change(input, { target: { value: "physiology" } })
    fireEvent.click(screen.getByRole("button", { name: "Chinese medicine" }))
    expect(input).toHaveValue("physiology")
  })

  it("hatches an estimated day and names the guess", () => {
    setCycleFlag("2026-01-01", "bleeding", true)
    setCycleFlag("2026-02-01", "bleeding", true)
    render(<CycleDetailDialog date="2026-01-20" onClose={() => {}} />)

    expect(screen.getByTestId("cycle-day-2026-01-20")).toHaveAttribute("data-basis", "estimated")
    expect(screen.getByTestId("cycle-day-2026-01-01")).not.toHaveAttribute("data-basis")
    expect(screen.getByTestId("cycle-estimate")).toHaveTextContent(/Estimated/)
    expect(screen.getByTestId("cycle-estimate")).toHaveTextContent(/Confidence/)
  })
})