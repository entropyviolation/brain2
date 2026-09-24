/**
 * ModulesPanel — smoke + module management tests.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { APP_NAV_KEYS, writeStoredId } from "@/lib/app-navigation"
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

  it("lists the House Cleaning App template in the builder", async () => {
    const user = userEvent.setup()
    render(<ModulesPanel />)
    await user.click(screen.getByRole("button", { name: /Build module/i }))
    expect(screen.getByText("House Cleaning App")).toBeInTheDocument()
    expect(screen.getByText(/Tidy: areas with hierarchical chores/i)).toBeInTheDocument()
    expect(screen.getByText("GradSearch")).toBeInTheDocument()
    expect(screen.queryByText("Cleaning System")).not.toBeInTheDocument()
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

  it("reopens the last workspace after remount", () => {
    useModulesStore.setState({
      modules: [
        {
          id: "ws-trip",
          type: "workspace",
          kind: "workspace",
          title: "Kept trip",
          config: {},
          views: [{ id: "notes-1", title: "Notes", kind: "notes", config: {} }],
        },
      ],
    })
    writeStoredId(APP_NAV_KEYS.modulesWorkspaceId, "ws-trip")
    render(<ModulesPanel />)
    expect(screen.getByText("Kept trip")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Modules" })).not.toBeInTheDocument()
  })
})
