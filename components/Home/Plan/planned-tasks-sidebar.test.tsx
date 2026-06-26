import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { PlannedTasksSidebar } from "./planned-tasks-sidebar"

describe("PlannedTasksSidebar", () => {
  const currentDate = new Date("2026-06-20T12:00:00")

  beforeEach(() => {
    resetAllStores()
  })

  it("renders month sidebar title", () => {
    render(<PlannedTasksSidebar mode="month" currentDate={currentDate} onTaskClick={vi.fn()} />)
    expect(screen.getByText("Planned This Month")).toBeInTheDocument()
  })

  it("lists month-only planned tasks", () => {
    useTaskStore.getState().setTasks([
      {
        id: "month-task",
        description: "Quarterly planning",
        stage: "scheduled",
        createdAt: currentDate,
        completed: false,
        scheduledMonth: "2026-06",
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 60,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 5,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])

    render(<PlannedTasksSidebar mode="month" currentDate={currentDate} onTaskClick={vi.fn()} />)
    expect(screen.getByText("Quarterly planning")).toBeInTheDocument()
  })
})
