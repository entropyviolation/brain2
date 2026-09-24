import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TaskType } from "@/lib/types"
import { TaskFormDialog } from "./daily-task-form-dialog"
import { WINDOW_SAND_MS } from "@/components/ui/window-sand-close"

vi.mock("@/components/Home/Habits/daily-task-form", () => ({
  TaskForm: ({
    onSubmit,
    onCancel,
    onDirtyChange,
  }: {
    onSubmit: (task: unknown) => void
    onCancel: () => void
    onDirtyChange?: (dirty: boolean) => void
  }) => (
    <div data-testid="task-form">
      <button onClick={() => onSubmit({ name: "Mock habit" })}>Submit mock</button>
      <button onClick={onCancel}>Cancel mock</button>
      <button onClick={() => onDirtyChange?.(true)}>Mark dirty</button>
    </div>
  ),
}))

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe("TaskFormDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockReducedMotion(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders add title when creating a habit", () => {
    render(
      <TaskFormDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        initialTask={null}
      />,
    )
    expect(screen.getByText("Add New Habit")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument()
    expect(screen.getByTestId("task-form")).toBeInTheDocument()
  })

  it("renders edit title when editing a habit", () => {
    render(
      <TaskFormDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        initialTask={{ id: "h1", name: "Existing", type: TaskType.BOOLEAN, rewardValue: 10 }}
      />,
    )
    expect(screen.getByText("Edit Habit")).toBeInTheDocument()
  })

  it("turns into sand for WINDOW_SAND_MS before unmounting on a clean title-bar close", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onOpenChange = vi.fn()
    render(
      <TaskFormDialog
        open
        onOpenChange={onOpenChange}
        onSubmit={vi.fn()}
        initialTask={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Close" }))

    const panel = screen.getByRole("dialog", { hidden: true })
    expect(panel).toHaveAttribute("data-dusting", "true")
    expect(panel.className).toContain("window-sand-source")
    expect(screen.getByTestId("window-sand-canvas")).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(WINDOW_SAND_MS)
    })

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("snaps shut with no dust when prefers-reduced-motion is reduce", async () => {
    mockReducedMotion(true)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onOpenChange = vi.fn()
    render(
      <TaskFormDialog
        open
        onOpenChange={onOpenChange}
        onSubmit={vi.fn()}
        initialTask={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Close" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(screen.getByRole("dialog")).not.toHaveAttribute("data-dusting", "true")
    expect(screen.queryByTestId("window-sand-canvas")).not.toBeInTheDocument()
  })

  it("does not dissolve while unsaved-changes confirm is open", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onOpenChange = vi.fn()
    render(
      <TaskFormDialog
        open
        onOpenChange={onOpenChange}
        onSubmit={vi.fn()}
        initialTask={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Mark dirty" }))
    await user.click(screen.getByRole("button", { name: "Close" }))

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
    expect(screen.getByText("Add New Habit").closest("[data-dusting]")).toBeNull()
    expect(screen.queryByTestId("window-sand-canvas")).not.toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Exit without saving" }))

    const panel = document.querySelector(".habit95-dialog")
    expect(panel).toHaveAttribute("data-dusting", "true")
    expect(screen.getByTestId("window-sand-canvas")).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(WINDOW_SAND_MS)
    })

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
