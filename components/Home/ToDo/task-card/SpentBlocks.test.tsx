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
import { TaskCardTimeUnit } from "./task-card-unit"

describe("SpentBlocks", () => {
  beforeEach(() => {
    const close = document.querySelector<HTMLButtonElement>("[data-testid='spent-entry-dialog'] button")
    if (close) fireEvent.click(close)
    resetAllStores()
    entryDialog.mockClear()
    localStorage.removeItem("brain2-task-card-time-unit")
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

  it("reads block lengths in hours when that unit is on", () => {
    localStorage.setItem("brain2-task-card-time-unit", "h")
    useTaskStore.getState().addTask({ id: "t1", description: "Chaos", completed: false } as Task)
    useTimeTrackingStore.setState({
      entries: [{ id: "e-pen", date: "2026-10-20", scopeId: "activity", startMin: 540, endMin: 657, taskId: "t1" }],
    } as never)
    render(
      <TaskCardTimeUnit>
        <SpentBlocks scope={{ taskId: "t1", names: new Map() }} />
      </TaskCardTimeUnit>,
    )
    expect(screen.getByText("1h57")).toBeTruthy()
    expect(screen.queryByText("117m")).toBeNull()
  })

  it("stores a bare number as minutes on a logged duration while hours are showing", () => {
    localStorage.setItem("brain2-task-card-time-unit", "h")
    useTaskStore.getState().addTask({
      id: "t1",
      description: "Chaos",
      completed: false,
      timeLogs: [{ id: "log1", date: "2026-10-20", durationMinutes: 25, taskId: "t1" }],
    } as Task)
    render(
      <TaskCardTimeUnit>
        <SpentBlocks scope={{ taskId: "t1", names: new Map() }} />
      </TaskCardTimeUnit>,
    )
    const field = screen.getByLabelText("Logged minutes") as HTMLInputElement
    expect(field.value).toBe("0h25")
    const commit = (value: string) => {
      const input = screen.getByLabelText("Logged minutes")
      fireEvent.change(input, { target: { value } })
      fireEvent.blur(input)
    }
    commit("10")
    expect(useTaskStore.getState().tasks[0].timeLogs?.[0].durationMinutes).toBe(10)
    commit("1h")
    expect(useTaskStore.getState().tasks[0].timeLogs?.[0].durationMinutes).toBe(60)
    commit("0h10")
    expect(useTaskStore.getState().tasks[0].timeLogs?.[0].durationMinutes).toBe(10)
  })

  it("filters steps from a search field", () => {
    useTaskStore.getState().addTask({
      id: "t1",
      description: "Chaos",
      completed: false,
      subtasks: [
        { id: "insert", description: "Insert", completed: false },
        { id: "fronts", description: "fronts", completed: false, subtasks: [{ id: "carve", description: "fix signature carvings", completed: false }] },
      ],
    } as Task)
    useTimeTrackingStore.setState({
      entries: [{ id: "e-bare", date: "2026-10-23", scopeId: "activity", startMin: 700, endMin: 730, taskId: "t1" }],
    } as never)
    render(<SpentBlocks scope={{ taskId: "t1", names: new Map() }} />)
    fireEvent.click(screen.getByRole("button", { name: "Step for 30m on 2026-10-23" }))
    const search = screen.getByRole("combobox", { name: "Search steps" })
    fireEvent.change(search, { target: { value: "carving" } })
    expect(screen.getByRole("option", { name: /fix signature carvings/ })).toBeTruthy()
    expect(screen.queryByRole("option", { name: "Insert" })).toBeNull()
    fireEvent.click(screen.getByRole("option", { name: /fix signature carvings/ }))
    expect(useTimeTrackingStore.getState().entries.find((item) => item.id === "e-bare")!.stepId).toBe("carve")
  })
})
