import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetAllStores } from "@/tests/test-utils"
import { CyclePhaseConcealed, cycleDetailsConcealed } from "./cycle-phase-concealed"

describe("cycle phase conceal gate", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("stays off the analytics canvas when cycle tracking is disabled", () => {
    expect(cycleDetailsConcealed(false, false)).toBe(false)
    expect(cycleDetailsConcealed(false, true)).toBe(false)
    expect(cycleDetailsConcealed(true, true)).toBe(false)
    expect(cycleDetailsConcealed(true, false)).toBe(true)
  })

  it("shows Show cycle and opens the shared latch", () => {
    useTimeTrackingStore.setState({ enableCycleTracking: true, cycleDetailsOpen: false })
    render(<CyclePhaseConcealed />)
    expect(screen.getByRole("button", { name: "Show cycle" })).toBeInTheDocument()
    expect(screen.getByText("Cycle details are concealed.")).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/bleeding|spotting|ovulation|menstrual|follicular|luteal/i)
    fireEvent.click(screen.getByRole("button", { name: "Show cycle" }))
    expect(useTimeTrackingStore.getState().cycleDetailsOpen).toBe(true)
  })
})
