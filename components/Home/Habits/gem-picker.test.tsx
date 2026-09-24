import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { GEM_PATHS } from "@/lib/gems-manifest"
import { HabitGemChooser, HabitGemSettingsField } from "./gem-picker"

describe("HabitGemSettingsField", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("lets the user pick a gem for a slot", async () => {
    const user = userEvent.setup()
    render(<HabitGemSettingsField />)
    expect(screen.getByText("Yes/No")).toBeInTheDocument()
    await user.click(screen.getAllByRole("button", { name: /Change gem/i })[0])
    const options = screen.getAllByRole("option")
    expect(options.length).toBe(GEM_PATHS.length)
    expect(options[0].querySelector("img")?.getAttribute("loading")).toBe("lazy")
    expect(options[0].querySelector("img")?.getAttribute("decoding")).toBe("async")
    await user.click(options[0])
    expect(useHabitsStore.getState().habitGems.boolean).toBe(GEM_PATHS[0])
  })

  it("reports a catalog pick through HabitGemChooser", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<HabitGemChooser value={null} fallback={GEM_PATHS[1]} onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: /Change gem/i }))
    await user.click(screen.getAllByRole("option")[0])
    expect(onChange).toHaveBeenCalledWith(GEM_PATHS[0])
  })
})
