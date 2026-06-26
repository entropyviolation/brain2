import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { SettingsDialog } from "./settings-dialog"

describe("SettingsDialog (Plan)", () => {
  beforeEach(() => {
    resetAllStores()
    useTaskStore.getState().setTasks([
      {
        id: "t1",
        description: "Example",
        stage: "scheduled",
        createdAt: new Date(),
        completed: false,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 5,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])
  })

  it("renders settings overview when open", () => {
    render(<SettingsDialog open onOpenChange={vi.fn()} />)
    expect(screen.getByText("Settings & Data Management")).toBeInTheDocument()
    expect(screen.getByText("Data Overview")).toBeInTheDocument()
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.getByText("Tasks")).toBeInTheDocument()
  })

  it("shows export tab content", async () => {
    const user = (await import("@testing-library/user-event")).default.setup()
    render(<SettingsDialog open onOpenChange={vi.fn()} />)

    await user.click(screen.getByRole("tab", { name: /Export Data/i }))
    expect(screen.getByRole("button", { name: /Download Backup File/i })).toBeInTheDocument()
  })
})
