/**
 * ModulesPanel — smoke + module management tests.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useModulesStore } from "@/lib/modules-store"
import { ModulesPanel } from "./modules-panel"

describe("ModulesPanel", () => {
  beforeEach(() => {
    resetLocalStorage()
    useModulesStore.setState({
      modules: [
        {
          id: "mod-test-stat",
          type: "analytics-stat",
          title: "Weekly Points",
          config: { stat: "points-week" },
        },
        {
          id: "mod-test-write",
          type: "writing-prompt",
          title: "Daily Writing Prompt",
          config: {},
        },
      ],
    })
  })

  it("renders the modules header and configured module cards", () => {
    render(<ModulesPanel />)

    expect(screen.getByRole("heading", { name: "Modules" })).toBeInTheDocument()
    expect(screen.getByText("Build mini-apps and widgets from your lists, items, and stats.")).toBeInTheDocument()
    expect(screen.getByText("Weekly Points")).toBeInTheDocument()
    expect(screen.getByText("Daily Writing Prompt")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Build module/i })).toBeInTheDocument()
  })

  it("removes a module when the remove button is clicked", async () => {
    const user = userEvent.setup()
    render(<ModulesPanel />)

    expect(useModulesStore.getState().modules).toHaveLength(2)

    const removeButtons = screen.getAllByRole("button", { name: "Remove" })
    await user.click(removeButtons[0])

    expect(useModulesStore.getState().modules).toHaveLength(1)
    expect(screen.queryByText("Weekly Points")).not.toBeInTheDocument()
    expect(screen.getByText("Daily Writing Prompt")).toBeInTheDocument()
  })
})
