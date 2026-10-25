import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Task } from "@/lib/types"

const entryDialog = vi.hoisted(() => vi.fn())

vi.mock("@/components/Home/Tracking/entry-dialog", () => ({
  EntryDialog: (props: { entry: { id: string }; onClose: () => void }) => {
    entryDialog(props)
    return (
      <div data-testid="spent-entry-dialog" data-entry-id={props.entry.id}>
        <button type="button" onClick={props.onClose}>
          Close block
        </button>
      </div>
    )
  },
}))

import { SpentBlocks } from "./SpentBlocks"

describe("SpentBlocks", () => {
  beforeEach(() => {
    const close = document.querySelector<HTMLButtonElement>("[data-testid='spent-entry-dialog'] button")
    if (close) fireEvent.click(close)
    resetAllStores()
    entryDialog.mockClear()
  })

  it("shows a pen's color on a written block and double-click opens that block", () => {
    useTaskStore.getState().addTask({
      id: "t1",
      description: "Chaos",
      completed: false,
      subtasks: [{ id: "insert", description: "Insert", completed: false }],
    } as Task)
    const scopes = useTimeTrackingStore.getState().scopes.map((scope) =>
      scope.id === "activity"
        ? { ...scope, pens: [...scope.pens, { id: "pen-chaos", name: "Chaos", color: "#c45cff" }] }
        : scope,
    )
    useTimeTrackingStore.setState({
      scopes,
      entries: [
        { id: "e-pen", date: "2026-10-20", scopeId: "activity", penId: "pen-chaos", startMin: 540, endMin: 657, taskId: "t1", stepId: "insert" },
        { id: "e-bare", date: "2026-10-20", scopeId: "activity", startMin: 700, endMin: 730, taskId: "t1" },
        { id: "e-ghost", date: "2026-10-20", scopeId: "activity", penId: "missing-pen", startMin: 800, endMin: 815, taskId: "t1" },
      ],
    } as never)

    render(<SpentBlocks scope={{ taskId: "t1", names: new Map([["insert", "Insert"]]) }} />)

    const painted = screen.getByText("117m").closest("li") as HTMLElement
    const dot = painted.querySelector(".task-card-pen-dot") as HTMLElement
    expect(dot).toBeTruthy()
    expect(dot).toHaveStyle({ backgroundColor: "#c45cff" })
    expect(dot.getAttribute("title")).toBe("Chaos")
    expect(screen.getByText("30m").closest("li")!.querySelector(".task-card-pen-dot")).toBeNull()
    expect(screen.getByText("15m").closest("li")!.querySelector(".task-card-pen-dot")).toBeNull()

    fireEvent.click(screen.getByText("117m"))
    fireEvent.doubleClick(within(painted).getByLabelText("Start on 2026-10-20"))
    expect(entryDialog).not.toHaveBeenCalled()
    expect(screen.queryByTestId("spent-entry-dialog")).toBeNull()

    fireEvent.doubleClick(screen.getByText("117m"))
    expect(entryDialog).toHaveBeenCalledWith(expect.objectContaining({ entry: expect.objectContaining({ id: "e-pen" }) }))
    expect(screen.getByTestId("spent-entry-dialog").getAttribute("data-entry-id")).toBe("e-pen")

    fireEvent.click(screen.getByRole("button", { name: "Close block" }))
    entryDialog.mockClear()
    const end = within(painted).getByLabelText("End on 2026-10-20") as HTMLInputElement
    fireEvent.change(end, { target: { value: "11:00" } })
    fireEvent.keyDown(end, { key: "Enter" })
    expect(useTimeTrackingStore.getState().entries.find((item) => item.id === "e-pen")!.endMin).toBe(660)
    expect(entryDialog).not.toHaveBeenCalled()
  })
})
