import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { setCycleFlag } from "@/lib/cycle-marks"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetAllStores } from "@/tests/test-utils"
import { CycleLogSection } from "./cycle-log-section"
import { resetLogCycleMarks } from "./tracking-log-model"

const DAY = "2026-06-20"

describe("CycleLogSection", () => {
  beforeEach(() => {
    resetAllStores()
    resetLogCycleMarks()
  })

  it("renders nothing when cycle tracking is off", () => {
    expect(useTimeTrackingStore.getState().enableCycleTracking).toBe(false)
    render(<CycleLogSection date={DAY} />)
    expect(screen.queryByRole("region", { name: "Cycle" })).not.toBeInTheDocument()
    expect(screen.queryByTestId("tracking-log-phase")).not.toBeInTheDocument()
  })

  it("switches lenses and reads a calendar day", () => {
    useTimeTrackingStore.setState({ enableCycleTracking: true })
    setCycleFlag("2026-06-18", "bleeding", true)
    render(<CycleLogSection date={DAY} />)

    expect(screen.getByTestId("tracking-log-phase")).toHaveTextContent("Phase: follicular")
    fireEvent.click(screen.getByRole("button", { name: "Bleeding" }))
    expect(screen.getByRole("button", { name: "Bleeding" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "Bleeding" }))
    expect(screen.getByRole("button", { name: "Bleeding" })).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(screen.getByRole("button", { name: "Cycle detail" }))
    expect(screen.getByTestId("cycle-day-2026-06-18")).toBeInTheDocument()
    expect(screen.getByTestId("cycle-lens-line")).toHaveTextContent("not a diagnosis")
    expect(screen.getByTestId("cycle-lens-body")).toHaveTextContent(/estradiol/i)

    fireEvent.click(screen.getByRole("button", { name: "Chinese medicine" }))
    expect(screen.getByTestId("cycle-lens-line")).toHaveTextContent("Not a prescription")
    expect(screen.getByTestId("cycle-lens-body")).toHaveTextContent("Kidney yin")
    expect(screen.getByTestId("cycle-lens-body")).not.toHaveTextContent(/estradiol/i)

    fireEvent.click(screen.getByRole("button", { name: "Esoteric" }))
    expect(screen.getByTestId("cycle-lens-line")).toHaveTextContent("not a scientific claim")
    expect(screen.getByTestId("cycle-lens-body")).toHaveTextContent("Rise")

    fireEvent.click(screen.getByTestId("cycle-day-2026-06-18"))
    expect(screen.getByTestId("cycle-detail-phase")).toHaveTextContent("Menstrual")
    expect(screen.getByTestId("cycle-lens-body")).toHaveTextContent("Retreat")
  })
})
