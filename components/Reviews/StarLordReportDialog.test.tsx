/**
 * components/Reviews/StarLordReportDialog.test.tsx
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { StarLordReportDialog } from "./StarLordReportDialog"
import { useStarLordStore } from "@/lib/star-lord-store"
import { usePointsStore } from "@/lib/points-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"

describe("Star Lord Report dialog", () => {
  beforeEach(() => {
    useStarLordStore.setState({ reports: [] })
    usePointsStore.setState({ pointsHistory: [] })
    useUserSettingsStore.setState({ ritualSectionPoints: 10, ritualCompletionBonus: 30 })
  })

  it("saves a new-moon report and awards a section plus the bonus", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<StarLordReportDialog open kind="new" dateKey="1977-02-18" onClose={onClose} />)

    expect(screen.getByRole("dialog")).toHaveAttribute("data-ui-name", "Star Lord Report")
    expect(screen.getByText("Emptying the vessel")).toBeInTheDocument()
    expect(screen.getByText(/At home, in a quiet room/)).toBeInTheDocument()
    expect(screen.getByLabelText(/old patterns that clutter my spirit/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/foundational energy/i)).toBeInTheDocument()
    expect(screen.getByText(/May my actions flow like water/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/old patterns/i), "a crowded desk")
    await user.click(screen.getByRole("button", { name: "Save Star Lord Report" }))

    expect(onClose).toHaveBeenCalled()
    const saved = useStarLordStore.getState().reports.find((row) => row.id === "new:1977-02-18")
    expect(saved?.completed).toBe(true)
    expect(saved?.answers.guarded).toBe("a crowded desk")
    expect(usePointsStore.getState().pointsHistory).toEqual([
      expect.objectContaining({
        taskId: "ritual:star-lord:new:1977-02-18",
        points: 40,
        date: "1977-02-18",
      }),
    ])
  })
})
