import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useTaskStore } from "@/lib/task-store"
import { ConfirmPlannedDialog } from "./confirm-planned-dialog"

vi.mock("@/lib/services/completion-service", () => ({
  completeTask: vi.fn(),
}))

import { completeTask } from "@/lib/services/completion-service"

const KEY = "2026-09-17"

beforeEach(() => {
  resetAllStores()
  vi.mocked(completeTask).mockClear()
})

describe("ConfirmPlannedDialog", () => {
  it("paints a tracked block and completes the task", () => {
    const task = {
      id: "t1",
      description: "Call mom",
      completed: false,
      lists: [],
      tags: [],
      links: [],
      estimatedDuration: 30,
    } as never
    useTaskStore.setState({ tasks: [task] as never })

    render(
      <ConfirmPlannedDialog
        dateKey={KEY}
        scopeId="activity"
        task={task as never}
        startMin={540}
        endMin={570}
        onClose={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))

    const entries = useTimeTrackingStore.getState().entriesFor(KEY, "activity")
    expect(entries).toMatchObject([{ startMin: 540, endMin: 570, title: "Call mom" }])
    expect(completeTask).toHaveBeenCalledWith("t1", { actualDuration: 30 })
  })
})
