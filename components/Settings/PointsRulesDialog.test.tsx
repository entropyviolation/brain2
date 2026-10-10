import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { Dialog } from "@/components/ui/dialog"
import { PointAllocationField } from "@/components/Settings/PointAllocationField"
import { PointsRulesDialog } from "@/components/Settings/PointsRulesDialog"
import { useHabitsStore } from "@/lib/habits-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { resetAllStores } from "@/tests/test-utils"

function renderRules() {
  return render(
    <Dialog open>
      <PointsRulesDialog />
    </Dialog>,
  )
}

describe("Points rules dialog", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("groups the catalog and filters by section and explanation", async () => {
    const user = userEvent.setup()
    renderRules()
    expect(screen.getByRole("heading", { name: "Points rules" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Schedule" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Habits" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Lists and completion" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Goals and multipliers" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Rituals" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Reviews" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Friends" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Penalties / Regret" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Edited on the item" })).toBeInTheDocument()

    await user.type(screen.getByLabelText("Filter"), "whitespace")
    expect(screen.getByRole("heading", { name: "Reviews" })).toBeInTheDocument()
    expect(screen.getByLabelText("Quick review per word")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Inbox" })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Edited on the item" })).toBeInTheDocument()

    await user.clear(screen.getByLabelText("Filter"))
    await user.type(screen.getByLabelText("Filter"), "Penalties")
    expect(screen.getByLabelText("Empty-item daily regret")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Habits" })).not.toBeInTheDocument()
  })

  it("saves a row and Default restores that rule", async () => {
    const user = userEvent.setup()
    renderRules()
    fireEvent.change(screen.getByLabelText("Handle an inbox idea"), { target: { value: "9" } })
    expect(screen.getByLabelText("Handle an inbox idea")).toHaveValue(9)
    expect(useUserSettingsStore.getState().pointsRules["inbox.handlePoints"]).toBe(9)

    await user.click(screen.getByRole("button", { name: "Restore Handle an inbox idea" }))
    expect(screen.getByLabelText("Handle an inbox idea")).toHaveValue(1)
    expect(useUserSettingsStore.getState().pointsRules["inbox.handlePoints"]).toBeUndefined()

    fireEvent.change(screen.getByLabelText("Good day threshold"), { target: { value: "90" } })
    expect(useHabitsStore.getState().accomplishmentThreshold).toBe(90)
    await user.click(screen.getByRole("button", { name: "Restore Good day threshold" }))
    expect(useHabitsStore.getState().accomplishmentThreshold).toBe(80)
  })

  it("opens from the automatic point allocation bay", async () => {
    const user = userEvent.setup()
    render(<PointAllocationField />)
    expect(screen.getByText(/Habits → Settings/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Points rules" }))
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument()
  })
})
