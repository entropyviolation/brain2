import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TimeGrid } from "./time-grid"
vi.mock("@/lib/weather-client", async (o) => ({ ...(await o<any>()), fetchDayClimate: vi.fn().mockResolvedValue(null) }))
describe("repro", () => {
  for (const est of [false, true]) for (const pen of [null, "act-work"]) it(`est=${est} pen=${pen}`, () => {
    resetAllStores()
    const s = useTimeTrackingStore.getState()
    s.setSelectedPen(pen as any); s.setGridStep(5)
    s.paintMinutes("2026-06-20", "activity", 600, 660, "act-work", [], undefined, est ? "estimated" : undefined)
    render(<TimeGrid currentDate={new Date("2026-06-20T12:00:00")} />)
    const cell = document.querySelector('[data-minute="620"]') as HTMLElement
    fireEvent.mouseDown(cell); fireEvent.mouseUp(window)
    const e = useTimeTrackingStore.getState().entries
    console.log(est, pen, e.length, document.querySelectorAll('[role="dialog"]').length)
  })
})
