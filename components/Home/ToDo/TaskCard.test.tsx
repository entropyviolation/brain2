import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { closeTaskCard, openTaskCard } from "@/lib/task-card"
import { resetPointsVisibilityForTests, setPointsVisibility } from "@/lib/points-visibility"
import { undoLastAction } from "@/lib/action-history"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { startTaskClock } from "@/lib/task-clock"
import { useSessionOpenStore } from "@/lib/session-open-store"
import { itemLayers, clearItemLayers } from "@/lib/step-item-stack"
import type { Subtask, Task } from "@/lib/types"
import { TaskCard, type TaskCardHost } from "./TaskCard"

const s = (id: string, extra: Partial<Subtask> = {}): Subtask => ({ id, description: id, completed: false, ...extra })

function host(extra: Partial<TaskCardHost> = {}): TaskCardHost {
  return {
    period: "day",
    periodLabel: "This day",
    focusedDate: new Date(),
    isRequired: () => false,
    isPrioritized: () => false,
    onToggleRequired: vi.fn(),
    onTogglePrioritized: vi.fn(),
    onStepsChange: (taskId, steps) => {
      const t = useTaskStore.getState().tasks.find((x) => x.id === taskId)!
      useTaskStore.getState().updateTask({ ...t, subtasks: steps })
    },
    onJustStart: vi.fn(),
    onNeeds: vi.fn(),
    hoursLeft: 4,
    ...extra,
  }
}

function seed(extra: Partial<Task> = {}) {
  useTaskStore.getState().addTask({
    id: "t1",
    description: "Finish CDs",
    completed: false,
    subtasks: [s("insert", { points: 4 }), s("label"), s("ship")],
    ...extra,
  } as Task)
}

const steps = () => useTaskStore.getState().tasks.find((t) => t.id === "t1")!.subtasks!

