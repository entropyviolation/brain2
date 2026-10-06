/**
 * Reviews / Rituals — header entry point.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { Rituals } from "./reviews"
import { useUserSettingsStore } from "@/lib/user-settings-store"

describe("Rituals", () => {
  beforeEach(() => {
    resetLocalStorage()
    useUserSettingsStore.getState().setBirthday("")
  })

  it("renders the Rituals trigger button", () => {
    render(<Rituals />)
    const trigger = screen.getByRole("button", { name: /Rituals/i })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute("data-rituals-entry")
    expect(trigger).toHaveAttribute("title", expect.stringMatching(/ritual/i))
  })

  it("opens the rituals menu with day sun/moon and period start/review", async () => {
    const user = userEvent.setup()
    render(<Rituals />)
    await user.click(screen.getByRole("button", { name: /Rituals/i }))
    expect(screen.getByRole("menuitem", { name: /Morning/i })).toBeInTheDocument()
    expect(screen.getAllByRole("menuitem", { name: /Night/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("menuitem", { name: /Start ritual/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("menuitem", { name: /Review ritual/i }).length).toBeGreaterThan(0)
  })

  it("opens the birthday Star Lord Report from the menu", async () => {
    const user = userEvent.setup()
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    useUserSettingsStore.getState().setBirthday(`${now.getFullYear()}-${month}-${day}`)
    render(<Rituals />)
    await user.click(screen.getByRole("button", { name: /Rituals/i }))
    await user.click(screen.getByRole("menuitem", { name: /Star Lord · Birthday/i }))
    expect(screen.getByRole("dialog")).toHaveAttribute("data-ui-name", "Star Lord Report")
    expect(screen.getByText("The day the ledger opened")).toBeInTheDocument()
    expect(screen.getByLabelText(/authentic self/i)).toBeInTheDocument()
    useUserSettingsStore.getState().setBirthday("")
  })
})
