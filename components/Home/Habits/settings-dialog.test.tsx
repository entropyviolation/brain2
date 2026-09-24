import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { SettingsDialog } from "./settings-dialog"

const required = {
  open: true as const,
  onOpenChange: vi.fn(),
  tasks: [],
  weeklyData: {},
  onImportData: vi.fn(),
  onResetData: vi.fn(),
  accomplishmentThreshold: 80,
  accomplishmentBonus: 50,
  onAccomplishmentThresholdChange: vi.fn(),
  onAccomplishmentBonusChange: vi.fn(),
}

describe("SettingsDialog (Habits)", () => {
  it("renders settings dialog when open", () => {
    render(<SettingsDialog {...required} />)
    expect(screen.getByText("Settings")).toBeInTheDocument()
    expect(screen.getByText("Daily accomplishment")).toBeInTheDocument()
    expect(screen.getByLabelText(/Completion to feel accomplished/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Accomplishment bonus/i)).toBeInTheDocument()
    expect(screen.getByText("Theme colors")).toBeInTheDocument()
    expect(screen.getByText("Backup & restore")).toBeInTheDocument()
    expect(screen.getByText("Willpower gems")).toBeInTheDocument()
    expect(screen.getByText("Gems")).toBeInTheDocument()
    expect(screen.getByLabelText("Percent LED tint")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Change image/i })).toBeInTheDocument()
  })

  it("edits accomplishment settings", async () => {
    const user = userEvent.setup()
    const onThreshold = vi.fn()
    const onBonus = vi.fn()
    render(
      <SettingsDialog
        {...required}
        onAccomplishmentThresholdChange={onThreshold}
        onAccomplishmentBonusChange={onBonus}
      />,
    )
    await user.clear(screen.getByLabelText(/Completion to feel accomplished/i))
    await user.type(screen.getByLabelText(/Completion to feel accomplished/i), "70")
    expect(onThreshold).toHaveBeenCalled()
    await user.clear(screen.getByLabelText(/Accomplishment bonus/i))
    await user.type(screen.getByLabelText(/Accomplishment bonus/i), "25")
    expect(onBonus).toHaveBeenCalled()
  })

  it("calls onResetData when reset is confirmed", async () => {
    const user = userEvent.setup()
    const onResetData = vi.fn()
    vi.spyOn(window, "confirm").mockReturnValue(true)

    render(<SettingsDialog {...required} onResetData={onResetData} />)

    await user.click(screen.getByRole("button", { name: /Reset habits/i }))
    expect(onResetData).toHaveBeenCalledOnce()
  })
})