describe("TaskCard", () => {
  beforeEach(() => {
    resetAllStores()
    resetPointsVisibilityForTests()
    clearItemLayers()
    closeTaskCard()
    localStorage.removeItem("brain2-task-card-time-unit")
  })

  it("opens from the store and links to item detail with ↗ Item", () => {
    seed()
    render(<TaskCard host={host()} />)
    expect(screen.queryByText("Finish CDs")).toBeNull()
    act(() => openTaskCard("t1"))
    expect(screen.getAllByText("Finish CDs").length).toBeGreaterThan(0)
    expect(document.querySelector(".task-card-pushflag")).toBeNull()
    expect(screen.getByRole("button", { name: "Just Start" }).className).toContain("is-primary")
    fireEvent.click(screen.getByRole("button", { name: "↗ Item" }))
    expect(itemLayers().map((l) => l.taskId)).toEqual(["t1"])
  })

  it("shows a push flag from the first push, and no Order section", () => {
    seed({
      daysPushed: 1,
      subtasks: [s("insert"), s("label", { dependsOn: ["insert"] })],
    })
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    const flag = document.querySelector(".task-card-pushflag") as HTMLElement
    expect(flag).toBeTruthy()
    expect(flag.textContent).toMatch(/pushed ×1/)
    expect(flag.getAttribute("data-push-count")).toBe("1")
    expect(screen.queryByRole("region", { name: "Order" })).toBeNull()
    expect(screen.getByRole("region", { name: "Steps" })).toBeTruthy()
  })

  it("the aside has a Time section, and several selected steps do not", () => {
    seed({ timeLogs: [{ id: "log1", date: "2026-10-20", durationMinutes: 10, taskId: "t1" }] })
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    const side = document.querySelector("aside.task-card-side") as HTMLElement
    expect(within(side).getByRole("region", { name: "Time" })).toBeTruthy()
    const minutes = within(side).getByLabelText("Minutes of log log1") as HTMLInputElement
    fireEvent.change(minutes, { target: { value: "40" } })
    fireEvent.blur(minutes)
    expect(useTaskStore.getState().tasks[0].timeLogs?.[0].durationMinutes).toBe(40)
    act(() => undoLastAction())
    expect(useTaskStore.getState().tasks[0].timeLogs?.[0].durationMinutes).toBe(10)

    fireEvent.click(screen.getByRole("button", { name: "Select all open" }))
    expect(within(side).queryByRole("region", { name: "Time" })).toBeNull()
    expect(within(side).getByText("Time edits need one step.")).toBeTruthy()
  })

  it("the Spent card lists the tagged blocks and edits their clock span", () => {
    seed()
    useTimeTrackingStore.setState({
      entries: [{ id: "e1", date: "2026-10-20", scopeId: "s", penId: "p", startMin: 540, endMin: 570, taskId: "t1", stepId: "insert" }],
    } as never)
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    fireEvent.click(document.querySelector('[data-stat="spent"]')!)
    expect(screen.getByRole("list", { name: "Blocks of time spent" })).toBeTruthy()
    const end = screen.getByLabelText("End of the block on 2026-10-20") as HTMLInputElement
    expect(end.value).toBe("9:30")
    fireEvent.change(end, { target: { value: "10:00" } })
    fireEvent.keyDown(end, { key: "Enter" })
    const e = useTimeTrackingStore.getState().entries.find((x) => x.id === "e1")!
    expect([e.startMin, e.endMin]).toEqual([540, 600])
  })

  it("the Progress card opens the completion math: ρ and σ over the top-level parts; Esc closes it", () => {
    seed()
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    fireEvent.click(document.querySelector('[data-stat="progress"]')!)
    const fig = screen.getByRole("figure", { name: "Completion math" })
    expect(fig.textContent).toContain("n = 3")
    expect(fig.textContent).toContain("L = 3")
    expect(fig.textContent).toContain("by ends")
  })

  it("Points visible off: no steps N and no Points column; on: task · steps", () => {
    seed()
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    expect(screen.getByTestId("task-card-points").textContent).not.toContain("steps")
    expect(screen.queryByLabelText("Points for insert")).toBeNull()
    act(() => setPointsVisibility({ stepPoints: true }))
    expect(screen.getByTestId("task-card-points").textContent).toContain("steps 0")
  })

  it("a mass edit is one undo step", () => {
    seed()
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    fireEvent.click(screen.getByRole("button", { name: "Select all open" }))
    fireEvent.click(screen.getByRole("button", { name: "More…" }))
    fireEvent.click(screen.getByRole("button", { name: "+15" }))
    expect(steps().map((x) => x.estimatedDuration)).toEqual([15, 15, 15])
    act(() => {
      undoLastAction()
    })
    expect(steps().map((x) => x.estimatedDuration)).toEqual([undefined, undefined, undefined])
  })

  it("Session with this seeds a session; the points dial sets and returns to the rule", () => {
    seed()
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    fireEvent.click(screen.getByRole("button", { name: "Session with this" }))
    expect(useSessionOpenStore.getState().request?.seed).toEqual([{ taskId: "t1" }])
    fireEvent.change(screen.getByLabelText("On done"), { target: { value: "10" } })
    expect(screen.getByTestId("task-card-points").querySelector("[aria-label]")?.getAttribute("aria-label")).toContain("10")
    fireEvent.click(screen.getByRole("button", { name: /Back to the rule/ }))
    expect(useTaskStore.getState().tasks[0].pointsOverride).toBeUndefined()
  })

  it("shows notice answers and takes a new one when the dot is due", () => {
    seed({ daysPushed: 3 })
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    const input = screen.getByLabelText("Note")
    fireEvent.change(input, { target: { value: "too big" } })
    fireEvent.keyDown(input, { key: "Enter", metaKey: true })
    expect(screen.getByText("too big")).toBeInTheDocument()
    // The log stays open for more notes.
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "start smaller" } })
    fireEvent.click(screen.getByRole("button", { name: "Log note" }))
    expect(screen.getByText("start smaller")).toBeInTheDocument()
    // The log folds.
    fireEvent.click(screen.getByRole("button", { name: /Notes/ }))
    expect(screen.queryByLabelText("Note")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /Notes/ }))
  })

  it("shows only needs in use, and adds one by kind", () => {
    seed()
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    expect(screen.queryByText("Resources")).toBeNull()
    expect(screen.getByText("Needs nothing yet.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Add need/ }))
    fireEvent.click(screen.getByRole("button", { name: "Resource" }))
    const input = screen.getByLabelText("Search items and lists…")
    fireEvent.change(input, { target: { value: "Drill" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(screen.getByText("Resources")).toBeInTheDocument()
    expect(screen.getByText("Drill")).toBeInTheDocument()
  })

  it("toggles completion for a selected step and its nested substeps in the right control panel", () => {
    seed({
      subtasks: [
        s("insert", {
          points: 4,
          subtasks: [s("fold booklet"), s("slip into tray")],
        }),
        s("label"),
      ],
    })
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1", "insert"))

    const side = document.querySelector("aside.task-card-side") as HTMLElement
    expect(side).toBeTruthy()

    const stepCheckbox = within(side).getByRole("checkbox", { name: "Complete insert" }) as HTMLInputElement
    expect(stepCheckbox.checked).toBe(false)
    expect(within(side).getByText("Mark complete")).toBeInTheDocument()

    fireEvent.click(stepCheckbox)
    expect(steps().find((x) => x.id === "insert")!.completed).toBe(true)
    expect(stepCheckbox.checked).toBe(true)
    expect(within(side).getByText("Completed")).toBeInTheDocument()

    fireEvent.click(stepCheckbox)
    expect(steps().find((x) => x.id === "insert")!.completed).toBe(false)
    expect(stepCheckbox.checked).toBe(false)

    // Substeps inside SubstepPreview ("Inside") also render completion checkboxes
    const insideSection = within(side).getByRole("region", { name: "Steps inside" })
    const kidCheckbox = within(insideSection).getByRole("checkbox", { name: "Complete fold booklet" }) as HTMLInputElement
    expect(kidCheckbox.checked).toBe(false)

    fireEvent.click(kidCheckbox)
    expect(steps().find((x) => x.id === "insert")!.subtasks!.find((k) => k.id === "fold booklet")!.completed).toBe(true)
    expect(kidCheckbox.checked).toBe(true)

    fireEvent.click(kidCheckbox)
    expect(steps().find((x) => x.id === "insert")!.subtasks!.find((k) => k.id === "fold booklet")!.completed).toBe(false)
    expect(kidCheckbox.checked).toBe(false)
  })

  it("offers the sum of parts as a ghost estimate", () => {
    seed({
      subtasks: [
        s("album", {
          subtasks: [
            s("insert", {
              subtasks: [s("fold booklet", { estimatedDuration: 20 }), s("slip into tray", { estimatedDuration: 15 })],
            }),
          ],
        }),
      ],
    })
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1", "album"))
    const inside = within(document.querySelector("aside.task-card-side") as HTMLElement).getByRole("region", { name: "Steps inside" })
    const ghost = within(inside).getByRole("button", { name: "Suggested estimate for insert" })
    expect(ghost.textContent).toBe("35m")
    expect(ghost.className).toContain("is-ghost")
    fireEvent.click(ghost)
    fireEvent.keyDown(within(inside).getByRole("spinbutton", { name: "Estimate for insert" }), { key: "Enter" })
    const insert = steps().find((step) => step.id === "album")!.subtasks!.find((step) => step.id === "insert")
    expect(insert?.estimatedDuration).toBe(35)
  })

  it("marks the clock pen and play paints with the one you switch to", () => {
    seed({
      penLinks: [
        { scopeId: "activity", penId: "act-work" },
        { scopeId: "activity", penId: "act-rest" },
      ],
    })
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    const pen = document.querySelector("section.tcs-pens") as HTMLElement
    expect(within(pen).getByRole("button", { name: "Clock pen Work" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(within(pen).getByRole("button", { name: "Make Rest the clock pen" }))
    expect(useTaskStore.getState().tasks[0].penLinks?.map((link) => link.penId)).toEqual(["act-rest", "act-work"])
    act(() => startTaskClock("t1"))
    expect(usePenColorSessionStore.getState().session?.penId).toBe("act-rest")
  })

  it("opens a large multiselect for tasks that wait, above the card", () => {
    seed({
      subtasks: [s("insert"), s("label", { subtasks: [s("ink")] })],
    })
    useTaskStore.getState().addTask({ id: "mail", description: "Mail the set", completed: false, type: "task" } as Task)
    useTaskStore.getState().addTask({ id: "zebra", description: "Zebra later", completed: false, type: "task" } as Task)
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    fireEvent.click(screen.getByRole("button", { name: /Make a task wait on this/ }))
    const pop = document.querySelector("[data-task-card-pop]") as HTMLElement
    expect(pop).toBeTruthy()
    expect(pop.parentElement).toBe(document.body)
    const list = within(pop).getByRole("listbox", { name: "Work that waits until this is done" })
    const names = within(list).getAllByRole("checkbox").map((box) => box.getAttribute("aria-label"))
    expect(names.slice(0, 3)).toEqual(["insert", "label", "ink"])
    expect(names.slice(3)).toEqual(["Mail the set", "Zebra later"])
    expect(within(pop).getByRole("heading", { name: "This level" })).toBeTruthy()
    expect(within(pop).getByRole("heading", { name: "Rest of this task" })).toBeTruthy()
    expect(pop.querySelector(".tcs-wait-path")?.textContent).toBe("label")
    expect(within(pop).queryByText("step")).toBeNull()
    expect(within(pop).queryByText("task")).toBeNull()
    fireEvent.change(within(pop).getByLabelText("Search work that waits"), { target: { value: "zebra" } })
    expect(within(list).getAllByRole("checkbox").map((box) => box.getAttribute("aria-label"))).toEqual(["Zebra later"])
    fireEvent.change(within(pop).getByLabelText("Search work that waits"), { target: { value: "" } })
    fireEvent.click(within(list).getByRole("checkbox", { name: "insert" }))
    fireEvent.click(within(list).getByRole("checkbox", { name: "Mail the set" }))
    const task = useTaskStore.getState().tasks.find((row) => row.id === "t1")!
    expect(task.subtasks?.find((step) => step.id === "insert")?.needsTaskIds).toEqual(["t1"])
    expect(useTaskStore.getState().tasks.find((row) => row.id === "mail")?.dependencies).toEqual(["t1"])
    expect(screen.getByRole("button", { name: /Make a task wait on this/ })).toHaveAttribute("aria-expanded", "true")
  })

  it("edits the remaining estimate from the aside tag", () => {
    seed({ subtasks: [s("insert", { estimatedDuration: 20 }), s("label", { estimatedDuration: 10, completed: true })] })
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    const tag = screen.getByRole("button", { name: "Estimated time left for Finish CDs" })
    expect(tag).toHaveTextContent("20m left")
    fireEvent.click(tag)
    expect(screen.getByText("Still open")).toBeTruthy()
    const input = screen.getByRole("spinbutton", { name: "Estimated time left for Finish CDs" })
    fireEvent.change(input, { target: { value: "50" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(useTaskStore.getState().tasks[0].estimatedDuration).toBe(50)
    act(() => openTaskCard("t1", "insert"))
    const stepTag = screen.getByRole("button", { name: "Estimated time left for insert" })
    fireEvent.click(stepTag)
    const stepInput = screen.getByRole("spinbutton", { name: "Estimated time left for insert" })
    fireEvent.change(stepInput, { target: { value: "12" } })
    fireEvent.keyDown(stepInput, { key: "Enter" })
    expect(steps().find((step) => step.id === "insert")?.estimatedDuration).toBe(12)
  })

  it("formats stat durations in minutes or hours", () => {
    seed({ estimatedDuration: 325, subtasks: [] })
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    const reading = () => document.querySelector('[data-stat="estimate"] .dash-reading')
    expect(reading()).toHaveAttribute("aria-label", "325m")
    fireEvent.click(screen.getByRole("button", { name: "Hours" }))
    expect(reading()).toHaveAttribute("aria-label", "5h25")
    expect(localStorage.getItem("brain2-task-card-time-unit")).toBe("h")
    fireEvent.click(screen.getByRole("button", { name: "Minutes" }))
    expect(reading()).toHaveAttribute("aria-label", "325m")
  })

  it("shows a short duration as hours when that unit is on", () => {
    localStorage.setItem("brain2-task-card-time-unit", "h")
    seed({ estimatedDuration: 45, subtasks: [] })
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    expect(document.querySelector('[data-stat="estimate"] .dash-reading')).toHaveAttribute("aria-label", "0h45")
    expect(screen.getByRole("button", { name: "Hours" })).toHaveAttribute("aria-pressed", "true")
  })

  it("the spent pill is a diary of days, not the blocks editor", () => {
    seed()
    useTimeTrackingStore.setState({
      entries: [
        {
          id: "e1",
          date: "2026-10-20",
          scopeId: "s",
          penId: "p",
          startMin: 570,
          endMin: 660,
          taskId: "t1",
          nowObjectives: [{ id: "o1", text: "Print the spines", addedAt: "2026-10-20T09:30:00", stepId: "insert" }],
        },
      ],
    } as never)
    render(<TaskCard host={host({ timeOf: () => ({ spent: 90 }) })} />)
    act(() => openTaskCard("t1"))
    fireEvent.click(screen.getByRole("button", { name: "90m spent" }))
    const diary = document.querySelector(".tcs-spent-diary") as HTMLElement
    expect(diary).toBeTruthy()
    expect(diary.textContent).toMatch(/Tue, Oct 20/)
    expect(diary.querySelector(".tcs-spent-clock")).toBeNull()
    expect(screen.queryByRole("list", { name: "Blocks of time spent" })).toBeNull()
    expect(screen.queryByRole("list", { name: "Minutes counted as spent" })).toBeNull()
  })

  it("draws one chain when the clock pen's parent is linked, and keeps an unrelated pen", () => {
    useTimeTrackingStore.getState().setPenParent("activity", "act-rest", "act-work")
    seed({
      penLinks: [
        { scopeId: "activity", penId: "act-rest" },
        { scopeId: "activity", penId: "act-work" },
        { scopeId: "activity", penId: "act-exercise" },
      ],
    })
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    const pen = document.querySelector("section.tcs-pens") as HTMLElement
    expect(pen.querySelectorAll(".trk-chain")).toHaveLength(1)
    expect(within(pen).getByRole("button", { name: "Clock pen Rest" })).toHaveAttribute("aria-pressed", "true")
    expect(within(pen).getByRole("button", { name: "Unlink Work" })).toBeTruthy()
    expect(pen.querySelectorAll(".ipt-chip")).toHaveLength(1)
    expect(within(pen).getByText("Exercise")).toBeTruthy()
    expect(useTaskStore.getState().tasks[0].penLinks?.map((link) => link.penId)).toEqual(["act-rest", "act-work", "act-exercise"])
  })

  it("with nothing selected, the whole-task aside lists the first level inside, and a name selects that step", () => {
    seed({
      subtasks: [
        s("insert", { description: "Insert", subtasks: [s("fronts", { description: "fronts", estimatedDuration: 45 })] }),
        s("disc", { description: "Disc", estimatedDuration: 20 }),
      ],
    })
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    const side = document.querySelector("aside.task-card-side") as HTMLElement
    expect(within(side).getByText(/whole task/)).toBeTruthy()
    const inside = within(side).getByRole("region", { name: "Steps inside" })
    expect(within(inside).getByRole("button", { name: "Insert" })).toBeTruthy()
    expect(within(inside).getByRole("button", { name: "Disc" })).toBeTruthy()
    expect(within(inside).queryByRole("button", { name: "fronts" })).toBeNull()
    const ghost = within(inside).getByRole("button", { name: "Suggested estimate for Insert" })
    expect(ghost.className).toContain("is-ghost")
    expect(ghost.textContent).toBe("45m")
    expect(within(inside).getByRole("checkbox", { name: "Complete Disc" })).toBeTruthy()

    fireEvent.click(within(inside).getByRole("button", { name: "Insert" }))
    expect(within(side).getByRole("heading", { level: 3, name: "Insert" })).toBeTruthy()
    const nested = within(side).getByRole("region", { name: "Steps inside" })
    expect(within(nested).getByRole("button", { name: "fronts" })).toBeTruthy()
    expect(within(nested).queryByRole("button", { name: "Disc" })).toBeNull()
  })

  it("compares actual and estimate when both exist, and hides the readout when one is missing", () => {
    seed({ estimatedDuration: 325, subtasks: [s("insert", { description: "Insert", estimatedDuration: 40 })] })
    const { unmount } = render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    const side = () => document.querySelector("aside.task-card-side") as HTMLElement
    expect(within(side()).queryByRole("region", { name: "Actual and estimate" })).toBeNull()
    unmount()
    closeTaskCard()

    render(<TaskCard host={host({ timeOf: () => ({ spent: 322, stepSpent: new Map([["insert", 50]]) }) })} />)
    act(() => openTaskCard("t1"))
    const cmp = within(side()).getByRole("region", { name: "Actual and estimate" })
    expect(within(cmp).getByText("Actual")).toBeTruthy()
    expect(within(cmp).getByText("Estimate")).toBeTruthy()
    expect(within(cmp).getByText("Difference")).toBeTruthy()
    expect(cmp).toHaveTextContent("322m")
    expect(cmp).toHaveTextContent("325m")
    expect(cmp).toHaveTextContent("3m under")
    fireEvent.click(screen.getByRole("button", { name: "Hours" }))
    expect(cmp).toHaveTextContent("5h22")
    expect(cmp).toHaveTextContent("5h25")
    expect(cmp).toHaveTextContent("0h03 under")
    fireEvent.click(screen.getByRole("button", { name: "Minutes" }))

    fireEvent.click(within(side()).getByRole("button", { name: "Insert" }))
    const stepCmp = within(side()).getByRole("region", { name: "Actual and estimate" })
    expect(stepCmp).toHaveTextContent("50m")
    expect(stepCmp).toHaveTextContent("40m")
    expect(stepCmp).toHaveTextContent("10m over")
  })

  it("hides the comparison on a step that has only one of the two numbers", () => {
    seed({ subtasks: [s("insert", { description: "Insert", estimatedDuration: 40 }), s("disc", { description: "Disc" })] })
    render(<TaskCard host={host({ timeOf: () => ({ spent: 0, stepSpent: new Map([["disc", 15]]) }) })} />)
    act(() => openTaskCard("t1", "insert"))
    const side = document.querySelector("aside.task-card-side") as HTMLElement
    expect(within(side).queryByRole("region", { name: "Actual and estimate" })).toBeNull()
    expect(within(side).getByRole("region", { name: "Estimate" })).toBeTruthy()
    act(() => openTaskCard("t1", "disc"))
    expect(within(side).queryByRole("region", { name: "Actual and estimate" })).toBeNull()
  })
})
